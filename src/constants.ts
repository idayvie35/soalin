import {
  ArabicSubjectFocus,
  CognitiveLevel,
  EducationLevel,
  ExamTemplate,
  HarakatMode,
  QuestionLanguage,
  QuestionType,
} from './types.ts';

export const QUESTION_TYPE_META: Record<
  QuestionType,
  {
    label: string;
    shortLabel: string;
    description: string;
    defaultWeight: number;
  }
> = {
  pilihan_ganda: {
    label: 'Pilihan Ganda',
    shortLabel: 'PG',
    description: 'Satu jawaban benar dengan 3–5 opsi pilihan (A–C, A–D, atau A–E).',
    defaultWeight: 2,
  },
  pilihan_ganda_kompleks: {
    label: 'Pilihan Ganda Kompleks',
    shortLabel: 'PG Kompleks',
    description: 'Lebih dari satu pernyataan atau jawaban benar (gaya AKM).',
    defaultWeight: 3,
  },
  benar_salah: {
    label: 'Benar atau Salah',
    shortLabel: 'Benar/Salah',
    description: 'Verifikasi ketepatan pernyataan konseptual secara cepat.',
    defaultWeight: 1,
  },
  esai: {
    label: 'Esai / Uraian',
    shortLabel: 'Esai',
    description: 'Jawaban terbuka lengkap dengan rubrik dan pedoman skor.',
    defaultWeight: 10,
  },
  isian_singkat: {
    label: 'Isian Singkat',
    shortLabel: 'Isian',
    description: 'Menuliskan istilah, angka, atau konsep kunci secara ringkas.',
    defaultWeight: 2,
  },
  menjodohkan: {
    label: 'Menjodohkan',
    shortLabel: 'Jodohkan',
    description: 'Memasangkan premis dan respons yang saling berkorespondensi.',
    defaultWeight: 4,
  },
  melengkapi_kalimat: {
    label: 'Melengkapi Kalimat',
    shortLabel: 'Lengkapi',
    description: 'Mengisi bagian rumpang (cloze) pada teks atau kaidah.',
    defaultWeight: 2,
  },
  mengurutkan: {
    label: 'Mengurutkan',
    shortLabel: 'Urutkan',
    description: 'Menyusun kronologi, prosedur, atau hierarki secara tepat.',
    defaultWeight: 4,
  },
  studi_kasus: {
    label: 'Studi Kasus',
    shortLabel: 'Studi Kasus',
    description: 'Skenario nyata yang menuntut pemecahan masalah terstruktur.',
    defaultWeight: 10,
  },
  analisis_teks: {
    label: 'Analisis Teks',
    shortLabel: 'Analisis Teks',
    description: 'Bedah teks sumber (termasuk teks Arab/kitab & terjemahan).',
    defaultWeight: 6,
  },
  hots: {
    label: 'Soal HOTS',
    shortLabel: 'HOTS (C4-C6)',
    description: 'Penalaran tingkat tinggi: analisis, evaluasi, dan kreasi.',
    defaultWeight: 5,
  },
  berbasis_gambar: {
    label: 'Berbasis Gambar / Diagram',
    shortLabel: 'Visual/Gambar',
    description: 'Menggunakan ilustrasi/diagram/grafik sebagai stimulus utama.',
    defaultWeight: 4,
  },
  berbasis_bacaan: {
    label: 'Berbasis Bacaan / Wacana',
    shortLabel: 'Wacana',
    description: 'Pemahaman wacana, inferensi, dan interpretasi teks.',
    defaultWeight: 4,
  },
  memisah_hijaiyah: {
    label: 'Memisah Huruf Hijaiyah',
    shortLabel: 'Pisah Hijaiyah',
    description: 'Bahasa Arab: mengurai kata Arab menjadi huruf hijaiyah terpisah beserta harakat.',
    defaultWeight: 3,
  },
  menyambung_hijaiyah: {
    label: 'Menyambung Huruf Hijaiyah',
    shortLabel: 'Sambung Hijaiyah',
    description: 'Bahasa Arab: merangkai huruf hijaiyah terpisah menjadi kata sambung yang benar.',
    defaultWeight: 3,
  },
  menulis_ulang_kalimat: {
    label: 'Menulis Ulang Kalimat',
    shortLabel: 'Tulis Ulang',
    description: 'Menyalin & menulis ulang kalimat bertahap (1 kata, 2 kata, 3 kata, dst.).',
    defaultWeight: 3,
  },
  menebalkan_mewarnai_arab: {
    label: 'Menebalkan & Mewarnai Arab (A4 · 2 Soal)',
    shortLabel: 'Tebalkan & Warnai Arab',
    description: 'Bahasa Arab: menebalkan garis (tracing line) & mewarnai kata/kalimat Arab berharakat ukuran besar (A4 maksimal 2 soal/halaman).',
    defaultWeight: 4,
  },
};

