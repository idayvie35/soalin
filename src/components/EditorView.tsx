import { useState } from 'react';
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  FileDown,
  PenSquare,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { QUESTION_TYPE_META } from '../constants.ts';
import { BankQuestion, ExamProject, QuestionItem, QuestionType } from '../types.ts';
import { buildKisiKisiRow, getFaseKurikulumMerdeka } from '../utils/kurikulumMerdeka.ts';
import { getSynchronizedMatching } from '../utils/matching.ts';
import { EditorDisplayMode, QuestionEditorCard } from './QuestionEditorCard.tsx';

interface EditorViewProps {
  project: ExamProject | null;
  bank: BankQuestion[];
  onChangeProject: (updated: ExamProject) => void;
  onSaveProject: (project: ExamProject) => Promise<void>;
  onSaveQuestionToBank: (question: QuestionItem, project: ExamProject) => Promise<void>;
  onRegenerateQuestion: (question: QuestionItem, instruction?: string) => Promise<void>;
  onGenerateVisual: (question: QuestionItem, hint?: string) => Promise<void>;
  onOpenExport: () => void;
  onGoToGenerator: () => void;
}

export function EditorView({
  project,
  bank,
  onChangeProject,
  onSaveProject,
  onSaveQuestionToBank,
  onRegenerateQuestion,
  onGenerateVisual,
  onOpenExport,
  onGoToGenerator,
}: EditorViewProps) {
  const [displayMode, setDisplayMode] = useState<EditorDisplayMode | 'kisi_kisi'>('teacher');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [showBankDrawer, setShowBankDrawer] = useState(false);

  if (!project) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
          Belum Ada Paket Soal yang Dibuka
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Buat paket soal baru menggunakan Generator AI atau buka salah satu proyek dari Dashboard dan Riwayat Proyek.
        </p>
        <button
          type="button"
          onClick={onGoToGenerator}
          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0F294A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          Buka Generator Soal AI
        </button>
      </div>
    );
  }

  const totalWeight = project.questions.reduce((s, q) => s + (q.weight || 0), 0);

  const filteredQuestions = project.questions.filter((q) => {
    const matchesSearch =
      !searchTerm.trim() ||
      q.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.topicTag.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || q.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleUpdateQuestion = (updatedQ: QuestionItem) => {
    const nextQuestions = project.questions.map((q) =>
      q.id === updatedQ.id ? updatedQ : q
    );
    onChangeProject({ ...project, questions: nextQuestions });
  };

  const handleDeleteQuestion = (qId: string) => {
    const nextQuestions = project.questions
      .filter((q) => q.id !== qId)
      .map((q, idx) => ({ ...q, number: idx + 1 }));
    onChangeProject({ ...project, questions: nextQuestions });
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= project.questions.length) return;
    const copy = [...project.questions];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    const renumbered = copy.map((q, idx) => ({ ...q, number: idx + 1 }));
    onChangeProject({ ...project, questions: renumbered });
  };

  const handleAddManualQuestion = (type: QuestionType) => {
    const isArabic = project.language.includes('Arab');
    const isPureArabic = project.language === 'Arab';
    const optCount =
      project.config?.optionCount ||
      (project.level === 'SD' || project.level === 'SMP' ? 4 : 5);
    const fullLabels = isPureArabic
      ? ['أ', 'ب', 'ج', 'د', 'هـ']
      : ['A', 'B', 'C', 'D', 'E'];
    const labels = fullLabels.slice(0, optCount);
    const needsOptions = [
      'pilihan_ganda',
      'pilihan_ganda_kompleks',
      'berbasis_gambar',
      'berbasis_bacaan',
      'hots',
    ].includes(type);

    const newQ: QuestionItem = {
      id: `q-manual-${Date.now()}`,
      number: project.questions.length + 1,
      type,
      topicTag: project.subtitles[0] || project.title,
      difficulty: 'Sedang',
      cognitiveLevel: type === 'hots' ? 'C4' : 'C2',
      thinkingTier: type === 'hots' ? 'HOTS' : 'MOTS',
      weight: QUESTION_TYPE_META[type].defaultWeight,
      isArabic: isArabic || type === 'menebalkan_mewarnai_arab',
      isRTL: false,
      prompt:
        type === 'menjodohkan'
          ? 'Pasangkan istilah pada Kolom Kiri (1–4) dengan pasangan yang tepat pada Pilihan Kanan (A–D), lalu tuliskan jawaban Anda pada kotak isian yang tersedia.'
          : type === 'menebalkan_mewarnai_arab'
          ? 'Tebalkan garis huruf Arab berikut dengan rapi menggunakan pensil, kemudian warnailah kata/kalimat Arab di bawahnya dengan warna yang indah!'
          : isPureArabic
          ? 'اكتب نص السؤال هنا...'
          : 'Tuliskan teks pertanyaan di sini...',
      arabicPrompt: type === 'menebalkan_mewarnai_arab' ? 'مَدْرَسَةٌ جَمِيلَةٌ' : undefined,
      readingTranslation: type === 'menebalkan_mewarnai_arab' ? 'Sekolah yang indah' : undefined,
      options: needsOptions
        ? labels.map((l, i) => ({ label: l, text: `Pilihan ${l}`, isCorrect: i === 0 }))
        : type === 'benar_salah'
        ? [
            { label: 'A', text: isPureArabic ? 'صواب' : 'Benar', isCorrect: true },
            { label: 'B', text: isPureArabic ? 'خطأ' : 'Salah', isCorrect: false },
          ]
        : undefined,
      matchingPairs:
        type === 'menjodohkan'
          ? [
              { id: '1', left: 'Konsep 1', right: 'Pasangan 1' },
              { id: '2', left: 'Konsep 2', right: 'Pasangan 2' },
              { id: '3', left: 'Konsep 3', right: 'Pasangan 3' },
              { id: '4', left: 'Konsep 4', right: 'Pasangan 4' },
            ]
          : undefined,
      sequenceItems:
        type === 'mengurutkan' ? ['Langkah 1', 'Langkah 2', 'Langkah 3'] : undefined,
      correctAnswer:
        type === 'menebalkan_mewarnai_arab'
          ? 'مَدْرَسَةٌ جَمِيلَةٌ (Sekolah yang indah)'
          : type === 'menjodohkan'
          ? getSynchronizedMatching([
              { id: '1', left: 'Konsep 1', right: 'Pasangan 1' },
              { id: '2', left: 'Konsep 2', right: 'Pasangan 2' },
              { id: '3', left: 'Konsep 3', right: 'Pasangan 3' },
              { id: '4', left: 'Konsep 4', right: 'Pasangan 4' },
            ]).answerKey
          : needsOptions
          ? labels[0]
          : type === 'benar_salah'
          ? 'Benar'
          : 'Jawaban model...',
      explanation: 'Tuliskan pembahasan yang mendidik di sini.',
      rubric:
        type === 'menebalkan_mewarnai_arab'
          ? 'Kerapian menebalkan garis huruf & harakat (50%), keindahan serta kebersihan mewarnai tulisan Arab (50%).'
          : ['esai', 'studi_kasus', 'analisis_teks'].includes(type)
          ? 'Pedoman skor: Ketepatan konsep (50%), Kelengkapan argumen (50%).'
          : undefined,
      verifiedByAI: false,
    };

    onChangeProject({
      ...project,
      questions: [...project.questions, newQ],
    });
    setShowAddManual(false);
    setDisplayMode('edit');
  };

  const handleInsertFromBank = (bankItem: BankQuestion) => {
    const cloned: QuestionItem = {
      ...structuredClone(bankItem.question),
      id: `q-bank-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      number: project.questions.length + 1,
    };
    onChangeProject({
      ...project,
      questions: [...project.questions, cloned],
    });
    setShowBankDrawer(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveProject(project);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Workspace Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{project.level}</span>
            {(project.header.gradeClass || project.gradeClass) && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {project.header.gradeClass || project.gradeClass}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{project.subject}</span>
            <span aria-hidden="true">·</span>
            <span>{project.language}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{project.questions.length} soal</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Total Bobot {totalWeight}</span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="text"
              value={project.title}
              onChange={(e) => onChangeProject({ ...project, title: e.target.value })}
              aria-label="Judul Paket Soal"
              className="w-full max-w-2xl rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xl font-bold tracking-tight text-slate-900 hover:border-slate-200 focus:border-[#0F294A] focus:bg-white focus:outline-none dark:text-white dark:hover:border-slate-700 dark:focus:bg-slate-900 md:text-2xl"
            />
            <button
              type="button"
              onClick={() =>
                onChangeProject({ ...project, isFavorite: !project.isFavorite })
              }
              title="Tandai Favorit"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Star
                className={`h-5 w-5 ${
                  project.isFavorite ? 'fill-amber-400 text-amber-500' : ''
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Menyimpan...' : 'Simpan Proyek'}
          </button>

          <button
            type="button"
            onClick={onOpenExport}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#0F294A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap"
          >
            <FileDown className="h-4 w-4" />
            Ekspor &amp; Cetak
          </button>
        </div>
      </div>

      {/* AI Quality Report Strip */}
      {project.qualityReport && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                Pemeriksaan Kualitas Otomatis Selesai
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
              {project.qualityReport.materialAlignment && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Materi Sesuai
                </span>
              )}
              {project.qualityReport.answerKeyVerified && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Kunci Tervalidasi
                </span>
              )}
              {project.qualityReport.noDuplicates && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Bebas Duplikasi
                </span>
              )}
              {project.qualityReport.arabicGrammarChecked && project.language.includes('Arab') && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Qawaid &amp; Harakat Terperiksa
                </span>
              )}
            </div>
          </div>
          {project.qualityReport.notes.length > 0 && (
            <p className="mt-1.5 text-xs text-emerald-800/90 dark:text-emerald-300/90">
              {project.qualityReport.notes.join(' ')}
            </p>
          )}
        </div>
      )}

      {/* Workspace Toolbar: Mode Switcher + Search + Add Question */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">
        {/* Display Mode Segmented Control */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setDisplayMode('student')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              displayMode === 'student'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Mode Siswa (Tanpa Kunci)
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('teacher')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              displayMode === 'teacher'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Mode Guru (Kunci &amp; Pembahasan)
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('edit')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              displayMode === 'edit'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            <PenSquare className="h-3.5 w-3.5" />
            Mode Editor Lengkap
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('kisi_kisi')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              displayMode === 'kisi_kisi'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Kisi-Kisi (Kurmer)
          </button>
        </div>

        {/* Search, Filter & Add Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-48 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari soal..."
              className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">Semua Tipe ({project.questions.length})</option>
            {Array.from(new Set(project.questions.map((q) => q.type))).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_META[t]?.shortLabel || t}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowBankDrawer(true)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            <Bookmark className="h-3.5 w-3.5" />
            Dari Bank Soal
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddManual((v) => !v)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0F294A] px-3 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Soal Manual
            </button>

            {showAddManual && (
              <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <p className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Pilih Jenis Soal Baru
                </p>
                {(
                  [
                    'pilihan_ganda',
                    'pilihan_ganda_kompleks',
                    'benar_salah',
                    'esai',
                    'isian_singkat',
                    'menjodohkan',
                    'mengurutkan',
                    'analisis_teks',
                    'studi_kasus',
                  ] as QuestionType[]
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleAddManualQuestion(t)}
                    className="block w-full rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {QUESTION_TYPE_META[t].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Questions List OR Kisi-Kisi Kurikulum Merdeka Table */}
      {displayMode === 'kisi_kisi' ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Kisi-Kisi Penulisan Soal (Kurikulum Merdeka)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {project.subject} · {project.level}{project.header.gradeClass ? ` · ${project.header.gradeClass}` : ''} ({getFaseKurikulumMerdeka(project.level, project.header.gradeClass)}) · Pengampu: {project.header.teacherName}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenExport}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <FileDown className="h-3.5 w-3.5" />
              Cetak / Ekspor Kisi-Kisi
            </button>
          </div>

          {project.questions.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              <strong>Capaian Pembelajaran (CP): </strong>
              {
                buildKisiKisiRow(project.questions[0], {
                  subject: project.subject,
                  level: project.level,
                  gradeClass: project.header.gradeClass,
                  title: project.title,
                }).capaianPembelajaran
              }
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-left text-xs dark:border-slate-700">
              <thead>
                <tr className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  <th className="w-10 border border-slate-200 px-2 py-2 text-center dark:border-slate-700">No</th>
                  <th className="w-[27%] border border-slate-200 px-2.5 py-2 dark:border-slate-700">Tujuan Pembelajaran (TP)</th>
                  <th className="w-[16%] border border-slate-200 px-2.5 py-2 dark:border-slate-700">Lingkup Materi</th>
                  <th className="w-[37%] border border-slate-200 px-2.5 py-2 dark:border-slate-700">Indikator Soal</th>
                  <th className="w-[14%] border border-slate-200 px-2 py-2 dark:border-slate-700">Level &amp; Bentuk</th>
                  <th className="w-14 border border-slate-200 px-2 py-2 text-center dark:border-slate-700">Bobot</th>
                </tr>
              </thead>
              <tbody>
                {project.questions.map((q) => {
                  const row = buildKisiKisiRow(q, {
                    subject: project.subject,
                    level: project.level,
                    gradeClass: project.header.gradeClass,
                    title: project.title,
                  });
                  return (
                    <tr key={q.id} className="odd:bg-white even:bg-slate-50/50 dark:odd:bg-slate-900 dark:even:bg-slate-800/30">
                      <td className="border border-slate-200 px-2 py-2 text-center font-bold dark:border-slate-700">
                        {row.number}
                      </td>
                      <td className="border border-slate-200 p-1.5 dark:border-slate-700">
                        <textarea
                          rows={2}
                          value={q.tujuanPembelajaran ?? row.tujuanPembelajaran}
                          onChange={(e) =>
                            handleUpdateQuestion({ ...q, tujuanPembelajaran: e.target.value })
                          }
                          className="w-full rounded border border-slate-200 bg-slate-50 p-1.5 text-[11px] leading-snug dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="border border-slate-200 p-1.5 dark:border-slate-700">
                        <input
                          type="text"
                          value={q.topicTag}
                          onChange={(e) =>
                            handleUpdateQuestion({ ...q, topicTag: e.target.value })
                          }
                          className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="border border-slate-200 p-1.5 dark:border-slate-700">
                        <textarea
                          rows={2}
                          value={q.indikatorSoal ?? row.indikatorSoal}
                          onChange={(e) =>
                            handleUpdateQuestion({ ...q, indikatorSoal: e.target.value })
                          }
                          className="w-full rounded border border-slate-200 bg-slate-50 p-1.5 text-[11px] leading-snug dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700">
                        <span className="font-semibold">{row.cognitiveLevel}</span> ({row.thinkingTier})
                        <div className="text-[10px] text-slate-500">{row.bentukSoal}</div>
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center font-mono dark:border-slate-700">
                        {row.weight}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q) => {
            const realIdx = project.questions.findIndex((item) => item.id === q.id);
            return (
              <QuestionEditorCard
                key={q.id}
                question={q}
                index={realIdx}
                total={project.questions.length}
                displayMode={displayMode}
                onUpdate={handleUpdateQuestion}
                onDelete={() => handleDeleteQuestion(q.id)}
                onMove={(dir) => handleMoveQuestion(realIdx, dir)}
                onSaveToBank={() => onSaveQuestionToBank(q, project)}
                onRegenerate={(instruction) => onRegenerateQuestion(q, instruction)}
                onGenerateVisual={(hint) => onGenerateVisual(q, hint)}
              />
            );
          })}
        </div>
      )}

      {/* Bank Soal Insert Modal */}
      {showBankDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Sisipkan Soal dari Bank Soal Pribadi
              </h3>
              <button
                type="button"
                onClick={() => setShowBankDrawer(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">
              {bank.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Bank soal pribadi masih kosong. Klik ikon simpan pada soal manapun untuk menambahkannya.
                </p>
              ) : (
                bank.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.subject} · {item.level} · {QUESTION_TYPE_META[item.question.type]?.shortLabel}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
                        {item.question.prompt}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInsertFromBank(item)}
                      className="min-h-[38px] shrink-0 rounded-lg bg-[#0F294A] px-3.5 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
                    >
                      Sisipkan
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
