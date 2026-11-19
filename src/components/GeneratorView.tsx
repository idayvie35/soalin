import { useState } from 'react';
import {
  BookOpen,
  Check,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  ALL_QUESTION_TYPES,
  ARABIC_FOCUSES,
  COGNITIVE_LEVELS,
  DEFAULT_GRADE_BY_LEVEL,
  EDUCATION_LEVELS,
  getOptionRangeLabel,
  getSuggestedOptionCount,
  GRADE_OPTIONS_BY_LEVEL,
  HARAKAT_MODES,
  LANGUAGES,
  QUESTION_TYPE_META,
  SUBJECT_LIST,
} from '../constants.ts';
import { GenerationProgress } from '../services/api.ts';
import {
  CognitiveLevel,
  DifficultyLevel,
  GenerationConfig,
  LanguageTone,
  MaterialDepth,
  QuestionType,
  ThinkingTier,
} from '../types.ts';
import { hasArabicText } from '../utils/arabic.ts';

interface GeneratorViewProps {
  config: GenerationConfig;
  onChange: (next: GenerationConfig) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  progress: GenerationProgress | null;
}

export function GeneratorView({
  config,
  onChange,
  onGenerate,
  isGenerating,
  progress,
}: GeneratorViewProps) {
  const [subtitleInput, setSubtitleInput] = useState('');

  const totalQuestions = Object.values(config.questionCounts).reduce(
    (sum, val) => sum + (val || 0),
    0
  );

  const estimatedTotalPoints = (Object.entries(config.questionCounts) as [QuestionType, number][]).reduce(
    (sum, [type, count]) => sum + (count || 0) * (QUESTION_TYPE_META[type]?.defaultWeight ?? 2),
    0
  );

  const isArabicMode =
    config.language.includes('Arab') ||
    [
      'Bahasa Arab',
      'Nahwu & Sharaf',
      'Balaghah',
      'Fiqih & Ushul Fiqih',
      'Al-Quran & Tafsir',
      'Hadis & Ilmu Hadis',
      'Aqidah Akhlak',
    ].includes(config.subject);

  const updateField = <K extends keyof GenerationConfig>(
    key: K,
    value: GenerationConfig[K]
  ) => {
    onChange({ ...config, [key]: value });
  };

  const addSubtitle = () => {
    const trimmed = subtitleInput.trim();
    if (!trimmed) return;
    const parts = trimmed
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...config.subtitles, ...parts]));
    updateField('subtitles', merged);
    setSubtitleInput('');
  };

  const removeSubtitle = (index: number) => {
    updateField(
      'subtitles',
      config.subtitles.filter((_, idx) => idx !== index)
    );
  };

  const setQuestionCount = (type: QuestionType, nextCount: number) => {
    const clamped = Math.max(0, Math.min(50, Math.floor(nextCount || 0)));
    updateField('questionCounts', {
      ...config.questionCounts,
      [type]: clamped,
    });
  };

  const toggleCognitive = (code: CognitiveLevel) => {
    const exists = config.cognitiveLevels.includes(code);
    if (exists && config.cognitiveLevels.length === 1) return; // keep at least 1
    const next = exists
      ? config.cognitiveLevels.filter((c) => c !== code)
      : [...config.cognitiveLevels, code].sort();
    updateField('cognitiveLevels', next);
  };

  const applyCountPreset = (preset: 'standard' | 'hots' | 'arabic' | 'hijaiyah' | 'reset') => {
    const empty: Record<QuestionType, number> = {
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
    };

    if (preset === 'standard') {
      updateField('questionCounts', {
        ...empty,
        pilihan_ganda: 10,
        benar_salah: 3,
        isian_singkat: 2,
        esai: 3,
      });
    } else if (preset === 'hots') {
      updateField('questionCounts', {
        ...empty,
        pilihan_ganda_kompleks: 3,
        hots: 4,
        studi_kasus: 2,
        berbasis_gambar: 2,
        esai: 2,
      });
    } else if (preset === 'arabic') {
      updateField('questionCounts', {
        ...empty,
        pilihan_ganda: 5,
        melengkapi_kalimat: 3,
        analisis_teks: 2,
        esai: 2,
      });
    } else if (preset === 'hijaiyah') {
      onChange({
        ...config,
        subject: 'Bahasa Arab',
        language: 'Bilingual (Arab-Indonesia)',
        questionCounts: {
          ...empty,
          memisah_hijaiyah: 4,
          menyambung_hijaiyah: 4,
          menulis_ulang_kalimat: 4,
          menebalkan_mewarnai_arab: 2,
        },
        rewriteWordMode: 'progressive',
        rewriteWordCount: 3,
      });
    } else {
      updateField('questionCounts', empty);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Generator Soal AI · Penyusunan Terstruktur &amp; Validasi Otomatis
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Buat Paket Soal Baru
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Masukkan judul materi, daftar subbab, komposisi jenis soal, dan parameter kognitif. AI akan menyusun soal beserta kunci, pembahasan, dan ilustrasi bila diperlukan.
        </p>
      </div>

      {/* Progress Banner when Generating */}
      {isGenerating && progress && (
        <div
          className="rounded-xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-900/60 dark:bg-blue-950/40"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-[#0F294A] dark:text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  AI Sedang Menyusun &amp; Memvalidasi Paket Soal...
                </p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Langkah {progress.step} dari {progress.totalSteps}: {progress.message}
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold tabular-nums text-[#0F294A] dark:text-blue-400">
              {progress.percent}%
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[#0F294A] transition-all duration-300 dark:bg-blue-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column: Step 1 & Step 3 */}
        <div className="space-y-6 xl:col-span-5">
          {/* Step 1: Input Materi */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                01. Materi, Jenjang, Kelas &amp; Bahasa
              </h2>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Wajib diisi
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Judul Materi Utama
                </label>
                <input
                  type="text"
                  value={config.title}
                  dir="ltr"
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Contoh: Hukum Newton tentang Gerak atau أحكام المبتدأ والخبر"
                  className={`min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-left text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F294A] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500 ${
                    hasArabicText(config.title) ? 'font-arabic text-base' : ''
                  }`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Subjudul / Pokok Bahasan (Bisa lebih dari satu)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subtitleInput}
                    dir="ltr"
                    onChange={(e) => setSubtitleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubtitle();
                      }
                    }}
                    placeholder="Ketik subbab lalu tekan Enter atau Tambah..."
                    className={`min-h-[44px] flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-left text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F294A] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                      hasArabicText(subtitleInput) ? 'font-arabic text-base' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={addSubtitle}
                    className="min-h-[44px] shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Tambah
                  </button>
                </div>

                {config.subtitles.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {config.subtitles.map((sub, idx) => (
                      <div
                        key={`${sub}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/60"
                      >
                        <span
                          dir="ltr"
                          className={`flex-1 text-left font-medium text-slate-800 dark:text-slate-200 ${
                            hasArabicText(sub) ? 'font-arabic text-sm' : ''
                          }`}
                        >
                          {idx + 1}. {sub}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSubtitle(idx)}
                          aria-label={`Hapus subjudul ${sub}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jenjang Pendidikan
                  </label>
                  <select
                    value={config.level}
                    onChange={(e) => {
                      const nextLvl = e.target.value as GenerationConfig['level'];
                      const nextGrade = DEFAULT_GRADE_BY_LEVEL[nextLvl] || '';
                      onChange({
                        ...config,
                        level: nextLvl,
                        gradeClass: nextGrade,
                        optionCount: getSuggestedOptionCount(nextLvl, nextGrade),
                      });
                    }}
                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 focus:border-[#0F294A] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kelas / Tingkat
                  </label>
                  <select
                    value={
                      (GRADE_OPTIONS_BY_LEVEL[config.level] || []).includes(
                        config.gradeClass || ''
                      )
                        ? config.gradeClass
                        : '__custom__'
                    }
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        onChange({
                          ...config,
                          gradeClass: e.target.value,
                          optionCount: getSuggestedOptionCount(config.level, e.target.value),
                        });
                      }
                    }}
                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 focus:border-[#0F294A] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {(GRADE_OPTIONS_BY_LEVEL[config.level] || []).map((gr) => (
                      <option key={gr} value={gr}>
                        {gr}
                      </option>
                    ))}
                    {!(GRADE_OPTIONS_BY_LEVEL[config.level] || []).includes(
                      config.gradeClass || ''
                    ) && (
                      <option value="__custom__">
                        {config.gradeClass || 'Kustom...'}
                      </option>
                    )}
                  </select>
                  <input
                    type="text"
                    value={config.gradeClass || ''}
                    onChange={(e) => updateField('gradeClass', e.target.value)}
                    placeholder="Atau ketik kelas (mis. Kelas 4B)"
                    className="mt-1.5 min-h-[34px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0F294A] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Bahasa Soal
                  </label>
                  <select
                    value={config.language}
                    onChange={(e) =>
                      updateField('language', e.target.value as GenerationConfig['language'])
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 focus:border-[#0F294A] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mata Pelajaran / Bidang Studi
                </label>
                <select
                  value={SUBJECT_LIST.includes(config.subject) ? config.subject : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      updateField('subject', e.target.value);
                    }
                  }}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 focus:border-[#0F294A] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {SUBJECT_LIST.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                  {!SUBJECT_LIST.includes(config.subject) && (
                    <option value="__custom__">{config.subject}</option>
                  )}
                </select>
                <input
                  type="text"
                  value={config.subject}
                  onChange={(e) => updateField('subject', e.target.value)}
                  placeholder="Atau ketik nama mata pelajaran khusus..."
                  className="mt-2 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0F294A] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Dedicated Arabic & Dirasah Islamiyah Config */}
              {isArabicMode && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    Pengaturan Bahasa Arab &amp; Harakat
                  </p>
                  <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-emerald-800 dark:text-emerald-400">
                        Fokus Kajian Arab
                      </label>
                      <select
                        value={config.arabicFocus}
                        onChange={(e) =>
                          updateField(
                            'arabicFocus',
                            e.target.value as GenerationConfig['arabicFocus']
                          )
                        }
                        className="min-h-[40px] w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-xs text-slate-900 dark:border-emerald-800 dark:bg-slate-900 dark:text-white"
                      >
                        {ARABIC_FOCUSES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-emerald-800 dark:text-emerald-400">
                        Mode Harakat / Syakal
                      </label>
                      <select
                        value={config.harakatMode}
                        onChange={(e) =>
                          updateField(
                            'harakatMode',
                            e.target.value as GenerationConfig['harakatMode']
                          )
                        }
                        className="min-h-[40px] w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-xs text-slate-900 dark:border-emerald-800 dark:bg-slate-900 dark:text-white"
                      >
                        {HARAKAT_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Deskripsi / Konteks Tambahan (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={config.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Contoh: Fokus pada contoh penerapan sehari-hari, hindari soal hafalan tanggal, sertakan dalil atau ayat pendek..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F294A] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Step 3: Pengaturan Kualitas & Pedagogi */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
              03. Pengaturan Kualitas &amp; Taksonomi
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tingkat Kesulitan
                  </label>
                  <select
                    value={config.difficulty}
                    onChange={(e) =>
                      updateField('difficulty', e.target.value as DifficultyLevel)
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {(['Mudah', 'Sedang', 'Sulit', 'Campuran'] as DifficultyLevel[]).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Orientasi Berpikir
                  </label>
                  <select
                    value={config.thinkingTier}
                    onChange={(e) =>
                      updateField('thinkingTier', e.target.value as ThinkingTier)
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {(['LOTS', 'MOTS', 'HOTS', 'Campuran'] as ThinkingTier[]).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Level Kognitif Taksonomi Bloom (Pilih 1 atau lebih)
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {COGNITIVE_LEVELS.map((cog) => {
                    const active = config.cognitiveLevels.includes(cog.code);
                    return (
                      <button
                        key={cog.code}
                        type="button"
                        onClick={() => toggleCognitive(cog.code)}
                        className={`flex min-h-[42px] items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                          active
                            ? 'border-[#0F294A] bg-[#0F294A] text-white dark:border-blue-500 dark:bg-blue-600'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <span className="font-semibold whitespace-nowrap">{cog.label}</span>
                        {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kedalaman Materi
                  </label>
                  <select
                    value={config.depth}
                    onChange={(e) =>
                      updateField('depth', e.target.value as MaterialDepth)
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {(['Dasar', 'Menengah', 'Mendalam'] as MaterialDepth[]).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Gaya Bahasa
                  </label>
                  <select
                    value={config.tone}
                    onChange={(e) =>
                      updateField('tone', e.target.value as LanguageTone)
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {(['Formal', 'Akademis', 'Sederhana'] as LanguageTone[]).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Ilustrasi Diagram &amp; Grafik Visual Otomatis
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      AI menyertakan diagram IPA, bangun geometri, atau grafik hanya bila relevan
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.enableVisuals}
                    onChange={(e) => updateField('enableVisuals', e.target.checked)}
                    className="h-4 w-4 accent-[#0F294A]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Acak Urutan Soal Otomatis
                  </span>
                  <input
                    type="checkbox"
                    checked={config.shuffleQuestions}
                    onChange={(e) => updateField('shuffleQuestions', e.target.checked)}
                    className="h-4 w-4 accent-[#0F294A]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Acak Pilihan Jawaban ({getOptionRangeLabel(config.optionCount)})
                  </span>
                  <input
                    type="checkbox"
                    checked={config.shuffleOptions}
                    onChange={(e) => updateField('shuffleOptions', e.target.checked)}
                    className="h-4 w-4 accent-[#0F294A]"
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Step 2 Variasi Jenis & Custom Jumlah Soal */}
        <div className="space-y-6 xl:col-span-7">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  02. Variasi Jenis &amp; Custom Jumlah Soal
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gabungkan beberapa bentuk evaluasi dan atur jumlah masing-masing sesuai kebutuhan.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyCountPreset('standard')}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Paket Standar (18)
                </button>
                <button
                  type="button"
                  onClick={() => applyCountPreset('hots')}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Paket HOTS (13)
                </button>
                <button
                  type="button"
                  onClick={() => applyCountPreset('arabic')}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Ujian Madrasah (12)
                </button>
                <button
                  type="button"
                  onClick={() => applyCountPreset('hijaiyah')}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                >
                  Hijaiyah &amp; Kitabah (12)
                </button>
                <button
                  type="button"
                  onClick={() => applyCountPreset('reset')}
                  title="Reset semua jumlah ke 0"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-3 w-3" />
                  Nolkan
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-800/40 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Jumlah Opsi Pilihan Ganda
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pilih rentang huruf opsi jawaban: A–C (3 opsi), A–D (4 opsi), atau A–E (5 opsi)
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {([
                  { count: 3 as const, label: '3 Opsi (A–C)', arLabel: 'أ–ج' },
                  { count: 4 as const, label: '4 Opsi (A–D)', arLabel: 'أ–د' },
                  { count: 5 as const, label: '5 Opsi (A–E)', arLabel: 'أ–هـ' },
                ]).map((opt) => {
                  const activeOpt = (config.optionCount || 5) === opt.count;
                  return (
                    <button
                      key={opt.count}
                      type="button"
                      onClick={() => updateField('optionCount', opt.count)}
                      className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                        activeOpt
                          ? 'border-[#0F294A] bg-[#0F294A] text-white dark:border-blue-500 dark:bg-blue-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ALL_QUESTION_TYPES.map((type) => {
                const meta = QUESTION_TYPE_META[type];
                const count = config.questionCounts[type] || 0;
                const active = count > 0;
                const displayTitle =
                  type === 'pilihan_ganda'
                    ? `Pilihan Ganda (${getOptionRangeLabel(config.optionCount)})`
                    : meta.label;
                const isArabicSpecial =
                  type === 'memisah_hijaiyah' ||
                  type === 'menyambung_hijaiyah' ||
                  type === 'menulis_ulang_kalimat' ||
                  type === 'menebalkan_mewarnai_arab';
                return (
                  <div
                    key={type}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                      active
                        ? 'border-[#0F294A] bg-slate-50/70 dark:border-blue-500 dark:bg-blue-950/20'
                        : isArabicSpecial
                        ? 'border-emerald-200/80 bg-emerald-50/25 dark:border-emerald-900/50 dark:bg-emerald-950/10'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {displayTitle}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {meta.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuestionCount(type, count - 1)}
                        aria-label={`Kurangi ${meta.label}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={count}
                        onChange={(e) => setQuestionCount(type, Number(e.target.value))}
                        aria-label={`Jumlah ${meta.label}`}
                        className="h-9 w-12 rounded-lg border border-slate-200 bg-white text-center font-mono text-sm font-bold tabular-nums text-slate-900 focus:border-[#0F294A] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setQuestionCount(type, count + 1)}
                        aria-label={`Tambah ${meta.label}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Word-Count Configuration for Menulis Ulang Kalimat */}
            {(config.questionCounts.menulis_ulang_kalimat || 0) > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      Pengaturan Panjang Kalimat — Menulis Ulang ({config.questionCounts.menulis_ulang_kalimat} soal)
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-400">
                      Pilih jumlah kata per kalimat (1 kata, 2 kata, 3 kata, dst.) atau bertahap otomatis.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((wc) => {
                      const active =
                        (config.rewriteWordMode || 'progressive') === 'exact' &&
                        (config.rewriteWordCount || 1) === wc;
                      return (
                        <button
                          key={wc}
                          type="button"
                          onClick={() =>
                            onChange({
                              ...config,
                              rewriteWordMode: 'exact',
                              rewriteWordCount: wc,
                            })
                          }
                          className={`min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-[#0F294A] bg-[#0F294A] text-white dark:border-blue-500 dark:bg-blue-600'
                              : 'border-emerald-200 bg-white text-slate-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200'
                          }`}
                        >
                          {wc} Kata
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...config,
                          rewriteWordMode: 'progressive',
                          rewriteWordCount: config.rewriteWordCount || 3,
                        })
                      }
                      className={`min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                        (config.rewriteWordMode || 'progressive') === 'progressive'
                          ? 'border-[#0F294A] bg-[#0F294A] text-white dark:border-blue-500 dark:bg-blue-600'
                          : 'border-emerald-200 bg-white text-slate-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      Bertahap (1, 2, 3+ Kata)
                    </button>
                    <label className="inline-flex items-center gap-1.5 pl-1 text-xs font-medium text-emerald-900 dark:text-emerald-300">
                      <span>Custom:</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={config.rewriteWordCount || 3}
                        onChange={(e) =>
                          onChange({
                            ...config,
                            rewriteWordMode: 'exact',
                            rewriteWordCount: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                          })
                        }
                        className="h-8 w-14 rounded-lg border border-emerald-300 bg-white text-center font-mono text-xs font-bold text-slate-900 dark:border-emerald-700 dark:bg-slate-900 dark:text-white"
                      />
                      <span>kata</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Summary & Primary CTA Bar */}
            <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Total Keseluruhan Soal
                  </p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-[#0F294A] dark:text-blue-400">
                    {totalQuestions} <span className="text-sm font-medium text-slate-600 dark:text-slate-300">butir</span>
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Estimasi Skor Maksimal
                  </p>
                  <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {estimatedTotalPoints} <span className="text-xs font-normal text-slate-500">poin</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isGenerating || !config.title.trim() || totalQuestions === 0}
                onClick={onGenerate}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#0F294A] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#163B69] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sedang Memproses...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    BUAT SOAL OTOMATIS
                  </>
                )}
              </button>
            </div>

            {(!config.title.trim() || totalQuestions === 0) && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                <BookOpen className="mr-1 inline h-3.5 w-3.5" />
                Isi Judul Materi dan pilih minimal 1 soal sebelum menjalankan generator AI.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