export const ALL_QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[];

export const DEFAULT_QUESTION_COUNTS: Record<QuestionType, number> = {
  pilihan_ganda: 5,
  pilihan_ganda_kompleks: 0,
  benar_salah: 2,
  esai: 2,
  isian_singkat: 0,
  menjodohkan: 0,
  melengkapi_kalimat: 0,
  mengurutkan: 0,
  studi_kasus: 0,
  analisis_teks: 0,
  hots: 1,
  berbasis_gambar: 0,
  berbasis_bacaan: 0,
  memisah_hijaiyah: 0,
  menyambung_hijaiyah: 0,
  menulis_ulang_kalimat: 0,
  menebalkan_mewarnai_arab: 0,
};

export const EDUCATION_LEVELS: EducationLevel[] = [
  'SD',
  'SMP',
  'SMA/SMK',
  'MA',
  'Perguruan Tinggi',
  'Umum',
];

export const GRADE_OPTIONS_BY_LEVEL: Record<EducationLevel, string[]> = {
  SD: ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'],
  SMP: ['Kelas 7', 'Kelas 8', 'Kelas 9'],
  'SMA/SMK': ['Kelas 10', 'Kelas 11', 'Kelas 12'],
  MA: ['Kelas 10', 'Kelas 11', 'Kelas 12'],
  'Perguruan Tinggi': [
    'Semester 1',
    'Semester 2',
    'Semester 3',
    'Semester 4',
    'Semester 5',
    'Semester 6',
    'Semester 7',
    'Semester 8',
  ],
  Umum: ['Tingkat Dasar', 'Tingkat Menengah', 'Tingkat Lanjutan'],
};

export const DEFAULT_GRADE_BY_LEVEL: Record<EducationLevel, string> = {
  SD: 'Kelas 3',
  SMP: 'Kelas 8',
  'SMA/SMK': 'Kelas 10',
  MA: 'Kelas 10',
  'Perguruan Tinggi': 'Semester 3',
  Umum: 'Tingkat Menengah',
};

export function getSuggestedOptionCount(level: EducationLevel, gradeClass?: string): 3 | 4 | 5 {
  const g = String(gradeClass || '').toUpperCase();
  if (level === 'SD') {
    if (/\b(1|2|3|I|II|III)\b/.test(g)) return 3;
    return 4;
  }
  if (level === 'SMP') return 4;
  if (level === 'SMA/SMK' || level === 'MA' || level === 'Perguruan Tinggi') return 5;
  return 4;
}

export function getOptionRangeLabel(optionCount?: 3 | 4 | 5): string {
  if (optionCount === 3) return 'A–C';
  if (optionCount === 4) return 'A–D';
  return 'A–E';
}

export const SUBJECT_LIST: string[] = [
  'Matematika',
  'Ilmu Pengetahuan Alam (IPA)',
  'Fisika',
  'Kimia',
  'Biologi',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Bahasa Arab',
  'Nahwu & Sharaf',
  'Balaghah',
  'Fiqih & Ushul Fiqih',
  'Al-Quran & Tafsir',
  'Hadis & Ilmu Hadis',
  'Aqidah Akhlak',
  'Sejarah Kebudayaan Islam (SKI)',
  'Ilmu Pengetahuan Sosial (IPS)',
  'Geografi',
  'Ekonomi',
  'Sejarah',
  'Pendidikan Pancasila & Kewarganegaraan',
  'Informatika & Pemrograman',
  'Metodologi Penelitian',
  'Umum / Lintas Disiplin',
];

export const LANGUAGES: QuestionLanguage[] = [
  'Indonesia',
  'Arab',
  'Inggris',
  'Bilingual (Arab-Indonesia)',
  'Bilingual (Inggris-Indonesia)',
];

export const COGNITIVE_LEVELS: { code: CognitiveLevel; label: string; desc: string }[] = [
  { code: 'C1', label: 'C1 · Mengingat', desc: 'Fakta, definisi, istilah' },
  { code: 'C2', label: 'C2 · Memahami', desc: 'Menjelaskan, merangkum' },
  { code: 'C3', label: 'C3 · Menerapkan', desc: 'Menghitung, menggunakan rumus/kaidah' },
  { code: 'C4', label: 'C4 · Menganalisis', desc: 'Membandingkan, menguraikan sebab' },
  { code: 'C5', label: 'C5 · Mengevaluasi', desc: 'Menilai, mengkritik argumen' },
  { code: 'C6', label: 'C6 · Mencipta', desc: 'Merancang solusi, menyusun sintesis' },
];

