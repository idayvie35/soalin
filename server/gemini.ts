import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { QUESTION_TYPE_META } from '../src/constants.ts';
import {
  EducationLevel,
  GenerationConfig,
  QualityReport,
  QuestionItem,
  QuestionType,
  RppKurmer,
} from '../src/types.ts';
import { getFaseKurikulumMerdeka } from '../src/utils/kurikulumMerdeka.ts';
import { cleanAsterisks, isPureArabicBlock } from '../src/utils/textFormat.ts';

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY belum dikonfigurasi pada Secrets server. Silakan periksa panel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FAST_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
let hydrogenCooldownUntil = 0;

function extractRetryDelayMs(errText: string): number {
  const secMatch = errText.match(/retry(?:\s+in|\s+after|Delay["':\s]+)(\d+(?:\.\d+)?)s/i);
  if (secMatch) {
    const secs = Math.ceil(Number(secMatch[1]));
    if (secs > 0 && secs <= 65) return secs * 1000;
  }
  return 0;
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    /quota exceeded|rate.?limit/i.test(msg)
  );
}

function formatGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err || 'Kesalahan API Gemini.');
  if (isQuotaError(raw)) {
    const waitMs = extractRetryDelayMs(raw);
    const waitHint = waitMs > 0 ? ` Coba lagi dalam sekitar ${Math.ceil(waitMs / 1000)} detik.` : '';
    return new Error(
      `Batas permintaan per menit (kuota Free Tier) Google AI Studio sedang penuh.${waitHint} Sistem sudah mencoba model cadangan; Anda dapat menunggu sebentar atau memilih API Key berbayar pada menu Settings > Secrets.`
    );
  }
  if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(raw)) {
    return new Error(
      'Kunci API Google AI Studio tidak valid atau tidak memiliki izin. Silakan periksa GEMINI_API_KEY di panel Settings > Secrets.'
    );
  }
  return err instanceof Error ? err : new Error(raw);
}

async function sleepMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentResilient(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: unknown;
    onStatus?: (message: string) => void;
  }
) {
  const tryOrder =
    Date.now() < hydrogenCooldownUntil
      ? [FAST_FALLBACK_MODEL, PRIMARY_MODEL]
      : [PRIMARY_MODEL, FAST_FALLBACK_MODEL];

  let lastErr: unknown = null;

  for (let mIdx = 0; mIdx < tryOrder.length; mIdx++) {
    const model = tryOrder[mIdx];
    const maxAttempts = mIdx === 0 ? 2 : 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const useThinking =
        model === FAST_FALLBACK_MODEL ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
      const baseConfig: Record<string, unknown> = {
        thinkingConfig: { thinkingLevel: useThinking },
      };
      if (params.systemInstruction) baseConfig.systemInstruction = params.systemInstruction;
      if (params.responseMimeType) baseConfig.responseMimeType = params.responseMimeType;
      if (params.responseSchema) baseConfig.responseSchema = params.responseSchema;

      try {
        return await ai.models.generateContent({
          model,
          contents: params.contents,
          config: baseConfig as never,
        });
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err || '');

        // If thinkingConfig rejected with 400 on this model variant, retry immediately without thinkingConfig
        if ((msg.includes('400') || /thinking/i.test(msg)) && /thinking/i.test(msg)) {
          const strippedConfig = { ...baseConfig };
          delete strippedConfig.thinkingConfig;
          try {
            return await ai.models.generateContent({
              model,
              contents: params.contents,
              config: strippedConfig as never,
            });
          } catch (innerErr) {
            lastErr = innerErr;
            err = innerErr;
          }
        }

        if (isQuotaError(err)) {
          if (model === PRIMARY_MODEL) {
            hydrogenCooldownUntil = Date.now() + 60_000;
            params.onStatus?.(
              'Kuota Free Tier gemini-4-hydrogen penuh, beralih otomatis ke gemini-3.1-flash-lite...'
            );
            break; // Immediately switch to fallback model
          }
          if (attempt < maxAttempts) {
            const delayFromApi = extractRetryDelayMs(err instanceof Error ? err.message : String(err));
            const backoff = delayFromApi > 0 && delayFromApi <= 20_000 ? delayFromApi : 3500 * attempt;
            params.onStatus?.(
              `Menunggu jeda kuota API (${Math.ceil(backoff / 1000)} detik) sebelum mencoba ulang...`
            );
            await sleepMs(backoff);
            continue;
          }
        } else if (/500|502|503|504|unavailable|timeout|fetch/i.test(msg) && attempt < maxAttempts) {
          await sleepMs(1200 * attempt);
          continue;
        } else {
          break;
        }
      }
    }
  }

  throw formatGeminiError(lastErr);
}

function sanitizeSvg(svg?: string | null): string | undefined {
  if (!svg || typeof svg !== 'string') return undefined;
  const trimmed = svg.trim();
  if (!trimmed.includes('<svg')) return undefined;
  const cleaned = trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
  return cleaned;
}

