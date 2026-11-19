import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  generateExamQuestions,
  generateRppKurmer,
  generateVisualForQuestion,
  regenerateSingleQuestion,
} from './server/gemini.ts';
import {
  addBankQuestion,
  deleteBankQuestion,
  deleteProject,
  duplicateProject,
  getBankQuestions,
  getProfile,
  getProjects,
  toggleBankFavorite,
  updateProfile,
  upsertProject,
} from './server/storage.ts';
import { BankQuestion, ExamProject, GenerationConfig, UserProfile } from './src/types.ts';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT =
    process.env.NODE_ENV === 'production'
      ? Number(process.env.PORT) || 3000
      : Number(process.env.DEFAULT_APP_PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Standalone index.html preview & download endpoints
  app.get(['/standalone', '/standalone/index.html'], async (_req, res) => {
    try {
      const filePath = path.resolve(process.cwd(), 'standalone', 'index.html');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/standalone-html', async (_req, res) => {
    try {
      const filePath = path.resolve(process.cwd(), 'standalone', 'index.html');
      res.download(filePath, 'index.html');
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GAS + Blogger Deployment Bundle Endpoint
  app.get('/api/gas-bundle', async (_req, res) => {
    try {
      const dir = path.resolve(process.cwd(), 'gas-blogger');
      const entries = await fs.readdir(dir);
      const files = await Promise.all(
        entries.sort().map(async (name) => {
          const full = path.join(dir, name);
          const content = await fs.readFile(full, 'utf-8');
          return { name, content, lines: content.split('\n').length };
        })
      );
      try {
        const standalonePath = path.resolve(process.cwd(), 'standalone', 'index.html');
        const standaloneContent = await fs.readFile(standalonePath, 'utf-8');
        files.unshift({
          name: 'standalone-index.html',
          content: standaloneContent,
          lines: standaloneContent.split('\n').length,
        });
      } catch {
        // Ignore if standalone file missing
      }
      res.json({ files });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Projects API
  app.get('/api/projects', async (_req, res) => {
    try {
      const projects = await getProjects();
      res.json(projects);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const project = req.body as ExamProject;
      if (!project || !project.id) {
        res.status(400).json({ error: 'Data proyek tidak valid.' });
        return;
      }
      const saved = await upsertProject(project);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/projects/:id', async (req, res) => {
    try {
      const project = { ...(req.body as ExamProject), id: req.params.id };
      const saved = await upsertProject(project);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/projects/:id/duplicate', async (req, res) => {
    try {
      const copy = await duplicateProject(req.params.id);
      if (!copy) {
        res.status(404).json({ error: 'Proyek tidak ditemukan.' });
        return;
      }
      res.json(copy);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      await deleteProject(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Personal Question Bank API
  app.get('/api/bank', async (_req, res) => {
    try {
      const bank = await getBankQuestions();
      res.json(bank);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/bank', async (req, res) => {
    try {
      const item = req.body as BankQuestion;
      const saved = await addBankQuestion(item);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/bank/:id/favorite', async (req, res) => {
    try {
      const updated = await toggleBankFavorite(req.params.id);
      if (!updated) {
        res.status(404).json({ error: 'Item bank soal tidak ditemukan.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/bank/:id', async (req, res) => {
    try {
      await deleteBankQuestion(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // User Profile API
  app.get('/api/profile', async (_req, res) => {
    try {
      const profile = await getProfile();
      res.json(profile);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/profile', async (req, res) => {
    try {
      const saved = await updateProfile(req.body as UserProfile);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // AI Question Generation with SSE progress stream
  app.post('/api/ai/generate-stream', async (req, res) => {
    const config = req.body as GenerationConfig;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (type: string, data: unknown) => {
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await generateExamQuestions(config, (progress) => {
        sendEvent('progress', progress);
      });
      sendEvent('complete', result);
      res.end();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menghasilkan soal dengan AI.';
      sendEvent('error', { message });
      res.end();
    }
  });

  // AI Regenerate single question
  app.post('/api/ai/regenerate-question', async (req, res) => {
    try {
      const regenerated = await regenerateSingleQuestion(req.body);
      res.json(regenerated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // AI Generate visual SVG for a question
  app.post('/api/ai/generate-visual', async (req, res) => {
    try {
      const visual = await generateVisualForQuestion(req.body);
      res.json(visual);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // AI Generate RPP Kurikulum Merdeka
  app.post('/api/ai/generate-rpp', async (req, res) => {
    try {
      const rpp = await generateRppKurmer(req.body);
      res.json(rpp);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : undefined,
        watch: disableHmr ? null : undefined,
      },
      appType: 'spa',
    });

    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev middleware:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SOALIN AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
