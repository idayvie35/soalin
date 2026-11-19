import {
  BankQuestion,
  EducationLevel,
  ExamProject,
  GenerationConfig,
  QualityReport,
  QuestionItem,
  QuestionVisual,
  RppKurmer,
  UserProfile,
} from '../types.ts';

export interface GenerationProgress {
  step: number;
  totalSteps: number;
  message: string;
  percent: number;
}

export async function fetchProjects(): Promise<ExamProject[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Gagal memuat daftar proyek soal.');
  return res.json();
}

export async function saveProjectApi(project: ExamProject): Promise<ExamProject> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal menyimpan proyek.');
  }
  return res.json();
}

export async function duplicateProjectApi(id: string): Promise<ExamProject> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Gagal menduplikasi proyek.');
  return res.json();
}

export async function deleteProjectApi(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Gagal menghapus proyek.');
}

export async function fetchBankQuestions(): Promise<BankQuestion[]> {
  const res = await fetch('/api/bank');
  if (!res.ok) throw new Error('Gagal memuat bank soal.');
  return res.json();
}

export async function saveBankQuestionApi(item: BankQuestion): Promise<BankQuestion> {
  const res = await fetch('/api/bank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error('Gagal menyimpan soal ke bank soal.');
  return res.json();
}

export async function toggleBankFavoriteApi(id: string): Promise<BankQuestion> {
  const res = await fetch(`/api/bank/${encodeURIComponent(id)}/favorite`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Gagal memperbarui favorit.');
  return res.json();
}

export async function deleteBankQuestionApi(id: string): Promise<void> {
  const res = await fetch(`/api/bank/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Gagal menghapus soal dari bank.');
}

export async function fetchProfileApi(): Promise<UserProfile> {
  const res = await fetch('/api/profile');
  if (!res.ok) throw new Error('Gagal memuat profil pengguna.');
  return res.json();
}

export async function saveProfileApi(profile: UserProfile): Promise<UserProfile> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Gagal menyimpan profil pengguna.');
  return res.json();
}

export async function generateQuestionsStream(
  config: GenerationConfig,
  onProgress: (progress: GenerationProgress) => void
): Promise<{ questions: QuestionItem[]; qualityReport: QualityReport }> {
  const res = await fetch('/api/ai/generate-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!res.ok || !res.body) {
    throw new Error('Gagal terhubung ke layanan AI pembuat soal.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: { questions: QuestionItem[]; qualityReport: QualityReport } | null = null;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const lines = block.split('\n');
      let eventType = 'message';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataStr += line.slice(5).trim();
        }
      }
      if (!dataStr) continue;
      const payload = JSON.parse(dataStr);
      if (eventType === 'progress') {
        onProgress(payload as GenerationProgress);
      } else if (eventType === 'complete') {
        finalResult = payload as { questions: QuestionItem[]; qualityReport: QualityReport };
      } else if (eventType === 'error') {
        streamError = payload.message || 'Terjadi kesalahan AI.';
      }
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }
  if (!finalResult) {
    throw new Error('Proses generasi selesai tanpa hasil. Silakan coba kembali.');
  }
  return finalResult;
}

export async function regenerateSingleQuestionApi(params: {
  title: string;
  subtitles: string[];
  subject: string;
  level: string;
  gradeClass?: string;
  optionCount?: 3 | 4 | 5;
  language: string;
  existingQuestion: QuestionItem;
  instruction?: string;
  otherPrompts: string[];
}): Promise<QuestionItem> {
  const res = await fetch('/api/ai/regenerate-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal meregenerasi soal.');
  }
  return res.json();
}

export async function generateVisualForQuestionApi(params: {
  questionPrompt: string;
  subject: string;
  level: string;
  customVisualHint?: string;
}): Promise<QuestionVisual> {
  const res = await fetch('/api/ai/generate-visual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal membuat diagram visual.');
  }
  return res.json();
}

export async function generateRppApi(params: {
  institutionName?: string;
  institutionAddress?: string;
  teacherName?: string;
  teacherNip?: string;
  principalName?: string;
  principalNip?: string;
  subject: string;
  level: EducationLevel;
  gradeClass: string;
  semester?: string;
  academicYear?: string;
  topic: string;
  subtopics?: string[];
  alokasiWaktu?: string;
  jumlahPertemuan?: string;
  modelPembelajaran?: string;
  language?: string;
  description?: string;
}): Promise<RppKurmer> {
  const res = await fetch('/api/ai/generate-rpp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal menyusun RPP Kurikulum Merdeka.');
  }
  return res.json();
}