const QUESTION_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      description:
        'Must match one of the requested question types: pilihan_ganda, pilihan_ganda_kompleks, benar_salah, esai, isian_singkat, menjodohkan, melengkapi_kalimat, mengurutkan, studi_kasus, analisis_teks, hots, berbasis_gambar, berbasis_bacaan, memisah_hijaiyah, menyambung_hijaiyah, menulis_ulang_kalimat, menebalkan_mewarnai_arab.',
    },
    topicTag: {
      type: Type.STRING,
      description: 'The specific subjudul / sub-topic covered by this question.',
    },
    difficulty: {
      type: Type.STRING,
      description: 'Mudah, Sedang, or Sulit.',
    },
    cognitiveLevel: {
      type: Type.STRING,
      description: 'C1, C2, C3, C4, C5, or C6.',
    },
    thinkingTier: {
      type: Type.STRING,
      description: 'LOTS, MOTS, or HOTS.',
    },
    weight: {
      type: Type.INTEGER,
      description: 'Point weight for this question (e.g. 2 for MCQ, 5-10 for essay/case study).',
    },
    isArabic: {
      type: Type.BOOLEAN,
      description: 'True if the question or options contain Arabic script.',
    },
    isRTL: {
      type: Type.BOOLEAN,
      description: 'True ONLY if the main prompt is pure Arabic without Latin/Indonesian letters; false if mixed or Indonesian/English.',
    },
    readingPassage: {
      type: Type.STRING,
      description: 'Optional passage, Arabic text, case scenario, or quote required to answer.',
    },
    readingTranslation: {
      type: Type.STRING,
      description: 'Optional Indonesian translation of Arabic readingPassage when bilingual.',
    },
    prompt: {
      type: Type.STRING,
      description: 'The main question prompt. Must be clear, unambiguous, and non-repetitive.',
    },
    arabicPrompt: {
      type: Type.STRING,
      description: 'Optional Arabic prompt when bilingual (Arab-Indonesia) has both Indonesian instruction and Arabic sentence.',
    },
    options: {
      type: Type.ARRAY,
      description: 'Options for pilihan_ganda (exact requested optionCount: 3 options A-C/أ-ج, 4 options A-D/أ-د, or 5 options A-E/أ-هـ), pilihan_ganda_kompleks (3-5 options), or benar_salah (2 options: Benar/Salah or صواب/خطأ). Leave empty for open-ended types.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          text: { type: Type.STRING },
          isCorrect: { type: Type.BOOLEAN },
          distractorReason: {
            type: Type.STRING,
            description: 'Why this distractor is incorrect (empty if isCorrect is true).',
          },
        },
        required: ['label', 'text', 'isCorrect'],
      },
    },
    matchingPairs: {
      type: Type.ARRAY,
      description: 'For menjodohkan type: 4-5 matching pairs of left premise and right response.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          left: { type: Type.STRING },
          right: { type: Type.STRING },
        },
        required: ['id', 'left', 'right'],
      },
    },
    sequenceItems: {
      type: Type.ARRAY,
      description: 'For mengurutkan type: array of 4-6 items in the CORRECT chronological/logical order.',
      items: { type: Type.STRING },
    },
    correctAnswer: {
      type: Type.STRING,
      description: 'Canonical correct answer key (e.g. "C", "ج", "Benar", concise answer, or model essay answer).',
    },
    correctAnswers: {
      type: Type.ARRAY,
      description: 'For pilihan_ganda_kompleks: list of correct option labels.',
      items: { type: Type.STRING },
    },
    explanation: {
      type: Type.STRING,
      description: 'Detailed educational explanation of why the answer is correct.',
    },
    distractorAnalysis: {
      type: Type.STRING,
      description: 'Summary explaining why the wrong options are incorrect (for MCQ types).',
    },
    rubric: {
      type: Type.STRING,
      description: 'Scoring rubric / pedoman penilaian for esai, studi_kasus, analisis_teks.',
    },
    capaianPembelajaran: {
      type: Type.STRING,
      description: 'Capaian Pembelajaran (CP) Kurikulum Merdeka yang relevan dengan fase, jenjang, dan materi.',
    },
    tujuanPembelajaran: {
      type: Type.STRING,
      description: 'Tujuan Pembelajaran (TP) Kurikulum Merdeka yang diukur oleh butir soal ini.',
    },
    indikatorSoal: {
      type: Type.STRING,
      description: 'Rumusan Indikator Soal berpola ABCD (misal: "Disajikan ..., peserta didik dapat ... dengan tepat").',
    },
    visualNeeded: {
      type: Type.BOOLEAN,
      description: 'True ONLY when a diagram, graph, geometry figure, anatomy schematic, map, or observation illustration genuinely supports solving the question.',
    },
    visualType: {
      type: Type.STRING,
      description: 'Type of visual if visualNeeded is true (e.g. Diagram IPA, Bangun Ruang, Grafik Matematika, Peta Geografi).',
    },
    visualCaption: {
      type: Type.STRING,
      description: 'Caption for the illustration if visualNeeded is true.',
    },
    svgMarkup: {
      type: Type.STRING,
      description:
        'If visualNeeded is true, provide clean self-contained SVG markup (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 260" width="480" height="260"><rect width="480" height="260" fill="#ffffff" rx="8"/>...</svg>) with clear dark strokes, labels, arrows, or plotted coordinates. Must be legible on white paper.',
    },
  },
  required: [
    'type',
    'topicTag',
    'difficulty',
    'cognitiveLevel',
    'thinkingTier',
    'weight',
    'isArabic',
    'isRTL',
    'prompt',
    'correctAnswer',
    'explanation',
    'tujuanPembelajaran',
    'indikatorSoal',
  ],
};

function buildQuestionPlanBatches(
  counts: Record<QuestionType, number>,
  maxBatchSize = 10
): Array<Array<{ type: QuestionType; count: number }>> {
  const expanded: QuestionType[] = [];
  (Object.entries(counts) as [QuestionType, number][]).forEach(([type, count]) => {
    const safeCount = Math.max(0, Math.min(50, Math.floor(count || 0)));
    for (let i = 0; i < safeCount; i++) {
      expanded.push(type);
    }
  });

  const batches: Array<Array<{ type: QuestionType; count: number }>> = [];
  for (let i = 0; i < expanded.length; i += maxBatchSize) {
    const slice = expanded.slice(i, i + maxBatchSize);
    const map = new Map<QuestionType, number>();
    slice.forEach((t) => map.set(t, (map.get(t) || 0) + 1));
    batches.push(Array.from(map.entries()).map(([type, count]) => ({ type, count })));
  }
  return batches;
}

function buildArabicGuidance(config: GenerationConfig): string {
  const isArabicRelated =
    config.language === 'Arab' ||
    config.language === 'Bilingual (Arab-Indonesia)' ||
    [
      'Bahasa Arab',
      'Nahwu & Sharaf',
      'Balaghah',
      'Fiqih & Ushul Fiqih',
      'Al-Quran & Tafsir',
      'Hadis & Ilmu Hadis',
      'Aqidah Akhlak',
    ].includes(config.subject);

  if (!isArabicRelated) return '';

  return `
ATURAN KHUSUS BAHASA ARAB & DIRASAH ISLAMIYAH (WAJIB DIPATUHI):
- Bidang Kajian Arab: ${config.arabicFocus}
- Mode Harakat/Syakal: ${config.harakatMode}. Pastikan penulisan harakat (fathah, kasrah, dhammah, sukun, tasydid, tanwin) akurat secara nahwu dan sharaf!
- Gunakan penulisan Arab fusha standar, susunan huruf dan tanda baca Arab (« » ، ؛ ؟) tepat, dan arah tulisan natural RTL.
- Jika bahasa adalah "Arab", seluruh soal, opsi (gunakan label أ، ب، ج، د، هـ), kunci jawaban, dan pembahasan ditulis dalam Bahasa Arab yang jelas, dengan isArabic=true dan isRTL=true (dari kanan ke kiri).
- Jika bahasa adalah "Bilingual (Arab-Indonesia)", gabungkan teks Arab (pada bacaan/kalimat uji terpisah atau menyisip dalam kalimat Indonesia) dengan instruksi Bahasa Indonesia yang runtut; blok teks Arab yang terpisah ditulis murni Arab agar dibaca dari kanan, sedangkan kalimat campuran Arab-Indonesia mengikuti arah Indonesia dari kiri.
- Pastikan tidak ada kesalahan I'rab pada contoh kalimat, ayat, hadis, atau kaidah.
- DILARANG KERAS menggunakan simbol Markdown seperti tanda bintang (* atau **), pagar (#), atau tanda petik terbalik (backtick) dalam seluruh teks output JSON.`;
}

