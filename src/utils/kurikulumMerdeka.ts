import { QUESTION_TYPE_META } from '../constants.ts';
import { EducationLevel, QuestionItem } from '../types.ts';

export interface KisiKisiRow {
  questionId: string;
  number: number;
  fase: string;
  capaianPembelajaran: string;
  tujuanPembelajaran: string;
  materi: string;
  indikatorSoal: string;
  cognitiveLevel: string;
  thinkingTier: string;
  difficulty: string;
  bentukSoal: string;
  weight: number;
}

export function getFaseKurikulumMerdeka(
  level: EducationLevel | string,
  gradeClass?: string
): string {
  const g = String(gradeClass || '').toUpperCase();
  if (level === 'SD') {
    if (/\b(1|I|2|II)\b/.test(g)) return 'Fase A (Kelas I–II SD)';
    if (/\b(3|III|4|IV)\b/.test(g)) return 'Fase B (Kelas III–IV SD)';
    if (/\b(5|V|6|VI)\b/.test(g)) return 'Fase C (Kelas V–VI SD)';
    return 'Fase B/C (SD)';
  }
  if (level === 'SMP') {
    return 'Fase D (Kelas VII–IX SMP)';
  }
  if (level === 'SMA/SMK' || level === 'MA') {
    if (/\b(10|X)\b/.test(g)) return 'Fase E (Kelas X SMA/MA)';
    if (/\b(11|XI|12|XII)\b/.test(g)) return 'Fase F (Kelas XI–XII SMA/MA)';
    return 'Fase E/F (SMA/MA)';
  }
  if (level === 'Perguruan Tinggi') return 'Pendidikan Tinggi';
  return 'Umum';
}

function getVerbForCognitive(cog: string): string {
  switch (cog) {
    case 'C1':
      return 'mengidentifikasi dan menyebutkan';
    case 'C2':
      return 'menjelaskan dan memahami';
    case 'C3':
      return 'menerapkan dan menyelesaikan';
    case 'C4':
      return 'menganalisis dan menelaah';
    case 'C5':
      return 'mengevaluasi dan menyimpulkan';
    case 'C6':
      return 'merancang dan menyusun';
    default:
      return 'memahami dan menerapkan';
  }
}

export function buildKisiKisiRow(
  q: QuestionItem,
  context: {
    subject: string;
    level: EducationLevel | string;
    gradeClass?: string;
    title: string;
  }
): KisiKisiRow {
  const fase = getFaseKurikulumMerdeka(context.level, context.gradeClass);
  const topic = q.topicTag || context.title || context.subject;
  const verb = getVerbForCognitive(q.cognitiveLevel);
  const shapeLabel = QUESTION_TYPE_META[q.type]?.shortLabel || q.type;

  const defaultCp = `Peserta didik mampu memahami, mengolah, dan menerapkan konsep pokok pada mata pelajaran ${context.subject} (${fase}) terkait materi ${context.title} secara tepat dan kontekstual.`;
  const defaultTp = `Peserta didik dapat ${verb} konsep pada pokok bahasan "${topic}" secara mandiri dan akurat.`;

  let defaultIndikator = `Disajikan stimulus/pernyataan mengenai ${topic}, peserta didik dapat ${verb} jawaban yang tepat melalui bentuk soal ${shapeLabel}.`;
  if (q.type === 'memisah_hijaiyah') {
    defaultIndikator = `Disajikan 1 kata Arab berharakat (${topic}), peserta didik dapat memisahkan rangkaian huruf hijaiyah tunggal beserta harakatnya secara tepat.`;
  } else if (q.type === 'menyambung_hijaiyah') {
    defaultIndikator = `Disajikan huruf-huruf hijaiyah terpisah (${topic}), peserta didik dapat menyambungkan huruf menjadi kata Arab berharakat yang benar.`;
  } else if (q.type === 'menulis_ulang_kalimat') {
    defaultIndikator = `Disajikan kata/kalimat (${topic}), peserta didik dapat menulis ulang teks dengan kaidah penulisan dan harakat yang tepat.`;
  } else if (q.type === 'menebalkan_mewarnai_arab') {
    defaultIndikator = `Disajikan kata/kalimat Arab berharakat (${topic}), peserta didik dapat menebalkan garis huruf dan mewarnai tulisan Arab dengan rapi dan benar.`;
  } else if (q.type === 'menjodohkan') {
    defaultIndikator = `Disajikan premis pada Kolom Kiri dan pilihan pasangan pada Kolom Kanan mengenai ${topic}, peserta didik dapat memasangkan seluruh item dengan benar.`;
  }

  return {
    questionId: q.id,
    number: q.number,
    fase,
    capaianPembelajaran: q.capaianPembelajaran?.trim() || defaultCp,
    tujuanPembelajaran: q.tujuanPembelajaran?.trim() || defaultTp,
    materi: topic,
    indikatorSoal: q.indikatorSoal?.trim() || defaultIndikator,
    cognitiveLevel: q.cognitiveLevel,
    thinkingTier: q.thinkingTier,
    difficulty: q.difficulty,
    bentukSoal: shapeLabel,
    weight: q.weight,
  };
}
