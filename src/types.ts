export type EducationLevel =
  | 'SD'
  | 'SMP'
  | 'SMA/SMK'
  | 'MA'
  | 'Perguruan Tinggi'
  | 'Umum';

export type QuestionLanguage =
  | 'Indonesia'
  | 'Arab'
  | 'Inggris'
  | 'Bilingual (Arab-Indonesia)'
  | 'Bilingual (Inggris-Indonesia)';

export type QuestionType =
  | 'pilihan_ganda'
  | 'pilihan_ganda_kompleks'
  | 'benar_salah'
  | 'esai'
  | 'isian_singkat'
  | 'menjodohkan'
  | 'melengkapi_kalimat'
  | 'mengurutkan'
  | 'studi_kasus'
  | 'analisis_teks'
  | 'hots'
  | 'berbasis_gambar'
  | 'berbasis_bacaan'
  | 'memisah_hijaiyah'
  | 'menyambung_hijaiyah'
  | 'menulis_ulang_kalimat'
  | 'menebalkan_mewarnai_arab';

export type DifficultyLevel = 'Mudah' | 'Sedang' | 'Sulit' | 'Campuran';
export type CognitiveLevel = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
export type ThinkingTier = 'LOTS' | 'MOTS' | 'HOTS' | 'Campuran';
export type MaterialDepth = 'Dasar' | 'Menengah' | 'Mendalam';
export type LanguageTone = 'Formal' | 'Akademis' | 'Sederhana';

export type ArabicSubjectFocus =
  | 'Umum Bahasa Arab'
  | 'Nahwu'
  | 'Sharaf'
  | 'Balaghah'
  | 'Fiqih'
  | 'Hadis'
  | 'Tafsir'
  | 'Aqidah Akhlak';

export type HarakatMode = 'Penuh (Syakal Lengkap)' | 'Sebagian (Kata Kunci)' | 'Tanpa Harakat (Gundul)';