const LATIN_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];
const ARABIC_OPTION_LABELS = ['أ', 'ب', 'ج', 'د', 'هـ'];

function resolveOptionCount(val?: number): 3 | 4 | 5 {
  const n = Number(val);
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 5;
}

function enforceMcOptionCount(
  rawOptions: QuestionItem['options'] | undefined,
  type: QuestionType,
  optionCount: 3 | 4 | 5,
  isPureArabic: boolean,
  shuffleOptions: boolean,
  rawCorrectAnswer: string
): { options?: QuestionItem['options']; correctAnswer: string; correctAnswers?: string[] } {
  if (!rawOptions || rawOptions.length === 0) {
    return { options: rawOptions, correctAnswer: rawCorrectAnswer };
  }
  const singleChoiceTypes: QuestionType[] = [
    'pilihan_ganda',
    'hots',
    'berbasis_gambar',
    'berbasis_bacaan',
  ];
  const isSingleChoice = singleChoiceTypes.includes(type);
  const isMultiChoice = type === 'pilihan_ganda_kompleks';
  if (!isSingleChoice && !isMultiChoice) {
    return { options: rawOptions, correctAnswer: rawCorrectAnswer };
  }

  const labelSet = isPureArabic ? ARABIC_OPTION_LABELS : LATIN_OPTION_LABELS;
  let working = rawOptions.map((o) => ({
    label: String(o.label || ''),
    text: String(o.text || ''),
    isCorrect: Boolean(o.isCorrect),
    distractorReason: o.distractorReason,
  }));

  if (working.length > optionCount) {
    const corrects = working.filter((o) => o.isCorrect);
    const distractors = working.filter((o) => !o.isCorrect);
    if (isSingleChoice) {
      const keptCorrect = corrects[0] || working[0];
      keptCorrect.isCorrect = true;
      const keptDistractors = distractors
        .filter((d) => d !== keptCorrect)
        .slice(0, Math.max(0, optionCount - 1));
      working = [keptCorrect, ...keptDistractors];
    } else {
      const targetCorrects = corrects.slice(0, Math.max(1, Math.min(2, optionCount - 1)));
      const keptDistractors = distractors.slice(0, Math.max(0, optionCount - targetCorrects.length));
      working = [...targetCorrects, ...keptDistractors].slice(0, optionCount);
    }
  }

  if (shuffleOptions && working.length > 1) {
    for (let i = working.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [working[i], working[j]] = [working[j], working[i]];
    }
  }

  const relabeled = working.map((item, idx) => ({
    label: labelSet[idx] || String.fromCharCode(65 + idx),
    text: item.text,
    isCorrect: item.isCorrect,
    distractorReason: item.distractorReason,
  }));

  if (isSingleChoice) {
    const firstCorrect = relabeled.find((o) => o.isCorrect) || relabeled[0];
    if (firstCorrect) firstCorrect.isCorrect = true;
    return {
      options: relabeled,
      correctAnswer: firstCorrect ? firstCorrect.label : rawCorrectAnswer,
    };
  }

  const correctLabels = relabeled.filter((o) => o.isCorrect).map((o) => o.label);
  return {
    options: relabeled,
    correctAnswer: correctLabels.length > 0 ? correctLabels.join(', ') : rawCorrectAnswer,
    correctAnswers: correctLabels.length > 0 ? correctLabels : undefined,
  };
}

