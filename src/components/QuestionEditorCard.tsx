import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Check,
  Edit3,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ALL_QUESTION_TYPES, COGNITIVE_LEVELS, QUESTION_TYPE_META } from '../constants.ts';
import { QuestionItem, QuestionOption, QuestionType } from '../types.ts';
import {
  cleanAsterisks,
  getTextDirection,
  hasArabicText,
  isPureArabicBlock,
} from '../utils/arabic.ts';
import { getSynchronizedMatching } from '../utils/matching.ts';

export type EditorDisplayMode = 'student' | 'teacher' | 'edit';

interface QuestionEditorCardProps {
  question: QuestionItem;
  index: number;
  total: number;
  displayMode: EditorDisplayMode;
  onUpdate: (updated: QuestionItem) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onSaveToBank: () => void;
  onRegenerate: (instruction?: string) => Promise<void>;
  onGenerateVisual: (hint?: string) => Promise<void>;
}

export function QuestionEditorCard({
  question,
  index,
  total,
  displayMode,
  onUpdate,
  onDelete,
  onMove,
  onSaveToBank,
  onRegenerate,
  onGenerateVisual,
}: QuestionEditorCardProps) {
  const [isEditingThis, setIsEditingThis] = useState(false);
  const [showRegenBox, setShowRegenBox] = useState(false);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showVisualBox, setShowVisualBox] = useState(false);
  const [visualHint, setVisualHint] = useState('');
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');

  const editing = displayMode === 'edit' || isEditingThis;
  const cleanPrompt = cleanAsterisks(question.prompt);
  const cleanPassage = cleanAsterisks(question.readingPassage);
  const cleanArabicPrompt = cleanAsterisks(question.arabicPrompt);
  const cleanTranslation = cleanAsterisks(question.readingTranslation);
  const cleanExplanation = cleanAsterisks(question.explanation);
  const cleanDistractor = cleanAsterisks(question.distractorAnalysis);
  const cleanRubric = cleanAsterisks(question.rubric);
  const isArPrompt = question.isArabic || hasArabicText(cleanPrompt);
  const promptDir = getTextDirection(cleanPrompt);
  const passageDir = getTextDirection(cleanPassage);
  const arabicPromptDir = getTextDirection(cleanArabicPrompt);

  const handleRegenSubmit = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate(regenInstruction.trim() || undefined);
      setShowRegenBox(false);
      setRegenInstruction('');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleVisualGenerate = async () => {
    setIsGeneratingVisual(true);
    try {
      await onGenerateVisual(visualHint.trim() || undefined);
      setShowVisualBox(false);
      setVisualHint('');
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      onUpdate({
        ...question,
        visual: {
          imageUrl: dataUrl,
          caption: question.visual?.caption || file.name.replace(/\.[^.]+$/, ''),
          visualType: 'Gambar Unggahan',
        },
      });
      setShowVisualBox(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAttachUrl = () => {
    if (!customImageUrl.trim()) return;
    onUpdate({
      ...question,
      visual: {
        imageUrl: customImageUrl.trim(),
        caption: question.visual?.caption || 'Ilustrasi pendukung soal',
        visualType: 'Gambar Tautan',
      },
    });
    setCustomImageUrl('');
    setShowVisualBox(false);
  };

  const updateMatchingPair = (pairIdx: number, field: 'left' | 'right', value: string) => {
    const nextPairs = [...(question.matchingPairs || [])];
    nextPairs[pairIdx] = { ...nextPairs[pairIdx], [field]: value };
    const sync = getSynchronizedMatching(nextPairs);
    onUpdate({
      ...question,
      matchingPairs: nextPairs,
      correctAnswer: sync.answerKey,
    });
  };

  const addMatchingPair = () => {
    const nextPairs = [
      ...(question.matchingPairs || []),
      { id: String((question.matchingPairs?.length || 0) + 1), left: '', right: '' },
    ];
    const sync = getSynchronizedMatching(nextPairs);
    onUpdate({
      ...question,
      matchingPairs: nextPairs,
      correctAnswer: sync.answerKey,
    });
  };

  const removeMatchingPair = (pairIdx: number) => {
    const nextPairs = (question.matchingPairs || []).filter((_, idx) => idx !== pairIdx);
    const sync = getSynchronizedMatching(nextPairs);
    onUpdate({
      ...question,
      matchingPairs: nextPairs,
      correctAnswer: sync.answerKey,
    });
  };

  const updateOption = (optIdx: number, patch: Partial<QuestionOption>) => {
    const nextOptions = [...(question.options || [])];
    nextOptions[optIdx] = { ...nextOptions[optIdx], ...patch };

    // If single-choice PG or Benar/Salah, ensure only 1 correct when toggling true
    if (
      patch.isCorrect === true &&
      (question.type === 'pilihan_ganda' || question.type === 'benar_salah' || question.type === 'berbasis_gambar' || question.type === 'berbasis_bacaan' || question.type === 'hots')
    ) {
      nextOptions.forEach((o, i) => {
        if (i !== optIdx) o.isCorrect = false;
      });
      onUpdate({
        ...question,
        options: nextOptions,
        correctAnswer: nextOptions[optIdx].label,
      });
      return;
    }

    const correctList = nextOptions.filter((o) => o.isCorrect).map((o) => o.label);
    onUpdate({
      ...question,
      options: nextOptions,
      correctAnswers: question.type === 'pilihan_ganda_kompleks' ? correctList : question.correctAnswers,
      correctAnswer:
        question.type === 'pilihan_ganda_kompleks'
          ? correctList.join(', ')
          : correctList[0] || question.correctAnswer,
    });
  };

  const addOption = () => {
    const current = question.options || [];
    const nextLabel = question.isRTL
      ? ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][current.length] || String(current.length + 1)
      : String.fromCharCode(65 + current.length);
    onUpdate({
      ...question,
      options: [...current, { label: nextLabel, text: '', isCorrect: false }],
    });
  };

  const removeOption = (optIdx: number) => {
    const current = (question.options || []).filter((_, i) => i !== optIdx);
    onUpdate({ ...question, options: current });
  };

  const rawKeyDisplay =
    question.correctAnswers && question.correctAnswers.length > 0
      ? question.correctAnswers.join(', ')
      : question.correctAnswer;
  const keyDisplay = cleanAsterisks(rawKeyDisplay);
  const keyDir = getTextDirection(keyDisplay);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 transition-colors dark:border-slate-800 dark:bg-slate-900">
      {/* Top Quiet Metadata & Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
            Soal {question.number}
          </span>
          <span aria-hidden="true">·</span>
          <span>{QUESTION_TYPE_META[question.type]?.shortLabel || question.type}</span>
          <span aria-hidden="true">·</span>
          <span>{question.cognitiveLevel} ({question.thinkingTier})</span>
          <span aria-hidden="true">·</span>
          <span>{question.difficulty}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{question.weight} poin</span>
          {question.topicTag && (
            <>
              <span aria-hidden="true">·</span>
              <span className="max-w-[200px] truncate">{question.topicTag}</span>
            </>
          )}
        </div>

        {displayMode !== 'student' && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onMove('up')}
              disabled={index === 0}
              title="Naikkan urutan"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove('down')}
              disabled={index === total - 1}
              title="Turunkan urutan"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowVisualBox((v) => !v)}
              title="Tambah atau buat diagram visual"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gambar</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRegenBox((v) => !v)}
              title="Buat ulang soal ini saja dengan AI"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[#0F294A] hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Regenerasi</span>
            </button>
            <button
              type="button"
              onClick={onSaveToBank}
              title="Simpan ke Bank Soal Pribadi"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <BookmarkPlus className="h-4 w-4" />
            </button>
            {displayMode !== 'edit' && (
              <button
                type="button"
                onClick={() => setIsEditingThis((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  isEditingThis
                    ? 'bg-[#0F294A] text-white dark:bg-blue-600'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {isEditingThis ? <Check className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                {isEditingThis ? 'Selesai' : 'Edit'}
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              title="Hapus soal ini"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Inline Regenerate Prompt Drawer */}
      {showRegenBox && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Regenerasi Soal Nomor {question.number} (Tanpa Mengubah Soal Lain)
            </p>
            <button
              type="button"
              onClick={() => setShowRegenBox(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={regenInstruction}
              onChange={(e) => setRegenInstruction(e.target.value)}
              placeholder="Arahan opsional (misal: buat lebih HOTS, ganti contoh ayat, tambah diagram)..."
              className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="button"
              disabled={isRegenerating}
              onClick={handleRegenSubmit}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#0F294A] px-4 text-xs font-semibold text-white hover:bg-[#163B69] disabled:opacity-50 dark:bg-blue-600"
            >
              {isRegenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isRegenerating ? 'Membuat ulang...' : 'Buat Ulang Soal'}
            </button>
          </div>
        </div>
      )}

      {/* Inline Visual / Diagram Management Drawer */}
      {showVisualBox && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Tambahkan Gambar Manual atau Buat Diagram SVG dengan AI
            </p>
            <button
              type="button"
              onClick={() => setShowVisualBox(false)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                1. Buat Diagram Edukasi Otomatis (AI SVG)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={visualHint}
                  onChange={(e) => setVisualHint(e.target.value)}
                  placeholder="Contoh: Segitiga siku-siku ABC sudut 30°..."
                  className="min-h-[38px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={isGeneratingVisual}
                  onClick={handleVisualGenerate}
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-lg bg-[#0F294A] px-3 text-xs font-semibold text-white hover:bg-[#163B69] disabled:opacity-50 dark:bg-blue-600"
                >
                  {isGeneratingVisual ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Buat Diagram
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                2. Unggah Gambar Sendiri / Tempel URL
              </p>
              <div className="flex gap-2">
                <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                  <Upload className="h-3.5 w-3.5" />
                  Pilih File
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                <input
                  type="url"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="min-h-[38px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAttachUrl}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  Pakai
                </button>
              </div>
            </div>
          </div>
          {question.visual && (
            <button
              type="button"
              onClick={() => onUpdate({ ...question, visual: null })}
              className="mt-2.5 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Hapus gambar/diagram dari soal ini
            </button>
          )}
        </div>
      )}

      {/* Body Content */}
      {editing ? (
        <div className="mt-4 space-y-4">
          {/* Type, Difficulty, Cognitive, Weight, RTL */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Jenis Soal
              </label>
              <select
                value={question.type}
                onChange={(e) => onUpdate({ ...question, type: e.target.value as QuestionType })}
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {ALL_QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Kognitif
              </label>
              <select
                value={question.cognitiveLevel}
                onChange={(e) =>
                  onUpdate({
                    ...question,
                    cognitiveLevel: e.target.value as QuestionItem['cognitiveLevel'],
                  })
                }
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {COGNITIVE_LEVELS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Bobot Nilai
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={question.weight}
                onChange={(e) =>
                  onUpdate({ ...question, weight: Math.max(1, Number(e.target.value) || 1) })
                }
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <label className="flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <span>Font Arab</span>
                <input
                  type="checkbox"
                  checked={question.isArabic}
                  onChange={(e) =>
                    onUpdate({ ...question, isArabic: e.target.checked, isRTL: false })
                  }
                  className="h-4 w-4 accent-[#0F294A]"
                />
              </label>
            </div>
          </div>

          {/* Reading Passage */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Teks Bacaan / Kutipan Arab / Kasus (Opsional)
            </label>
            <textarea
              rows={2}
              dir={passageDir}
              value={question.readingPassage || ''}
              onChange={(e) => onUpdate({ ...question, readingPassage: e.target.value })}
              className={`w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                passageDir === 'rtl' ? 'text-right' : 'text-left'
              } ${hasArabicText(question.readingPassage) ? 'font-arabic text-base' : ''}`}
            />
          </div>

          {/* Main Prompt */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Teks Pertanyaan
            </label>
            <textarea
              rows={3}
              dir={promptDir}
              value={question.prompt}
              onChange={(e) => onUpdate({ ...question, prompt: e.target.value })}
              className={`w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                promptDir === 'rtl' ? 'text-right' : 'text-left'
              } ${isArPrompt ? 'font-arabic text-lg' : ''}`}
            />
          </div>

          {(question.type === 'menebalkan_mewarnai_arab' ||
            question.type === 'memisah_hijaiyah' ||
            question.type === 'menyambung_hijaiyah' ||
            question.type === 'menulis_ulang_kalimat' ||
            question.arabicPrompt) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Kata / Kalimat Arab Sasaran (Berharakat)
                </label>
                <input
                  type="text"
                  dir={getTextDirection(question.arabicPrompt)}
                  value={question.arabicPrompt || ''}
                  onChange={(e) => onUpdate({ ...question, arabicPrompt: e.target.value })}
                  placeholder="Contoh: مَدْرَسَةٌ جَمِيلَةٌ"
                  className={`font-arabic min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-lg text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                    isPureArabicBlock(question.arabicPrompt) ? 'text-right' : 'text-left'
                  }`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Arti / Terjemahan (Opsional)
                </label>
                <input
                  type="text"
                  value={question.readingTranslation || ''}
                  onChange={(e) =>
                    onUpdate({ ...question, readingTranslation: e.target.value })
                  }
                  placeholder="Contoh: Sekolah yang indah"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Visual Preview inside Edit */}
          {question.visual && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              {question.visual.svgMarkup && (
                <div
                  className="mx-auto max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white"
                  dangerouslySetInnerHTML={{ __html: question.visual.svgMarkup }}
                />
              )}
              {question.visual.imageUrl && (
                <img
                  src={question.visual.imageUrl}
                  alt={question.visual.caption}
                  referrerPolicy="no-referrer"
                  className="mx-auto max-h-64 rounded-lg border border-slate-200 object-contain"
                />
              )}
              <input
                type="text"
                value={question.visual.caption}
                onChange={(e) =>
                  onUpdate({
                    ...question,
                    visual: { ...question.visual!, caption: e.target.value },
                  })
                }
                placeholder="Keterangan gambar..."
                className="mt-2 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          )}

          {/* Options Editor */}
          {question.options && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Pilihan Jawaban (Centang jawaban benar)
                </label>
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F294A] hover:underline dark:text-blue-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Opsi
                </button>
              </div>
              {question.options.map((opt, optIdx) => {
                const optAr = hasArabicText(opt.text);
                return (
                  <div key={optIdx} className="flex items-center gap-2">
                    <input
                      type={question.type === 'pilihan_ganda_kompleks' ? 'checkbox' : 'radio'}
                      name={`correct_${question.id}`}
                      checked={opt.isCorrect}
                      onChange={(e) => updateOption(optIdx, { isCorrect: e.target.checked })}
                      aria-label={`Tandai ${opt.label} benar`}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateOption(optIdx, { label: e.target.value })}
                      className="h-9 w-11 rounded-lg border border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      dir={getTextDirection(opt.text)}
                      value={opt.text}
                      onChange={(e) => updateOption(optIdx, { text: e.target.value })}
                      className={`h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                        isPureArabicBlock(opt.text) ? 'text-right' : 'text-left'
                      } ${optAr ? 'font-arabic text-base' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(optIdx)}
                      aria-label="Hapus opsi"
                      className="rounded p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Matching Pairs Editor */}
          {(question.type === 'menjodohkan' ||
            (question.matchingPairs && question.matchingPairs.length > 0)) && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Pasangan Menjodohkan (Kolom Kiri ↔ Pasangan Benar)
                </label>
                <button
                  type="button"
                  onClick={addMatchingPair}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F294A] hover:underline dark:text-blue-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Pasangan
                </button>
              </div>
              {(question.matchingPairs || []).map((pair, pairIdx) => (
                <div key={pair.id || pairIdx} className="grid grid-cols-1 gap-2 sm:grid-cols-[28px_1fr_1fr_32px] sm:items-center">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {pairIdx + 1}.
                  </span>
                  <input
                    type="text"
                    dir="ltr"
                    value={pair.left}
                    onChange={(e) => updateMatchingPair(pairIdx, 'left', e.target.value)}
                    placeholder={`Item kiri ${pairIdx + 1}...`}
                    className={`h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${
                      hasArabicText(pair.left) ? 'font-arabic text-base' : ''
                    }`}
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={pair.right}
                    onChange={(e) => updateMatchingPair(pairIdx, 'right', e.target.value)}
                    placeholder={`Pasangan benar ${pairIdx + 1}...`}
                    className={`h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${
                      hasArabicText(pair.right) ? 'font-arabic text-base' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => removeMatchingPair(pairIdx)}
                    aria-label="Hapus pasangan"
                    className="rounded p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Answer Key, Explanation, Rubric */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                Kunci Jawaban
              </label>
              <textarea
                rows={2}
                dir={keyDir}
                value={question.correctAnswer}
                onChange={(e) => onUpdate({ ...question, correctAnswer: e.target.value })}
                className={`w-full rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5 text-xs text-slate-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-white ${
                  keyDir === 'rtl' ? 'text-right' : 'text-left'
                } ${hasArabicText(question.correctAnswer) ? 'font-arabic text-base' : ''}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Pembahasan Mendidik
              </label>
              <textarea
                rows={2}
                value={question.explanation}
                onChange={(e) => onUpdate({ ...question, explanation: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {(['esai', 'studi_kasus', 'analisis_teks'].includes(question.type) || question.rubric) && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Pedoman Penilaian / Rubrik Skor
              </label>
              <textarea
                rows={2}
                value={question.rubric || ''}
                onChange={(e) => onUpdate({ ...question, rubric: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          {/* Kurikulum Merdeka Kisi-Kisi Fields */}
          <div className="space-y-2 rounded-lg border border-blue-200/70 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F294A] dark:text-blue-300">
              Kisi-Kisi Kurikulum Merdeka (Opsional — Terisi Otomatis Jika Kosong)
            </p>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Tujuan Pembelajaran (TP)
                </label>
                <textarea
                  rows={2}
                  value={question.tujuanPembelajaran || ''}
                  onChange={(e) =>
                    onUpdate({ ...question, tujuanPembelajaran: e.target.value })
                  }
                  placeholder="Peserta didik mampu..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Indikator Soal
                </label>
                <textarea
                  rows={2}
                  value={question.indikatorSoal || ''}
                  onChange={(e) =>
                    onUpdate({ ...question, indikatorSoal: e.target.value })
                  }
                  placeholder="Disajikan ..., peserta didik dapat ..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Clean Reading View (Student or Teacher) */
        <div className="mt-4 space-y-3">
          {cleanPassage && (
            <div
              dir={passageDir}
              className={`rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 ${
                passageDir === 'rtl' ? 'text-right' : 'text-left'
              } ${hasArabicText(cleanPassage) ? 'font-arabic text-lg leading-loose' : 'text-sm leading-relaxed'}`}
            >
              <p className="whitespace-pre-line">{cleanPassage}</p>
              {cleanTranslation && displayMode === 'teacher' && (
                <p
                  dir="ltr"
                  className="mt-2 border-t border-dashed border-slate-300 pt-2 text-left text-xs italic text-slate-600 dark:border-slate-700 dark:text-slate-400"
                >
                  Terjemahan: {cleanTranslation}
                </p>
              )}
            </div>
          )}

          {/* Main Prompt */}
          <div
            dir={promptDir}
            className={`text-slate-900 dark:text-white ${
              promptDir === 'rtl' ? 'text-right' : 'text-left'
            } ${isArPrompt ? 'font-arabic text-xl font-normal leading-loose' : 'text-[15px] font-medium leading-relaxed'}`}
          >
            {cleanPrompt}
          </div>

          {cleanArabicPrompt && question.type !== 'menebalkan_mewarnai_arab' && (
            <div
              dir={arabicPromptDir}
              className={`font-arabic text-xl leading-loose text-slate-900 dark:text-white ${
                arabicPromptDir === 'rtl' ? 'text-right' : 'text-left'
              }`}
            >
              {cleanArabicPrompt}
            </div>
          )}

          {/* Visual / Diagram */}
          {question.visual && (question.visual.svgMarkup || question.visual.imageUrl) && (
            <div className="my-3 flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              {question.visual.svgMarkup ? (
                <div
                  className="max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                  dangerouslySetInnerHTML={{ __html: question.visual.svgMarkup }}
                />
              ) : question.visual.imageUrl ? (
                <img
                  src={question.visual.imageUrl}
                  alt={question.visual.caption}
                  referrerPolicy="no-referrer"
                  className="max-h-72 rounded-lg object-contain"
                />
              ) : null}
              {question.visual.caption && (
                <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                  {cleanAsterisks(question.visual.caption)}
                </p>
              )}
            </div>
          )}

          {/* Options */}
          {question.options && question.options.length > 0 && (
            <div className="space-y-2 pt-1">
              {question.options.map((opt, oIdx) => {
                const optTextClean = cleanAsterisks(opt.text);
                const optAr = hasArabicText(optTextClean);
                const optPureAr = isPureArabicBlock(optTextClean);
                const rowIsRtl =
                  isPureArabicBlock(`${opt.label} ${optTextClean}`) ||
                  (promptDir === 'rtl' && optPureAr);
                const highlightCorrect = displayMode === 'teacher' && opt.isCorrect;
                return (
                  <div
                    key={oIdx}
                    dir={rowIsRtl ? 'rtl' : 'ltr'}
                    className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${
                      rowIsRtl ? 'text-right' : 'text-left'
                    } ${
                      highlightCorrect
                        ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <span className="shrink-0 font-bold">{cleanAsterisks(opt.label)}.</span>
                    <span
                      dir={optPureAr ? 'rtl' : 'ltr'}
                      style={optPureAr && !rowIsRtl ? { unicodeBidi: 'isolate' } : undefined}
                      className={`flex-1 ${rowIsRtl ? 'text-right' : 'text-left'} ${
                        optAr ? 'font-arabic text-lg leading-loose' : ''
                      }`}
                    >
                      {optTextClean}
                    </span>
                    {highlightCorrect && (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Matching Pairs */}
          {question.type === 'menjodohkan' &&
            question.matchingPairs &&
            question.matchingPairs.length > 0 &&
            (() => {
              const sync = getSynchronizedMatching(question.matchingPairs);
              const lastLetter =
                sync.rightOptions[sync.rightOptions.length - 1]?.letter || 'D';
              return (
                <div
                  dir="ltr"
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-left dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="rounded-lg border border-blue-200/80 bg-blue-50/70 px-3 py-2 text-xs font-medium text-slate-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-slate-300">
                    Pasangkan setiap item pada <strong>Kolom Kiri (1–{sync.rows.length})</strong> dengan pasangan yang tepat pada <strong>Pilihan Kanan (A–{lastLetter})</strong>, lalu tuliskan huruf &amp; pasangan jawabannya pada kotak isian yang luas di bawah ini.
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Kolom Kiri (1–{sync.rows.length})
                      </div>
                      <div className="space-y-2">
                        {sync.rows.map((row) => (
                          <div
                            key={row.number}
                            className={`flex items-start gap-2 border-b border-dashed border-slate-200 pb-1.5 text-sm last:border-none last:pb-0 dark:border-slate-800 ${
                              hasArabicText(row.left) ? 'font-arabic text-lg leading-loose' : ''
                            }`}
                          >
                            <span className="shrink-0 font-mono text-xs font-bold text-[#0F294A] dark:text-blue-400">
                              {row.number}.
                            </span>
                            <span className="text-slate-800 dark:text-slate-200">{row.left}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Pilihan Kanan (A–{lastLetter})
                      </div>
                      <div className="space-y-2">
                        {sync.rightOptions.map((opt) => (
                          <div
                            key={opt.letter}
                            className={`flex items-start gap-2 border-b border-dashed border-slate-200 pb-1.5 text-sm last:border-none last:pb-0 dark:border-slate-800 ${
                              hasArabicText(opt.text) ? 'font-arabic text-lg leading-loose' : ''
                            }`}
                          >
                            <span className="shrink-0 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              {opt.letter}.
                            </span>
                            <span className="text-slate-800 dark:text-slate-200">{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Kotak Isian Jawaban Siswa:
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {sync.rows.map((row) => (
                        <div
                          key={row.number}
                          className="rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-900"
                        >
                          <div className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Jawaban No. {row.number} ({row.left.slice(0, 32)}
                            {row.left.length > 32 ? '…' : ''})
                          </div>
                          <div
                            className={`flex min-h-[52px] w-full items-center rounded-md border border-dashed px-3 py-2 text-left text-sm ${
                              displayMode === 'teacher'
                                ? 'border-emerald-400 bg-emerald-50/70 font-semibold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                                : 'border-slate-300 bg-slate-50/50 text-slate-400 dark:border-slate-700 dark:bg-slate-950/40'
                            } ${
                              displayMode === 'teacher' && hasArabicText(row.correctRight)
                                ? 'font-arabic text-lg'
                                : ''
                            }`}
                          >
                            {displayMode === 'teacher'
                              ? `${row.correctLetter} — ${row.correctRight}`
                              : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Ordering / Sequencing */}
          {question.type === 'mengurutkan' && question.sequenceItems && question.sequenceItems.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/40">
              {(displayMode === 'teacher'
                ? question.sequenceItems
                : [...question.sequenceItems].sort((a, b) => a.localeCompare(b))
              ).map((item, sIdx) => (
                <div key={sIdx} className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    {displayMode === 'teacher' ? `${sIdx + 1}.` : '[   ]'}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Hijaiyah Separation / Joining & Sentence Rewrite Student Workspace */}
          {(question.type === 'memisah_hijaiyah' ||
            question.type === 'menyambung_hijaiyah' ||
            question.type === 'menulis_ulang_kalimat') && (
            <div
              dir="ltr"
              className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3.5 text-left text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400"
            >
              {question.type === 'memisah_hijaiyah' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Jawaban Pisah Huruf:</span>
                  <div className="flex flex-wrap items-center gap-1.5 font-arabic text-base">
                    {[1, 2, 3, 4, 5].map((box) => (
                      <span
                        key={box}
                        className="inline-block h-8 w-10 rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                      />
                    ))}
                  </div>
                </div>
              )}
              {question.type === 'menyambung_hijaiyah' && (
                <div className="space-y-2">
                  <span className="font-semibold">Tuliskan Kata Sambung:</span>
                  <div className="h-9 w-full rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900" />
                </div>
              )}
              {question.type === 'menulis_ulang_kalimat' && (
                <div className="space-y-2.5">
                  <span className="font-semibold">Tuliskan Kembali dengan Rapi:</span>
                  <div className="border-b-2 border-dotted border-slate-300 pt-5 dark:border-slate-600" />
                  <div className="border-b-2 border-dotted border-slate-300 pt-5 dark:border-slate-600" />
                </div>
              )}
            </div>
          )}

          {/* Arabic Tracing Line & Coloring Large Worksheet (A4 · 2 Soal/Halaman) */}
          {question.type === 'menebalkan_mewarnai_arab' && (
            <div
              dir="ltr"
              className="arabic-a4-big-card space-y-3 text-left dark:border-slate-700 dark:bg-slate-950/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F294A] dark:text-blue-300">
                  Lembar Kerja Besar A4 (Maks. 2 Soal / Halaman)
                </span>
                {question.readingTranslation && (
                  <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    Arti: {question.readingTranslation}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  1. Tebalkan Garis Kata / Kalimat Arab Berikut (التَّتَبُّعُ):
                </div>
                <div className="arabic-khat-guides flex min-h-[115px] items-center justify-center rounded-lg bg-white/95 px-4 py-2 text-center">
                  <span dir="rtl" className="arabic-trace-text select-none">
                    {question.arabicPrompt || question.readingPassage || question.correctAnswer}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border-2 border-slate-300 bg-white p-3 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  <span>2. Warnailah Kata / Kalimat Arab Berikut (التَّلْوِينُ):</span>
                  <span className="text-[10px] font-medium text-slate-500">
                    Gunakan pensil warna / krayon
                  </span>
                </div>
                <div className="flex min-h-[135px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-4 py-2 text-center">
                  <span dir="rtl" className="arabic-color-text select-none">
                    {question.arabicPrompt || question.readingPassage || question.correctAnswer}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Teacher Mode: Separated Answer Key, Explanation, Distractor Analysis & Rubric */}
          {displayMode === 'teacher' && (
            <div className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className={keyDir === 'rtl' ? 'flex flex-wrap items-center justify-between gap-2' : ''}>
                <span className="font-bold text-emerald-900 dark:text-emerald-300">
                  Kunci Jawaban:{' '}
                </span>
                <span
                  dir={keyDir}
                  className={`font-semibold text-emerald-800 dark:text-emerald-200 ${
                    keyDir === 'rtl' ? 'inline-block text-right' : 'text-left'
                  } ${hasArabicText(keyDisplay) ? 'font-arabic text-base' : ''}`}
                >
                  {keyDisplay}
                </span>
              </div>
              {cleanExplanation && (
                <p
                  dir={getTextDirection(cleanExplanation)}
                  className={`leading-relaxed text-slate-700 dark:text-slate-300 ${
                    isPureArabicBlock(cleanExplanation) ? 'font-arabic text-right text-sm' : 'text-left'
                  }`}
                >
                  <strong className="text-slate-900 dark:text-white">Pembahasan: </strong>
                  {cleanExplanation}
                </p>
              )}
              {cleanDistractor && (
                <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-800 dark:text-slate-200">Analisis Pengecoh: </strong>
                  {cleanDistractor}
                </p>
              )}
              {cleanRubric && (
                <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white">Pedoman Penilaian / Rubrik: </strong>
                  {cleanRubric}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
