import { useEffect, useState } from 'react';
import {
  Bookmark,
  BookTemplate,
  ClipboardList,
  Edit3,
  FileDown,
  FolderOpen,
  Globe,
  LayoutDashboard,
  Menu,
  Moon,
  PlusCircle,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { Code2 } from 'lucide-react';
import { DashboardView } from './components/DashboardView.tsx';
import { EditorView } from './components/EditorView.tsx';
import { ExportStudioView } from './components/ExportStudioView.tsx';
import { GasBundleView } from './components/GasBundleView.tsx';
import { GeneratorView } from './components/GeneratorView.tsx';
import { BankView, ProjectsView } from './components/ProjectsAndBankView.tsx';
import { RppKurmerView } from './components/RppKurmerView.tsx';
import { ProfileView, TemplatesView } from './components/TemplatesAndProfileView.tsx';
import { ToastContainer, ToastItem } from './components/Toast.tsx';
import {
  DEFAULT_GRADE_BY_LEVEL,
  DEFAULT_QUESTION_COUNTS,
  getSuggestedOptionCount,
} from './constants.ts';
import {
  deleteBankQuestionApi,
  deleteProjectApi,
  duplicateProjectApi,
  fetchBankQuestions,
  fetchProfileApi,
  fetchProjects,
  generateQuestionsStream,
  generateVisualForQuestionApi,
  GenerationProgress,
  regenerateSingleQuestionApi,
  saveBankQuestionApi,
  saveProfileApi,
  saveProjectApi,
  toggleBankFavoriteApi,
} from './services/api.ts';
import {
  BankQuestion,
  ExamHeader,
  ExamProject,
  ExamTemplate,
  GenerationConfig,
  QuestionItem,
  UserProfile,
} from './types.ts';

type NavSection =
  | 'dashboard'
  | 'generator'
  | 'editor'
  | 'rpp'
  | 'export'
  | 'blogger'
  | 'projects'
  | 'bank'
  | 'templates'
  | 'gasbundle'
  | 'profile';

const DEFAULT_PROFILE: UserProfile = {
  fullName: 'Ustdz Mulyadi, S.T.',
  roleTitle: 'Pengajar & Pengampu Evaluasi (SD–SMA)',
  nipOrId: '',
  institutionName: 'Sekolah Islam Terpadu Plus Cordova',
  institutionAddress: 'Sekolah Islam Terpadu Plus Cordova (Jenjang SD–SMA)',
  defaultLevel: 'SMP',
  defaultAcademicYear: '2026/2027',
  defaultSemester: 'Ganjil',
};

function createDefaultConfig(profile: UserProfile): GenerationConfig {
  const defaultLvl = profile.defaultLevel || 'SMP';
  const defaultGrade = DEFAULT_GRADE_BY_LEVEL[defaultLvl] || 'Kelas 8';
  return {
    title: '',
    subtitles: [],
    description: '',
    level: defaultLvl,
    gradeClass: defaultGrade,
    subject: 'Ilmu Pengetahuan Alam (IPA)',
    language: 'Indonesia',
    optionCount: getSuggestedOptionCount(defaultLvl, defaultGrade),
    questionCounts: { ...DEFAULT_QUESTION_COUNTS },
    difficulty: 'Campuran',
    cognitiveLevels: ['C2', 'C3', 'C4'],
    thinkingTier: 'Campuran',
    depth: 'Menengah',
    tone: 'Formal',
    shuffleQuestions: false,
    shuffleOptions: true,
    enableVisuals: true,
    arabicFocus: 'Umum Bahasa Arab',
    harakatMode: 'Penuh (Syakal Lengkap)',
    rewriteWordMode: 'progressive',
    rewriteWordCount: 3,
  };
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('soalin_theme') === 'dark';
  });

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [projects, setProjects] = useState<ExamProject[]>([]);
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [activeProject, setActiveProject] = useState<ExamProject | null>(null);
  const [genConfig, setGenConfig] = useState<GenerationConfig>(() =>
    createDefaultConfig(DEFAULT_PROFILE)
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<GenerationProgress | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = (
    type: ToastItem['type'],
    title: string,
    message?: string
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('soalin_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('soalin_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [loadedProjects, loadedBank, loadedProfile] = await Promise.all([
          fetchProjects(),
          fetchBankQuestions(),
          fetchProfileApi(),
        ]);
        if (!mounted) return;
        setProjects(loadedProjects);
        setBank(loadedBank);
        setProfile(loadedProfile);
        const loadedLvl = loadedProfile.defaultLevel || 'SMP';
        setGenConfig((prev) => ({
          ...prev,
          level: loadedLvl,
          gradeClass: prev.gradeClass || DEFAULT_GRADE_BY_LEVEL[loadedLvl],
          optionCount: prev.optionCount || getSuggestedOptionCount(loadedLvl),
        }));
        if (loadedProjects.length > 0) {
          setActiveProject(loadedProjects[0]);
        }
      } catch (err) {
        notify('error', 'Gagal memuat data awal', (err as Error).message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const navigateTo = (section: NavSection) => {
    setActiveNav(section);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyTemplate = (tpl: ExamTemplate) => {
    const fullCounts = {
      pilihan_ganda: 0,
      pilihan_ganda_kompleks: 0,
      benar_salah: 0,
      esai: 0,
      isian_singkat: 0,
      menjodohkan: 0,
      melengkapi_kalimat: 0,
      mengurutkan: 0,
      studi_kasus: 0,
      analisis_teks: 0,
      hots: 0,
      berbasis_gambar: 0,
      berbasis_bacaan: 0,
      memisah_hijaiyah: 0,
      menyambung_hijaiyah: 0,
      menulis_ulang_kalimat: 0,
      menebalkan_mewarnai_arab: 0,
      ...tpl.questionCounts,
    };

    const tplGrade = tpl.gradeClass || DEFAULT_GRADE_BY_LEVEL[tpl.level] || 'Kelas 8';
    setGenConfig({
      title: tpl.title,
      subtitles: [...tpl.subtitles],
      description: tpl.description,
      level: tpl.level,
      gradeClass: tplGrade,
      subject: tpl.subject,
      language: tpl.language,
      optionCount: getSuggestedOptionCount(tpl.level, tplGrade),
      questionCounts: fullCounts,
      difficulty: tpl.difficulty,
      cognitiveLevels: [...tpl.cognitiveLevels],
      thinkingTier: tpl.thinkingTier,
      depth: 'Menengah',
      tone: 'Formal',
      shuffleQuestions: false,
      shuffleOptions: true,
      enableVisuals: true,
      arabicFocus: tpl.arabicFocus || 'Umum Bahasa Arab',
      harakatMode: tpl.harakatMode || 'Penuh (Syakal Lengkap)',
      rewriteWordMode: 'progressive',
      rewriteWordCount: 3,
    });
    navigateTo('generator');
    notify('info', 'Template diterapkan', `Silakan tinjau atau klik BUAT SOAL OTOMATIS.`);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenProgress({
      step: 1,
      totalSteps: 3,
      message: 'Mengirim konfigurasi materi ke Gemini AI...',
      percent: 8,
    });

    try {
      const effectiveConfig: GenerationConfig = {
        ...genConfig,
        subtitles:
          genConfig.subtitles.length > 0
            ? genConfig.subtitles
            : [genConfig.title],
      };

      const { questions, qualityReport } = await generateQuestionsStream(
        effectiveConfig,
        (prog) => setGenProgress(prog)
      );

      const resolvedGrade =
        (effectiveConfig.gradeClass || '').trim() ||
        DEFAULT_GRADE_BY_LEVEL[effectiveConfig.level] ||
        'Kelas X';

      const now = new Date().toISOString();
      const newProject: ExamProject = {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: effectiveConfig.title,
        subtitles: effectiveConfig.subtitles,
        subject: effectiveConfig.subject,
        level: effectiveConfig.level,
        gradeClass: resolvedGrade,
        language: effectiveConfig.language,
        difficulty: effectiveConfig.difficulty,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
        header: {
          institutionName: profile.institutionName,
          institutionAddress: profile.institutionAddress,
          examTitle: 'EVALUASI PEMBELAJARAN / UJIAN',
          subject: effectiveConfig.subject,
          level: effectiveConfig.level,
          gradeClass: resolvedGrade,
          semester: profile.defaultSemester,
          academicYear: profile.defaultAcademicYear,
          teacherName: profile.fullName,
          teacherNip: profile.nipOrId,
          timeAllocation: '90 Menit',
          instructions:
            'Bacalah setiap soal dengan cermat sebelum memilih atau menuliskan jawaban.',
          includeStudentIdentityBox: true,
        },
        config: effectiveConfig,
        questions,
        qualityReport,
      };

      const saved = await saveProjectApi(newProject);
      setProjects((prev) => [saved, ...prev]);
      setActiveProject(saved);
      navigateTo('editor');
      notify(
        'success',
        `${questions.length} soal berhasil dibuat`,
        'Kunci jawaban, pembahasan, dan validasi kualitas telah disiapkan.'
      );
    } catch (err) {
      notify('error', 'Gagal membuat soal otomatis', (err as Error).message);
    } finally {
      setIsGenerating(false);
      setGenProgress(null);
    }
  };

  const handleSaveProject = async (project: ExamProject) => {
    try {
      const saved = await saveProjectApi(project);
      setActiveProject(saved);
      setProjects((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
      });
      notify('success', 'Proyek soal disimpan');
    } catch (err) {
      notify('error', 'Gagal menyimpan proyek', (err as Error).message);
    }
  };

  const handleUpdateProjectInMemory = (updated: ExamProject) => {
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleToggleProjectFavorite = async (project: ExamProject) => {
    const updated = { ...project, isFavorite: !project.isFavorite };
    await handleSaveProject(updated);
  };

  const handleDuplicateProject = async (id: string) => {
    try {
      const copy = await duplicateProjectApi(id);
      setProjects((prev) => [copy, ...prev]);
      notify('success', 'Paket soal berhasil diduplikasi');
    } catch (err) {
      notify('error', 'Gagal menduplikasi', (err as Error).message);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProjectApi(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProject?.id === id) {
        setActiveProject(null);
      }
      notify('info', 'Proyek dihapus');
    } catch (err) {
      notify('error', 'Gagal menghapus proyek', (err as Error).message);
    }
  };

  const handleRegenerateQuestion = async (
    question: QuestionItem,
    instruction?: string
  ) => {
    if (!activeProject) return;
    try {
      const otherPrompts = activeProject.questions
        .filter((q) => q.id !== question.id)
        .map((q) => q.prompt);

      const newQ = await regenerateSingleQuestionApi({
        title: activeProject.title,
        subtitles: activeProject.subtitles,
        subject: activeProject.subject,
        level: activeProject.level,
        gradeClass: activeProject.header.gradeClass || activeProject.gradeClass,
        optionCount: activeProject.config?.optionCount,
        language: activeProject.language,
        existingQuestion: question,
        instruction,
        otherPrompts,
      });

      const updatedProject: ExamProject = {
        ...activeProject,
        questions: activeProject.questions.map((q) =>
          q.id === question.id ? newQ : q
        ),
      };
      const saved = await saveProjectApi(updatedProject);
      setActiveProject(saved);
      setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      notify('success', `Soal nomor ${question.number} berhasil dibuat ulang`);
    } catch (err) {
      notify('error', 'Gagal meregenerasi soal', (err as Error).message);
    }
  };

  const handleGenerateVisual = async (question: QuestionItem, hint?: string) => {
    if (!activeProject) return;
    try {
      const visual = await generateVisualForQuestionApi({
        questionPrompt: question.prompt,
        subject: activeProject.subject,
        level: activeProject.level,
        customVisualHint: hint,
      });
      const updatedProject: ExamProject = {
        ...activeProject,
        questions: activeProject.questions.map((q) =>
          q.id === question.id ? { ...q, visual } : q
        ),
      };
      const saved = await saveProjectApi(updatedProject);
      setActiveProject(saved);
      setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      notify('success', `Diagram visual ditambahkan ke soal nomor ${question.number}`);
    } catch (err) {
      notify('error', 'Gagal membuat diagram', (err as Error).message);
    }
  };

  const handleSaveQuestionToBank = async (
    question: QuestionItem,
    proj: ExamProject
  ) => {
    try {
      const item: BankQuestion = {
        id: `bank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        savedAt: new Date().toISOString(),
        subject: proj.subject,
        level: proj.level,
        language: proj.language,
        isFavorite: false,
        question: structuredClone(question),
      };
      const saved = await saveBankQuestionApi(item);
      setBank((prev) => [saved, ...prev]);
      notify('success', 'Disimpan ke Bank Soal Pribadi');
    } catch (err) {
      notify('error', 'Gagal menyimpan ke bank soal', (err as Error).message);
    }
  };

  const handleToggleBankFavorite = async (id: string) => {
    try {
      const updated = await toggleBankFavoriteApi(id);
      setBank((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      notify('error', 'Gagal memperbarui favorit', (err as Error).message);
    }
  };

  const handleDeleteBankItem = async (id: string) => {
    try {
      await deleteBankQuestionApi(id);
      setBank((prev) => prev.filter((b) => b.id !== id));
      notify('info', 'Soal dihapus dari bank');
    } catch (err) {
      notify('error', 'Gagal menghapus dari bank', (err as Error).message);
    }
  };

  const handleInsertBankIntoActive = async (item: BankQuestion) => {
    if (!activeProject) return;
    const cloned: QuestionItem = {
      ...structuredClone(item.question),
      id: `q-bank-${Date.now()}`,
      number: activeProject.questions.length + 1,
    };
    const updated = {
      ...activeProject,
      questions: [...activeProject.questions, cloned],
    };
    await handleSaveProject(updated);
    navigateTo('editor');
  };

  const handleUpdateHeader = async (header: ExamHeader) => {
    if (!activeProject) return;
    const updated = { ...activeProject, header };
    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    await saveProjectApi(updated).catch(() => {});
  };

  const handleSaveProfile = async (nextProfile: UserProfile) => {
    try {
      const saved = await saveProfileApi(nextProfile);
      setProfile(saved);
      notify('success', 'Profil pengajar & lembaga disimpan');
    } catch (err) {
      notify('error', 'Gagal menyimpan profil', (err as Error).message);
    }
  };

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'generator', label: 'Generator Soal', icon: PlusCircle },
    { id: 'editor', label: 'Editor & Preview', icon: Edit3 },
    { id: 'rpp', label: 'RPP (Kurmer)', icon: ClipboardList },
    { id: 'export', label: 'Ekspor & Cetak', icon: FileDown },
    { id: 'blogger', label: 'Blogger & Standalone', icon: Globe },
    { id: 'projects', label: 'Proyek & Riwayat', icon: FolderOpen },
    { id: 'bank', label: 'Bank Soal', icon: Bookmark },
    { id: 'templates', label: 'Template', icon: BookTemplate },
    { id: 'gasbundle', label: 'Paket GAS & Blogger', icon: Code2 },
    { id: 'profile', label: 'Profil & Lembaga', icon: Settings },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
      {/* Desktop Fixed Sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            className="text-left leading-tight"
          >
            <span className="block font-display text-base font-extrabold tracking-tight text-[#0F294A] dark:text-white whitespace-nowrap">
              SIT PLUS CORDOVA
            </span>
            <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              SIT Plus Cordova · SD–SMA
            </span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navigasi Utama">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0F294A] font-semibold text-white dark:bg-blue-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span>{darkMode ? 'Mode Gelap' : 'Mode Terang'}</span>
            {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile Compact Top Header (<= 56px) */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        <button
          type="button"
          onClick={() => navigateTo('dashboard')}
          className="font-display text-sm font-extrabold tracking-tight text-[#0F294A] dark:text-white whitespace-nowrap"
        >
          SIT PLUS CORDOVA
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Ubah tema"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Buka menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[82vw] flex-col bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="leading-tight">
                <span className="block font-display text-sm font-extrabold text-[#0F294A] dark:text-white">
                  SIT PLUS CORDOVA
                </span>
                <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  SIT Plus Cordova (SD–SMA)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium ${
                      active
                        ? 'bg-[#0F294A] font-semibold text-white dark:bg-blue-600'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="pb-20 lg:pl-[260px] lg:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeNav === 'dashboard' && (
                <DashboardView
                  profile={profile}
                  projects={projects}
                  bank={bank}
                  onStartNew={() => {
                    setGenConfig(createDefaultConfig(profile));
                    navigateTo('generator');
                  }}
                  onApplyTemplate={handleApplyTemplate}
                  onOpenProject={(p) => {
                    setActiveProject(p);
                    navigateTo('editor');
                  }}
                  onDuplicateProject={handleDuplicateProject}
                  onExportProject={(p) => {
                    setActiveProject(p);
                    navigateTo('export');
                  }}
                  onNavigateProjects={() => navigateTo('projects')}
                />
              )}

              {activeNav === 'generator' && (
                <GeneratorView
                  config={genConfig}
                  onChange={setGenConfig}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  progress={genProgress}
                />
              )}

              {activeNav === 'editor' && (
                <EditorView
                  project={activeProject}
                  bank={bank}
                  onChangeProject={handleUpdateProjectInMemory}
                  onSaveProject={handleSaveProject}
                  onSaveQuestionToBank={handleSaveQuestionToBank}
                  onRegenerateQuestion={handleRegenerateQuestion}
                  onGenerateVisual={handleGenerateVisual}
                  onOpenExport={() => navigateTo('export')}
                  onGoToGenerator={() => navigateTo('generator')}
                />
              )}

              {activeNav === 'rpp' && (
                <RppKurmerView
                  profile={profile}
                  activeProject={activeProject}
                  genConfig={genConfig}
                  onNotify={notify}
                />
              )}

              {(activeNav === 'export' || activeNav === 'blogger') && (
                <ExportStudioView
                  key={activeNav}
                  project={activeProject}
                  onUpdateHeader={handleUpdateHeader}
                  onNotify={notify}
                  onGoToGenerator={() => navigateTo('generator')}
                  initialTab={activeNav === 'blogger' ? 'blogger' : 'document'}
                />
              )}

              {activeNav === 'projects' && (
                <ProjectsView
                  projects={projects}
                  onOpenProject={(p) => {
                    setActiveProject(p);
                    navigateTo('editor');
                  }}
                  onToggleFavorite={handleToggleProjectFavorite}
                  onDuplicateProject={handleDuplicateProject}
                  onDeleteProject={handleDeleteProject}
                  onExportProject={(p) => {
                    setActiveProject(p);
                    navigateTo('export');
                  }}
                  onStartNew={() => navigateTo('generator')}
                />
              )}

              {activeNav === 'bank' && (
                <BankView
                  bank={bank}
                  hasActiveProject={Boolean(activeProject)}
                  onToggleFavorite={handleToggleBankFavorite}
                  onDeleteBankItem={handleDeleteBankItem}
                  onInsertIntoActive={handleInsertBankIntoActive}
                />
              )}

              {activeNav === 'templates' && (
                <TemplatesView onApplyTemplate={handleApplyTemplate} />
              )}

              {activeNav === 'gasbundle' && <GasBundleView onNotify={notify} />}

              {activeNav === 'profile' && (
                <ProfileView profile={profile} onSaveProfile={handleSaveProfile} />
              )}
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Thumb Navigation (<= 56px height) */}
      <nav
        aria-label="Navigasi Bawah"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-slate-200 bg-white/95 px-1 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
      >
        {(
          [
            { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
            { id: 'generator', label: 'Buat Soal', icon: PlusCircle },
            { id: 'editor', label: 'Editor', icon: Edit3 },
            { id: 'export', label: 'Ekspor', icon: FileDown },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active
                  ? 'font-semibold text-[#0F294A] dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400"
        >
          <Menu className="h-4 w-4" />
          <span>Lainnya</span>
        </button>
      </nav>

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