export const ARABIC_FOCUSES: ArabicSubjectFocus[] = [
  'Umum Bahasa Arab',
  'Nahwu',
  'Sharaf',
  'Balaghah',
  'Fiqih',
  'Hadis',
  'Tafsir',
  'Aqidah Akhlak',
];

export const HARAKAT_MODES: HarakatMode[] = [
  'Penuh (Syakal Lengkap)',
  'Sebagian (Kata Kunci)',
  'Tanpa Harakat (Gundul)',
];

export const EXAM_TEMPLATES: ExamTemplate[] = [
  {
    id: 'tpl-nahwu-ma',
    name: 'Ujian Nahwu & I’rab (MA / Pesantren)',
    category: 'Bahasa Arab & Dirasah Islamiyah',
    level: 'MA',
    subject: 'Nahwu & Sharaf',
    language: 'Bilingual (Arab-Indonesia)',
    title: 'Al-Mubtada wal Khabar serta Nawasikh (Kana & Inna)',
    subtitles: [
      'Kaidah Mubtada dan Khabar serta Pembagiannya',
      'Amal Kana wa Akhwatuha pada Jumlah Ismiyah',
      'Amal Inna wa Akhwatuha serta Perubahan I’rab',
      'Analisis I’rab Kalimat Bahasa Arab Klasik',
    ],
    description:
      'Sertakan syakal penuh pada teks Arab, contoh kalimat dari Al-Quran atau kitab kuning dasar, serta variasi analisis i’rab.',
    questionCounts: {
      pilihan_ganda: 4,
      melengkapi_kalimat: 2,
      analisis_teks: 2,
      esai: 2,
    },
    difficulty: 'Campuran',
    cognitiveLevels: ['C2', 'C3', 'C4'],
    thinkingTier: 'MOTS',
    arabicFocus: 'Nahwu',
    harakatMode: 'Penuh (Syakal Lengkap)',
  },
  {
    id: 'tpl-arab-hijaiyah-imla',
    name: 'Latihan Hijaiyah, Sambung-Pisah & Menulis Ulang (Arab)',
    category: 'Bahasa Arab & Dirasah Islamiyah',
    level: 'SD',
    subject: 'Bahasa Arab',
    language: 'Bilingual (Arab-Indonesia)',
    title: 'الأَدَوَاتُ الْمَدْرَسِيَّةُ (Peralatan Sekolah & Latihan Kitabah)',
    subtitles: [
      'Memisahkan Kata Bahasa Arab menjadi Huruf Hijaiyah Tunggal',
      'Menyambungkan Huruf Hijaiyah Terpisah menjadi Kata Utuh',
      'Menulis Ulang Kosakata & Kalimat Sederhana (1, 2, 3+ Kata)',
    ],
    description:
      'Latihan dasar kitabah dan imla Bahasa Arab berharakat lengkap: pisah huruf hijaiyah, sambung huruf hijaiyah, dan menyalin kalimat bertahap.',
    questionCounts: {
      memisah_hijaiyah: 4,
      menyambung_hijaiyah: 4,
      menulis_ulang_kalimat: 4,
      menebalkan_mewarnai_arab: 2,
    },
    difficulty: 'Mudah',
    cognitiveLevels: ['C1', 'C2', 'C3'],
    thinkingTier: 'LOTS',
    arabicFocus: 'Umum Bahasa Arab',
    harakatMode: 'Penuh (Syakal Lengkap)',
  },
  {
    id: 'tpl-fiqih-arab',
    name: 'Evaluasi Fiqih Muamalah (Teks Arab)',
    category: 'Bahasa Arab & Dirasah Islamiyah',
    level: 'MA',
    subject: 'Fiqih & Ushul Fiqih',
    language: 'Arab',
    title: 'أحكام البيع والربا في الفقه الإسلامي',
    subtitles: [
      'شروط صحة البيع وأركانه',
      'أنواع الربا وحكمه الشرعي',
      'الخيارات في البيع (خيار المجلس وخيار الشرط)',
    ],
    description: 'Semua pertanyaan, pilihan jawaban, dan kunci pembahasan ditulis dalam Bahasa Arab fusha berharakat.',
    questionCounts: {
      pilihan_ganda: 5,
      benar_salah: 3,
      studi_kasus: 2,
    },
    difficulty: 'Sedang',
    cognitiveLevels: ['C2', 'C3', 'C4', 'C5'],
    thinkingTier: 'HOTS',
    arabicFocus: 'Fiqih',
    harakatMode: 'Penuh (Syakal Lengkap)',
  },
  {
    id: 'tpl-ipa-smp-visual',
    name: 'IPA Terpadu SMP (Sistem Peredaran Darah & Visual)',
    category: 'Sekolah Menengah',
    level: 'SMP',
    subject: 'Ilmu Pengetahuan Alam (IPA)',
    language: 'Indonesia',
    title: 'Sistem Peredaran Darah Manusia',
    subtitles: [
      'Struktur dan Fungsi Ruang Jantung',
      'Peredaran Darah Besar dan Kecil',
      'Komponen Darah dan Pembekuan Darah',
      'Gangguan dan Kelainan Sistem Sirkulasi',
    ],
    description: 'Fokus pada keterkaitan struktur organ dengan fungsinya serta soal observasi diagram.',
    questionCounts: {
      pilihan_ganda: 4,
      pilihan_ganda_kompleks: 2,
      berbasis_gambar: 2,
      menjodohkan: 1,
      esai: 1,
    },
    difficulty: 'Campuran',
    cognitiveLevels: ['C2', 'C3', 'C4'],
    thinkingTier: 'MOTS',
  },
  {
    id: 'tpl-matematika-sma-hots',
    name: 'Matematika SMA HOTS (Fungsi Kuadrat & Geometri)',
    category: 'Sekolah Menengah Atas',
    level: 'SMA/SMK',
    subject: 'Matematika',
    language: 'Indonesia',
    title: 'Fungsi Kuadrat dan Aplikasinya dalam Optimasi',
    subtitles: [
      'Sifat Grafik Parabola dan Titik Ekstrem',
      'Menyusun Persamaan Fungsi Kuadrat dari Grafik',
      'Masalah Kontekstual Nilai Maksimum dan Minimum',
    ],
    description: 'Sertakan soal berbasis grafik dan pemodelan masalah nyata tingkat HOTS.',
    questionCounts: {
      pilihan_ganda: 3,
      hots: 3,
      berbasis_gambar: 2,
      esai: 2,
    },
    difficulty: 'Sulit',
    cognitiveLevels: ['C3', 'C4', 'C5', 'C6'],
    thinkingTier: 'HOTS',
  },
  {
    id: 'tpl-sd-tematik',
    name: 'Latihan Tematik SD (Ekosistem & Rantai Makanan)',
    category: 'Sekolah Dasar',
    level: 'SD',
    subject: 'Ilmu Pengetahuan Alam (IPA)',
    language: 'Indonesia',
    title: 'Ekosistem dan Keseimbangan Rantai Makanan',
    subtitles: [
      'Komponen Biotik dan Abiotik',
      'Peran Produsen, Konsumen, dan Pengurai',
      'Dampak Perubahan Populasi pada Jaring-jaring Makanan',
    ],
    description: 'Gunakan bahasa sederhana yang ramah anak kelas 5 SD dengan contoh lingkungan sekitar.',
    questionCounts: {
      pilihan_ganda: 5,
      benar_salah: 2,
      isian_singkat: 2,
      mengurutkan: 1,
    },
    difficulty: 'Mudah',
    cognitiveLevels: ['C1', 'C2', 'C3'],
    thinkingTier: 'LOTS',
  },
  {
    id: 'tpl-pt-kasus',
    name: 'Evaluasi Perguruan Tinggi (Analisis Kebijakan Ekonomi)',
    category: 'Perguruan Tinggi',
    level: 'Perguruan Tinggi',
    subject: 'Ekonomi',
    language: 'Bilingual (Inggris-Indonesia)',
    title: 'Kebijakan Moneter, Inflasi, dan Stabilitas Makroekonomi',
    subtitles: [
      'Mekanisme Transmisi Kebijakan Suku Bunga Bank Sentral',
      'Trade-off Inflasi dan Pengangguran (Kurva Phillips)',
      'Dampak Nilai Tukar terhadap Neraca Perdagangan',
    ],
    description: 'Gunakan level analisis kritis setara S1 semester menengah dengan studi kasus kebijakan.',
    questionCounts: {
      studi_kasus: 2,
      analisis_teks: 2,
      hots: 2,
      esai: 2,
    },
    difficulty: 'Sulit',
    cognitiveLevels: ['C4', 'C5', 'C6'],
    thinkingTier: 'HOTS',
  },
];