export interface QuestionOption {
  label: string; // e.g. 'A', 'B', 'C', 'D', 'E' or 'أ', 'ب', 'ج', 'د', 'هـ'
  text: string;
  isCorrect: boolean;
  distractorReason?: string;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface QuestionVisual {
  svgMarkup?: string; // Clean self-contained SVG diagram
  imageUrl?: string;  // Custom uploaded data URL or user URL
  caption: string;
  visualType: string; // e.g., 'Diagram IPA', 'Bangun Datar', 'Grafik Matematika', 'Peta', etc.
}

export interface QuestionItem {
  id: string;
  number: number;
  type: QuestionType;
  topicTag: string; // Subjudul / Pokok bahasan
  difficulty: 'Mudah' | 'Sedang' | 'Sulit';
  cognitiveLevel: CognitiveLevel;
  thinkingTier: 'LOTS' | 'MOTS' | 'HOTS';
  weight: number; // Bobot nilai
  isArabic: boolean;
  isRTL: boolean;
  readingPassage?: string; // Bacaan / teks Arab / teks studi kasus
  readingTranslation?: string; // Terjemahan jika bilingual / analisis Arab
  prompt: string;
  arabicPrompt?: string; // Teks Arab terpisah jika bilingual
  options?: QuestionOption[];
  matchingPairs?: MatchingPair[];
  sequenceItems?: string[]; // Urutan yang benar
  correctAnswer: string; // Kunci jawaban utama
  correctAnswers?: string[]; // Untuk PG Kompleks / multiple answers
  explanation: string; // Pembahasan mendidik
  distractorAnalysis?: string; // Penjelasan mengapa opsi lain salah
  rubric?: string; // Pedoman penilaian / rubrik untuk esai/studi kasus
  capaianPembelajaran?: string; // CP Kurikulum Merdeka
  tujuanPembelajaran?: string; // TP Kurikulum Merdeka
  indikatorSoal?: string; // Indikator pencapaian soal (ABCD)
  visual?: QuestionVisual | null;
  verifiedByAI?: boolean;
}

export interface QualityReport {
  overallScore: number;
  materialAlignment: boolean;
  answerKeyVerified: boolean;
  noDuplicates: boolean;
  arabicGrammarChecked: boolean;
  notes: string[];
  checkedAt: string;
}

export interface ExamHeader {
  institutionName: string;
  institutionAddress: string;
  examTitle: string;
  subject: string;
  level: EducationLevel;
  gradeClass: string;
  semester: string;
  academicYear: string;
  teacherName: string;
  teacherNip: string;
  timeAllocation: string;
  instructions: string;
  includeStudentIdentityBox: boolean;
}

export interface GenerationConfig {
  title: string;
  subtitles: string[];
  description: string;
  level: EducationLevel;
  gradeClass?: string;
  subject: string;
  language: QuestionLanguage;
  optionCount?: 3 | 4 | 5;
  questionCounts: Record<QuestionType, number>;
  difficulty: DifficultyLevel;
  cognitiveLevels: CognitiveLevel[];
  thinkingTier: ThinkingTier;
  depth: MaterialDepth;
  tone: LanguageTone;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  enableVisuals: boolean;
  arabicFocus: ArabicSubjectFocus;
  harakatMode: HarakatMode;
  rewriteWordMode?: 'exact' | 'progressive';
  rewriteWordCount?: number;
}

export interface ExamProject {
  id: string;
  title: string;
  subtitles: string[];
  subject: string;
  level: EducationLevel;
  gradeClass?: string;
  language: QuestionLanguage;
  difficulty: DifficultyLevel;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  header: ExamHeader;
  config?: Partial<GenerationConfig>;
  questions: QuestionItem[];
  qualityReport?: QualityReport;
}

export interface BankQuestion {
  id: string;
  savedAt: string;
  subject: string;
  level: EducationLevel;
  language: QuestionLanguage;
  isFavorite: boolean;
  question: QuestionItem;
}

export interface UserProfile {
  fullName: string;
  roleTitle: string;
  nipOrId: string;
  institutionName: string;
  institutionAddress: string;
  defaultLevel: EducationLevel;
  defaultAcademicYear: string;
  defaultSemester: string;
}

export interface ExamTemplate {
  id: string;
  name: string;
  category: string;
  level: EducationLevel;
  gradeClass?: string;
  subject: string;
  language: QuestionLanguage;
  title: string;
  subtitles: string[];
  description: string;
  questionCounts: Partial<Record<QuestionType, number>>;
  difficulty: DifficultyLevel;
  cognitiveLevels: CognitiveLevel[];
  thinkingTier: ThinkingTier;
  arabicFocus?: ArabicSubjectFocus;
  harakatMode?: HarakatMode;
}

export interface RppActivityPhase {
  durasi: string;
  langkah: string[];
}

export interface RppGlossaryItem {
  term: string;
  definition: string;
}

export interface RppKurmer {
  id: string;
  createdAt: string;
  updatedAt: string;
  institutionName: string;
  institutionAddress: string;
  teacherName: string;
  teacherNip: string;
  principalName: string;
  principalNip: string;
  subject: string;
  level: EducationLevel;
  gradeClass: string;
  fase: string;
  semester: string;
  academicYear: string;
  topic: string;
  subtopics: string[];
  alokasiWaktu: string;
  jumlahPertemuan: string;
  modelPembelajaran: string;
  targetPesertaDidik: string;
  kompetensiAwal: string;
  profilPelajarPancasila: string[];
  saranaPrasarana: string;
  capaianPembelajaran: string;
  tujuanPembelajaran: string[];
  pemahamanBermakna: string;
  pertanyaanPemantik: string[];
  kegiatanPembelajaran: {
    pendahuluan: RppActivityPhase;
    inti: RppActivityPhase;
    penutup: RppActivityPhase;
  };
  asesmen: {
    diagnostik: string;
    formatif: string;
    sumatif: string;
  };
  pengayaanRemedial: {
    pengayaan: string;
    remedial: string;
  };
  refleksi: {
    pendidik: string;
    pesertaDidik: string;
  };
  glosarium: RppGlossaryItem[];
  daftarPustaka: string;
}