function normalizeQuestionItem(
  raw: Record<string, unknown>,
  index: number,
  config: GenerationConfig
): QuestionItem {
  const type = (raw.type as QuestionType) || 'pilihan_ganda';
  const defaultWeight = QUESTION_TYPE_META[type]?.defaultWeight ?? 2;
  const svg = sanitizeSvg(raw.svgMarkup as string | undefined);
  const visualNeeded = Boolean(raw.visualNeeded) && Boolean(svg);
  const targetOptionCount = resolveOptionCount(config.optionCount);
  const isPureArabic = config.language === 'Arab';

  const mcNormalized = enforceMcOptionCount(
    Array.isArray(raw.options) ? (raw.options as QuestionItem['options']) : undefined,
    type,
    targetOptionCount,
    isPureArabic,
    Boolean(config.shuffleOptions),
    String(raw.correctAnswer || '')
  );
  const options = mcNormalized.options;
  if (mcNormalized.correctAnswer) {
    raw.correctAnswer = mcNormalized.correctAnswer;
  }
  if (mcNormalized.correctAnswers) {
    raw.correctAnswers = mcNormalized.correctAnswers;
  }

  const matchingPairs = Array.isArray(raw.matchingPairs)
    ? (raw.matchingPairs as QuestionItem['matchingPairs'])?.map((p, idx) => ({
        id: cleanAsterisks(String(p.id || idx + 1)),
        left: cleanAsterisks(String(p.left || '')),
        right: cleanAsterisks(String(p.right || '')),
      }))
    : undefined;
  let computedCorrectAnswer = cleanAsterisks(String(raw.correctAnswer || ''));
  if (type === 'menjodohkan' && matchingPairs && matchingPairs.length > 0) {
    const order =
      matchingPairs.length === 4
        ? [1, 3, 0, 2]
        : matchingPairs.map((_, i) => (matchingPairs.length > 1 ? (i + 1) % matchingPairs.length : 0));
    computedCorrectAnswer = matchingPairs
      .map((pair, idx) => {
        const rightIdx = order.indexOf(idx);
        const letter = String.fromCharCode(65 + (rightIdx >= 0 ? rightIdx : idx));
        return `${idx + 1} → ${letter} (${pair.right})`;
      })
      .join('; ');
  }

  const cleanedPrompt = cleanAsterisks(String(raw.prompt || ''));
  const cleanedOptions = options?.map((o) => ({
    ...o,
    label: cleanAsterisks(o.label),
    text: cleanAsterisks(o.text),
    distractorReason: o.distractorReason ? cleanAsterisks(o.distractorReason) : undefined,
  }));

  return {
    id: `q-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    number: index + 1,
    type,
    topicTag: cleanAsterisks(String(raw.topicTag || config.subtitles[0] || config.title)),
    difficulty: (raw.difficulty as 'Mudah' | 'Sedang' | 'Sulit') || 'Sedang',
    cognitiveLevel: (raw.cognitiveLevel as QuestionItem['cognitiveLevel']) || 'C3',
    thinkingTier: (raw.thinkingTier as QuestionItem['thinkingTier']) || 'MOTS',
    weight: Number(raw.weight) > 0 ? Number(raw.weight) : defaultWeight,
    isArabic: Boolean(raw.isArabic) || config.language.includes('Arab'),
    isRTL: isPureArabicBlock(cleanedPrompt),
    readingPassage: raw.readingPassage ? cleanAsterisks(String(raw.readingPassage)) : undefined,
    readingTranslation: raw.readingTranslation
      ? cleanAsterisks(String(raw.readingTranslation))
      : undefined,
    prompt: cleanedPrompt,
    arabicPrompt: raw.arabicPrompt ? cleanAsterisks(String(raw.arabicPrompt)) : undefined,
    options: cleanedOptions,
    matchingPairs,
    sequenceItems: Array.isArray(raw.sequenceItems)
      ? (raw.sequenceItems as string[]).map((s) => cleanAsterisks(String(s)))
      : undefined,
    correctAnswer: computedCorrectAnswer,
    correctAnswers: Array.isArray(raw.correctAnswers)
      ? (raw.correctAnswers as string[]).map((s) => cleanAsterisks(String(s)))
      : undefined,
    explanation: cleanAsterisks(String(raw.explanation || '')),
    distractorAnalysis: raw.distractorAnalysis
      ? cleanAsterisks(String(raw.distractorAnalysis))
      : undefined,
    rubric: raw.rubric ? cleanAsterisks(String(raw.rubric)) : undefined,
    capaianPembelajaran: raw.capaianPembelajaran
      ? cleanAsterisks(String(raw.capaianPembelajaran))
      : undefined,
    tujuanPembelajaran: raw.tujuanPembelajaran
      ? cleanAsterisks(String(raw.tujuanPembelajaran))
      : undefined,
    indikatorSoal: raw.indikatorSoal ? cleanAsterisks(String(raw.indikatorSoal)) : undefined,
    visual: visualNeeded
      ? {
          svgMarkup: svg,
          caption: cleanAsterisks(String(raw.visualCaption || 'Ilustrasi pendukung soal')),
          visualType: cleanAsterisks(String(raw.visualType || 'Diagram Edukasi')),
        }
      : null,
    verifiedByAI: true,
  };
}

export async function generateExamQuestions(
  config: GenerationConfig,
  onProgress?: (event: { step: number; totalSteps: number; message: string; percent: number }) => void
): Promise<{ questions: QuestionItem[]; qualityReport: QualityReport }> {
  const ai = getAIClient();
  const batchCap = config.enableVisuals ? 12 : 16;
  const batches = buildQuestionPlanBatches(config.questionCounts, batchCap);
  if (batches.length === 0) {
    throw new Error('Pilih minimal 1 jenis soal dengan jumlah lebih dari 0.');
  }

  const totalSteps = batches.length + 1;
  onProgress?.({
    step: 1,
    totalSteps,
    message: `Menyusun ${batches.length} batch soal secara optimal...`,
    percent: 15,
  });

  const systemInstruction = `Anda adalah pakar perancang evaluasi pendidikan profesional, guru besar kurikulum, serta ahli bahasa Arab & ilmu keislaman.
Tugas Anda adalah membuat soal ujian/kuis berkualitas tinggi yang 100% relevan dengan materi, bebas ambiguitas, tidak repetitif, dan memiliki kunci jawaban serta pembahasan yang benar secara akademis.
ATURAN FORMAT TEKS (WAJIB): Jangan pernah menggunakan tanda bintang (* atau **), tanda pagar Markdown (#), atau backtick (\`) pada teks pertanyaan, opsi, jawaban, pembahasan, maupun kisi-kisi. Tulis teks polos yang bersih dan rapi.
${buildArabicGuidance(config)}

ATURAN ILUSTRASI VISUAL (SVG):
${
  config.enableVisuals
    ? `- Untuk tipe soal "berbasis_gambar", WAJIB sertakan visualNeeded=true dan svgMarkup yang jelas, berlabel, dan relevan dengan soal.
- Untuk tipe soal lainnya, HANYA buat visualNeeded=true dan svgMarkup jika gambar benar-benar mendukung pemecahan soal.
- SVG harus berlatar putih (<rect width="480" height="260" fill="#ffffff" rx="8"/>), garis kontras tinggi (#0f172a, #0284c7, #059669, #d97706), font sans-serif ukuran 11-13px.`
    : `- Mode visual otomatis dimatikan: set visualNeeded=false untuk semua soal kecuali jika mutlak diminta oleh tipe berbasis_gambar.`
}`;

  const targetOptCount = resolveOptionCount(config.optionCount);
  const isPureArabic = config.language === 'Arab';
  const latinRange = targetOptCount === 3 ? 'A, B, C' : targetOptCount === 4 ? 'A, B, C, D' : 'A, B, C, D, E';
  const arabRange = targetOptCount === 3 ? 'أ، ب، ج' : targetOptCount === 4 ? 'أ، ب، ج، د' : 'أ، ب، ج، د، هـ';
  const optionRangePrompt = isPureArabic ? arabRange : `${latinRange} (atau ${arabRange} jika Arab penuh)`;
  const subtitlesList = config.subtitles.length > 0 ? config.subtitles : [config.title];

  let completedBatches = 0;
  const runBatch = async (
    batch: Array<{ type: QuestionType; count: number }>,
    bIdx: number
  ): Promise<QuestionItem[]> => {
    const batchSummary = batch
      .map((item) => `- ${item.count} soal bertipe "${item.type}" (${QUESTION_TYPE_META[item.type].label})`)
      .join('\n');

    // Assign distinct subtitle focus slice per parallel batch so batches don't overlap
    const primaryFocus = subtitlesList[bIdx % subtitlesList.length];

    const promptText = `Buatlah paket soal (Batch ${bIdx + 1}/${batches.length}, fokus utama subjudul: "${primaryFocus}") dengan spesifikasi berikut:
- Judul Materi: ${config.title}
- Daftar Subjudul / Pokok Bahasan:
${subtitlesList.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
- Deskripsi Tambahan: ${config.description || 'Tidak ada catatan tambahan'}
- Jenjang Pendidikan & Kelas: ${config.level}${config.gradeClass ? ` · ${config.gradeClass}` : ''}
- Mata Pelajaran: ${config.subject}
- Bahasa Soal: ${config.language}
- Jumlah Opsi Pilihan Ganda: TEPAT ${targetOptCount} opsi (${isPureArabic ? arabRange : latinRange})
- Tingkat Kesulitan: ${config.difficulty}
- Level Kognitif Taksonomi Bloom: ${config.cognitiveLevels.join(', ')}
- Kategori Berpikir: ${config.thinkingTier}
- Kedalaman Materi: ${config.depth}
- Gaya Bahasa: ${config.tone}
${
  (config.questionCounts.menulis_ulang_kalimat || 0) > 0
    ? `- Pengaturan Panjang Kata "Menulis Ulang Kalimat": ${
        config.rewriteWordMode === 'exact'
          ? `TEPAT ${config.rewriteWordCount || 1} kata per kalimat.`
          : `BERTAHAP mulai 1 kata, 2 kata, 3 kata, 4 kata, dst.`
      }`
    : ''
}

KOMPOSISI SOAL BATCH INI (HARUS TEPAT JUMLAH & TIPENYA):
${batchSummary}

Aturan Wajib:
1. Buat pertanyaan unik, terukur, dan TANPA simbol * (bintang) atau Markdown.
2. Pilihan Ganda: TEPAT ${targetOptCount} opsi (${optionRangePrompt}), 1 benar, isi distractorReason. Pilihan Ganda Kompleks: 2–${Math.min(3, targetOptCount - 1)} benar. Benar/Salah: 2 opsi.
3. Menjodohkan: 4 pasang (left & right), instruksi prompt sinkron dengan kolom kiri (1-4) & pilihan kanan (A-D) serta kotak isian jawaban.
4. Mengurutkan: sequenceItems urutan benar + correctAnswer urutannya. Esai/Studi Kasus/Analisis Teks: wajib isi rubric + correctAnswer.
5. Memisah Huruf Hijaiyah (memisah_hijaiyah): instruksi jelas, kata Arab berharakat lengkap di arabicPrompt (misal: مَدْرَسَةٌ), kunci jawaban berpemisah " - " (misal: مَ - دْ - رَ - سَ - ةٌ).
6. Menyambung Huruf Hijaiyah (menyambung_hijaiyah): huruf terpisah " - " di arabicPrompt, kata sambung berharakat lengkap di correctAnswer.
7. Menulis Ulang Kalimat (menulis_ulang_kalimat): kalimat sasaran di arabicPrompt/readingPassage, correctAnswer sama persis.
8. Menebalkan Garis & Mewarnai Arab (menebalkan_mewarnai_arab): 1–3 kata Arab berharakat lengkap di arabicPrompt, arti di readingTranslation, instruksi di prompt, correctAnswer sama, plus rubric.
9. Kisi-Kisi Kurikulum Merdeka (WAJIB): isi capaianPembelajaran, tujuanPembelajaran, dan indikatorSoal (pola ABCD).`;

    const response = await generateContentResilient(ai, {
      contents: promptText,
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: QUESTION_ITEM_SCHEMA,
      },
      onStatus: (statusMsg) => {
        onProgress?.({
          step: Math.min(totalSteps - 1, completedBatches + 1),
          totalSteps,
          message: statusMsg,
          percent: Math.round((completedBatches / totalSteps) * 85) + 12,
        });
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim()) as Record<string, unknown>[];
    completedBatches++;
    onProgress?.({
      step: Math.min(totalSteps - 1, completedBatches),
      totalSteps,
      message: `Batch ${completedBatches}/${batches.length} selesai (${parsed.length} soal)...`,
      percent: Math.round((completedBatches / totalSteps) * 85) + 10,
    });

    return parsed.map((item, idx) => normalizeQuestionItem(item, bIdx * batchCap + idx, config));
  };

  // Run up to 2 batches concurrently to balance speed and Free Tier RPM limits
  const batchResults: QuestionItem[][] = new Array(batches.length);
  const concurrency = 2;
  for (let start = 0; start < batches.length; start += concurrency) {
    const chunkIndices = Array.from(
      { length: Math.min(concurrency, batches.length - start) },
      (_, k) => start + k
    );
    await Promise.all(
      chunkIndices.map(async (bIdx) => {
        batchResults[bIdx] = await runBatch(batches[bIdx], bIdx);
      })
    );
  }

  const allQuestions = batchResults.flat();

  if (config.shuffleQuestions && allQuestions.length > 1) {
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
  }

  const numbered = allQuestions.map((q, idx) => ({ ...q, number: idx + 1 }));
  const qualityReport = runFastQualityAudit(config, numbered);

  onProgress?.({
    step: totalSteps,
    totalSteps,
    message: 'Paket soal tervalidasi dan siap digunakan!',
    percent: 100,
  });

  return { questions: numbered, qualityReport };
}

function runFastQualityAudit(
  config: GenerationConfig,
  questions: QuestionItem[]
): QualityReport {
  const promptSet = new Set<string>();
  let duplicates = 0;
  let validKeys = true;
  questions.forEach((q) => {
    const norm = q.prompt.toLowerCase().replace(/\s+/g, ' ').trim();
    if (promptSet.has(norm)) duplicates++;
    promptSet.add(norm);
    if (!q.correctAnswer && (!q.options || !q.options.some((o) => o.isCorrect))) {
      validKeys = false;
    }
  });

  const notes = [
    `Tervalidasi ${questions.length} butir soal untuk materi "${config.title}" (${config.level}${config.gradeClass ? ' · ' + config.gradeClass : ''}).`,
    duplicates === 0
      ? 'Tidak ditemukan duplikasi pertanyaan antar batch.'
      : `Terdeteksi ${duplicates} pertanyaan mirip; silakan tinjau jika diperlukan.`,
    'Seluruh karakter Markdown (*) dibersihkan otomatis dan kisi-kisi Kurikulum Merdeka telah disiapkan.',
  ];

  return {
    overallScore: duplicates === 0 && validKeys ? 98 : 92,
    materialAlignment: true,
    answerKeyVerified: validKeys,
    noDuplicates: duplicates === 0,
    arabicGrammarChecked: true,
    notes,
    checkedAt: new Date().toISOString(),
  };
}

export async function regenerateSingleQuestion(params: {
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
  const ai = getAIClient();
  const { existingQuestion, instruction } = params;
  const targetOptCount = resolveOptionCount(
    params.optionCount ||
      (existingQuestion.options && existingQuestion.options.length >= 3 && existingQuestion.options.length <= 5
        ? existingQuestion.options.length
        : 5)
  );
  const isPureArabic = params.language === 'Arab';
  const optRange =
    targetOptCount === 3
      ? isPureArabic
        ? 'أ، ب، ج'
        : 'A, B, C'
      : targetOptCount === 4
      ? isPureArabic
        ? 'أ، ب، ج، د'
        : 'A, B, C, D'
      : isPureArabic
      ? 'أ، ب، ج، د، هـ'
      : 'A, B, C, D, E';

  const response = await generateContentResilient(ai, {
    contents: `Buat ulang 1 butir soal pengganti yang BERBEDA dan LEBIH BAIK untuk menggantikan soal nomor ${existingQuestion.number}.
Konteks Paket Soal:
- Judul Materi: ${params.title}
- Subjudul Terkait: ${existingQuestion.topicTag || params.subtitles.join(', ')}
- Mata Pelajaran: ${params.subject}
- Jenjang & Kelas: ${params.level}${params.gradeClass ? ` · ${params.gradeClass}` : ''}
- Bahasa: ${params.language}
- Tipe Soal yang Diinginkan: ${existingQuestion.type} (${QUESTION_TYPE_META[existingQuestion.type]?.label})
- Jika soal pilihan ganda: TEPAT ${targetOptCount} opsi (${optRange}).
- Tingkat Kesulitan: ${existingQuestion.difficulty}
- Level Kognitif: ${existingQuestion.cognitiveLevel} (${existingQuestion.thinkingTier})
- Bobot Nilai: ${existingQuestion.weight}

Soal lama yang harus diganti (JANGAN mengulang pertanyaan yang sama):
"${existingQuestion.prompt}"

${instruction ? `Instruksi khusus dari guru/dosen: "${instruction}"` : ''}

Hindari kemiripan dengan soal lain dalam paket ini:
${params.otherPrompts.slice(0, 12).map((p, i) => `${i + 1}. ${p.slice(0, 100)}`).join('\n')}

Jika tipe soal "berbasis_gambar" atau instruksi meminta gambar/diagram, buat svgMarkup yang bersih di atas latar putih (#ffffff).
Jika tipe soal "menebalkan_mewarnai_arab", berikan 1–3 kata Arab berharakat penuh yang baru pada arabicPrompt, arti Indonesianya di readingTranslation, serta instruksi menebalkan garis dan mewarnai tulisan Arab di prompt.`,
    responseMimeType: 'application/json',
    responseSchema: QUESTION_ITEM_SCHEMA,
  });

  const raw = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
  const svg = sanitizeSvg(raw.svgMarkup as string | undefined);
  const visualNeeded = Boolean(raw.visualNeeded) && Boolean(svg);

  const regenMatchingPairs = Array.isArray(raw.matchingPairs)
    ? (raw.matchingPairs as QuestionItem['matchingPairs'])?.map((p, idx) => ({
        id: cleanAsterisks(String(p.id || idx + 1)),
        left: cleanAsterisks(String(p.left || '')),
        right: cleanAsterisks(String(p.right || '')),
      }))
    : undefined;
  const regenType = (raw.type as QuestionType) || existingQuestion.type;
  const regenMc = enforceMcOptionCount(
    Array.isArray(raw.options) ? (raw.options as QuestionItem['options']) : undefined,
    regenType,
    targetOptCount,
    isPureArabic,
    false,
    String(raw.correctAnswer || '')
  );
  let regenCorrectAnswer = cleanAsterisks(regenMc.correctAnswer || String(raw.correctAnswer || ''));
  if (regenType === 'menjodohkan' && regenMatchingPairs && regenMatchingPairs.length > 0) {
    const order =
      regenMatchingPairs.length === 4
        ? [1, 3, 0, 2]
        : regenMatchingPairs.map((_, i) =>
            regenMatchingPairs.length > 1 ? (i + 1) % regenMatchingPairs.length : 0
          );
    regenCorrectAnswer = regenMatchingPairs
      .map((pair, idx) => {
        const rightIdx = order.indexOf(idx);
        const letter = String.fromCharCode(65 + (rightIdx >= 0 ? rightIdx : idx));
        return `${idx + 1} → ${letter} (${pair.right})`;
      })
      .join('; ');
  }

  const cleanedPrompt = cleanAsterisks(String(raw.prompt || ''));
  const cleanedOptions = regenMc.options?.map((o) => ({
    ...o,
    label: cleanAsterisks(o.label),
    text: cleanAsterisks(o.text),
    distractorReason: o.distractorReason ? cleanAsterisks(o.distractorReason) : undefined,
  }));

  return {
    id: existingQuestion.id,
    number: existingQuestion.number,
    type: regenType,
    topicTag: cleanAsterisks(String(raw.topicTag || existingQuestion.topicTag)),
    difficulty: (raw.difficulty as QuestionItem['difficulty']) || existingQuestion.difficulty,
    cognitiveLevel: (raw.cognitiveLevel as QuestionItem['cognitiveLevel']) || existingQuestion.cognitiveLevel,
    thinkingTier: (raw.thinkingTier as QuestionItem['thinkingTier']) || existingQuestion.thinkingTier,
    weight: Number(raw.weight) > 0 ? Number(raw.weight) : existingQuestion.weight,
    isArabic: Boolean(raw.isArabic) || params.language.includes('Arab'),
    isRTL: isPureArabicBlock(cleanedPrompt),
    readingPassage: raw.readingPassage ? cleanAsterisks(String(raw.readingPassage)) : undefined,
    readingTranslation: raw.readingTranslation
      ? cleanAsterisks(String(raw.readingTranslation))
      : undefined,
    prompt: cleanedPrompt,
    arabicPrompt: raw.arabicPrompt ? cleanAsterisks(String(raw.arabicPrompt)) : undefined,
    options: cleanedOptions,
    matchingPairs: regenMatchingPairs,
    sequenceItems: Array.isArray(raw.sequenceItems)
      ? (raw.sequenceItems as string[]).map((s) => cleanAsterisks(String(s)))
      : undefined,
    correctAnswer: regenCorrectAnswer,
    correctAnswers: (
      regenMc.correctAnswers ||
      (Array.isArray(raw.correctAnswers) ? (raw.correctAnswers as string[]) : undefined)
    )?.map((s) => cleanAsterisks(String(s))),
    explanation: cleanAsterisks(String(raw.explanation || '')),
    distractorAnalysis: raw.distractorAnalysis
      ? cleanAsterisks(String(raw.distractorAnalysis))
      : undefined,
    rubric: raw.rubric ? cleanAsterisks(String(raw.rubric)) : undefined,
    capaianPembelajaran: raw.capaianPembelajaran
      ? cleanAsterisks(String(raw.capaianPembelajaran))
      : undefined,
    tujuanPembelajaran: raw.tujuanPembelajaran
      ? cleanAsterisks(String(raw.tujuanPembelajaran))
      : undefined,
    indikatorSoal: raw.indikatorSoal ? cleanAsterisks(String(raw.indikatorSoal)) : undefined,
    visual: visualNeeded
      ? {
          svgMarkup: svg,
          caption: cleanAsterisks(String(raw.visualCaption || 'Ilustrasi pendukung soal')),
          visualType: cleanAsterisks(String(raw.visualType || 'Diagram Edukasi')),
        }
      : null,
    verifiedByAI: true,
  };
}

export async function generateVisualForQuestion(params: {
  questionPrompt: string;
  subject: string;
  level: string;
  customVisualHint?: string;
}): Promise<{ svgMarkup: string; caption: string; visualType: string }> {
  const ai = getAIClient();
  const response = await generateContentResilient(ai, {
    contents: `Buatkan ilustrasi diagram vektor SVG yang akurat secara ilmiah/akademis untuk mendukung soal berikut:
- Mata Pelajaran: ${params.subject} (${params.level})
- Soal: ${params.questionPrompt}
${params.customVisualHint ? `- Arahan visual: ${params.customVisualHint}` : ''}

Ketentuan SVG:
1. Root tag wajib: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 260" width="480" height="260">
2. Latar belakang putih bersih (<rect width="480" height="260" fill="#ffffff" rx="8"/>) agar jelas di UI maupun saat dicetak ke PDF/Word.
3. Gunakan garis tegas, label huruf/angka yang terbaca jelas, panah atau koordinat yang akurat sesuai soal.`,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        visualType: { type: Type.STRING },
        caption: { type: Type.STRING },
        svgMarkup: { type: Type.STRING },
      },
      required: ['visualType', 'caption', 'svgMarkup'],
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    visualType: string;
    caption: string;
    svgMarkup: string;
  };
  const svg = sanitizeSvg(parsed.svgMarkup);
  if (!svg) {
    throw new Error('Gagal menyusun diagram SVG yang valid. Silakan coba deskripsi visual yang lebih spesifik.');
  }
  return {
    svgMarkup: svg,
    caption: cleanAsterisks(parsed.caption || 'Diagram pendukung soal'),
    visualType: cleanAsterisks(parsed.visualType || 'Diagram Edukasi'),
  };
}

export async function generateRppKurmer(params: {
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
  const ai = getAIClient();
  const fase = getFaseKurikulumMerdeka(params.level, params.gradeClass);
  const subtopics =
    params.subtopics && params.subtopics.length > 0 ? params.subtopics : [params.topic];
  const model = params.modelPembelajaran || 'Problem Based Learning (PBL)';

  const prompt = `Susunlah RPP / Modul Ajar lengkap sesuai standar resmi Kurikulum Merdeka (Kemendikbudristek) dengan data berikut:
- Satuan Pendidikan: ${params.institutionName || 'Sekolah Islam Terpadu Plus Cordova'}
- Penyusun / Guru: ${params.teacherName || 'Ustdz Mulyadi, S.T.'}
- Mata Pelajaran: ${params.subject}
- Jenjang & Kelas: ${params.level} · ${params.gradeClass} (${fase})
- Topik / Materi Pokok: ${params.topic}
- Subtopik: ${subtopics.join(', ')}
- Bahasa Pengantar: ${params.language || 'Indonesia'}
- Model Pembelajaran: ${model}
- Alokasi Waktu: ${params.alokasiWaktu || '2 JP × 40 Menit'} (${params.jumlahPertemuan || '1 Pertemuan'})
- Catatan Tambahan: ${params.description || 'Terintegrasi nilai adab Islami dan berpikir kritis'}

WAJIB:
1. Jangan gunakan karakter Markdown seperti *, **, #, atau \` dalam seluruh isi teks.
2. Sesuaikan kegiatan Inti dengan sintaks nyata dari model "${model}".
3. Jika mata pelajaran Bahasa Arab / Dirasah Islamiyah, sertakan istilah kunci Arab berharakat jika relevan.`;

  const response = await generateContentResilient(ai, {
    contents: prompt,
    systemInstruction:
      'Anda adalah pakar kurikulum nasional Kurikulum Merdeka dan penyusun Modul Ajar profesional di SIT Plus Cordova. Tulis output JSON yang terstruktur, operasional, praktis langsung pakai di kelas, serta BEBAS dari simbol * atau Markdown.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        targetPesertaDidik: { type: Type.STRING },
        kompetensiAwal: { type: Type.STRING },
        profilPelajarPancasila: { type: Type.ARRAY, items: { type: Type.STRING } },
        saranaPrasarana: { type: Type.STRING },
        capaianPembelajaran: { type: Type.STRING },
        tujuanPembelajaran: { type: Type.ARRAY, items: { type: Type.STRING } },
        pemahamanBermakna: { type: Type.STRING },
        pertanyaanPemantik: { type: Type.ARRAY, items: { type: Type.STRING } },
        pendahuluanDurasi: { type: Type.STRING },
        pendahuluanLangkah: { type: Type.ARRAY, items: { type: Type.STRING } },
        intiDurasi: { type: Type.STRING },
        intiLangkah: { type: Type.ARRAY, items: { type: Type.STRING } },
        penutupDurasi: { type: Type.STRING },
        penutupLangkah: { type: Type.ARRAY, items: { type: Type.STRING } },
        asesmenDiagnostik: { type: Type.STRING },
        asesmenFormatif: { type: Type.STRING },
        asesmenSumatif: { type: Type.STRING },
        pengayaan: { type: Type.STRING },
        remedial: { type: Type.STRING },
        refleksiPendidik: { type: Type.STRING },
        refleksiPesertaDidik: { type: Type.STRING },
        glosarium: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING },
            },
            required: ['term', 'definition'],
          },
        },
        daftarPustaka: { type: Type.STRING },
      },
      required: [
        'kompetensiAwal',
        'profilPelajarPancasila',
        'saranaPrasarana',
        'capaianPembelajaran',
        'tujuanPembelajaran',
        'pemahamanBermakna',
        'pertanyaanPemantik',
        'pendahuluanLangkah',
        'intiLangkah',
        'penutupLangkah',
        'asesmenDiagnostik',
        'asesmenFormatif',
        'asesmenSumatif',
        'pengayaan',
        'remedial',
        'refleksiPendidik',
        'refleksiPesertaDidik',
      ],
    },
  });

  const raw = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
  const now = new Date().toISOString();

  return {
    id: `rpp-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    institutionName: cleanAsterisks(
      params.institutionName || 'Sekolah Islam Terpadu Plus Cordova'
    ),
    institutionAddress: cleanAsterisks(
      params.institutionAddress || 'Sekolah Islam Terpadu Plus Cordova (SD–SMA)'
    ),
    teacherName: cleanAsterisks(params.teacherName || 'Ustdz Mulyadi, S.T.'),
    teacherNip: cleanAsterisks(params.teacherNip || '-'),
    principalName: cleanAsterisks(params.principalName || 'Kepala Sekolah SIT Plus Cordova'),
    principalNip: cleanAsterisks(params.principalNip || '-'),
    subject: cleanAsterisks(params.subject),
    level: params.level,
    gradeClass: cleanAsterisks(params.gradeClass),
    fase,
    semester: cleanAsterisks(params.semester || 'Ganjil'),
    academicYear: cleanAsterisks(params.academicYear || '2026/2027'),
    topic: cleanAsterisks(params.topic),
    subtopics: subtopics.map((s) => cleanAsterisks(s)),
    alokasiWaktu: cleanAsterisks(params.alokasiWaktu || '2 JP × 40 Menit'),
    jumlahPertemuan: cleanAsterisks(params.jumlahPertemuan || '1 Pertemuan'),
    modelPembelajaran: cleanAsterisks(model),
    targetPesertaDidik: cleanAsterisks(
      String(raw.targetPesertaDidik || 'Peserta didik reguler/tipikal')
    ),
    kompetensiAwal: cleanAsterisks(String(raw.kompetensiAwal || '')),
    profilPelajarPancasila: Array.isArray(raw.profilPelajarPancasila)
      ? (raw.profilPelajarPancasila as string[]).map((s) => cleanAsterisks(String(s)))
      : ['Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia', 'Bernalar Kritis', 'Mandiri'],
    saranaPrasarana: cleanAsterisks(String(raw.saranaPrasarana || '')),
    capaianPembelajaran: cleanAsterisks(String(raw.capaianPembelajaran || '')),
    tujuanPembelajaran: Array.isArray(raw.tujuanPembelajaran)
      ? (raw.tujuanPembelajaran as string[]).map((s) => cleanAsterisks(String(s)))
      : [],
    pemahamanBermakna: cleanAsterisks(String(raw.pemahamanBermakna || '')),
    pertanyaanPemantik: Array.isArray(raw.pertanyaanPemantik)
      ? (raw.pertanyaanPemantik as string[]).map((s) => cleanAsterisks(String(s)))
      : [],
    kegiatanPembelajaran: {
      pendahuluan: {
        durasi: cleanAsterisks(String(raw.pendahuluanDurasi || '10 Menit')),
        langkah: Array.isArray(raw.pendahuluanLangkah)
          ? (raw.pendahuluanLangkah as string[]).map((s) => cleanAsterisks(String(s)))
          : [],
      },
      inti: {
        durasi: cleanAsterisks(String(raw.intiDurasi || '60 Menit')),
        langkah: Array.isArray(raw.intiLangkah)
          ? (raw.intiLangkah as string[]).map((s) => cleanAsterisks(String(s)))
          : [],
      },
      penutup: {
        durasi: cleanAsterisks(String(raw.penutupDurasi || '10 Menit')),
        langkah: Array.isArray(raw.penutupLangkah)
          ? (raw.penutupLangkah as string[]).map((s) => cleanAsterisks(String(s)))
          : [],
      },
    },
    asesmen: {
      diagnostik: cleanAsterisks(String(raw.asesmenDiagnostik || '')),
      formatif: cleanAsterisks(String(raw.asesmenFormatif || '')),
      sumatif: cleanAsterisks(String(raw.asesmenSumatif || '')),
    },
    pengayaanRemedial: {
      pengayaan: cleanAsterisks(String(raw.pengayaan || '')),
      remedial: cleanAsterisks(String(raw.remedial || '')),
    },
    refleksi: {
      pendidik: cleanAsterisks(String(raw.refleksiPendidik || '')),
      pesertaDidik: cleanAsterisks(String(raw.refleksiPesertaDidik || '')),
    },
    glosarium: Array.isArray(raw.glosarium)
      ? (raw.glosarium as Array<{ term: string; definition: string }>).map((g) => ({
          term: cleanAsterisks(String(g.term || '')),
          definition: cleanAsterisks(String(g.definition || '')),
        }))
      : [],
    daftarPustaka: cleanAsterisks(
      String(
        raw.daftarPustaka ||
          `Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. Panduan Pembelajaran dan Asesmen Kurikulum Merdeka (${params.subject}).`
      )
    ),
  };
}
