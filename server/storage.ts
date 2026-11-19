import fs from 'fs/promises';
import path from 'path';
import { BankQuestion, ExamProject, UserProfile } from '../src/types.ts';

interface DatabaseSchema {
  profile: UserProfile;
  projects: ExamProject[];
  bank: BankQuestion[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'soalin-db.json');

const DEFAULT_SEED: DatabaseSchema = {
  profile: {
    fullName: 'Ustdz Mulyadi, S.T.',
    roleTitle: 'Pengajar & Pengampu Evaluasi (SD–SMA)',
    nipOrId: '',
    institutionName: 'Sekolah Islam Terpadu Plus Cordova',
    institutionAddress: 'Sekolah Islam Terpadu Plus Cordova (Jenjang SD–SMA)',
    defaultLevel: 'SMP',
    defaultAcademicYear: '2026/2027',
    defaultSemester: 'Ganjil',
  },
  projects: [
    {
      id: 'proj-seed-nahwu-01',
      title: 'Al-Mubtada wal Khabar wa Nawasikhuhu',
      subtitles: [
        'Pengertian dan Syarat Mubtada dan Khabar',
        'Kesesuaian (Muthabaqah) antara Mubtada dan Khabar',
        'Amal Kana wa Akhwatuha',
      ],
      subject: 'Nahwu & Sharaf',
      level: 'SMA/SMK',
      language: 'Bilingual (Arab-Indonesia)',
      difficulty: 'Campuran',
      isFavorite: true,
      createdAt: '2026-11-10T08:30:00.000Z',
      updatedAt: '2026-11-12T10:15:00.000Z',
      header: {
        institutionName: 'Sekolah Islam Terpadu Plus Cordova',
        institutionAddress: 'Sekolah Islam Terpadu Plus Cordova (Jenjang SD–SMA)',
        examTitle: 'PENILAIAN AKHIR SEMESTER (PAS)',
        subject: 'Nahwu & Sharaf',
        level: 'SMA/SMK',
        gradeClass: 'XI',
        semester: 'Ganjil',
        academicYear: '2026/2027',
        teacherName: 'Ustdz Mulyadi, S.T.',
        teacherNip: '',
        timeAllocation: '90 Menit',
        instructions:
          '1. Bacalah basmalah sebelum mengerjakan. 2. Perhatikan harakat dan kaidah i’rab pada setiap kalimat Arab.',
        includeStudentIdentityBox: true,
      },
      questions: [
        {
          id: 'q-seed-1',
          number: 1,
          type: 'pilihan_ganda',
          topicTag: 'Amal Kana wa Akhwatuha',
          difficulty: 'Sedang',
          cognitiveLevel: 'C3',
          thinkingTier: 'MOTS',
          weight: 2,
          isArabic: true,
          isRTL: false,
          prompt:
            'اخْتَرِ الجُمْلَةَ الصَّحِيحَةَ نَحْوِيًّا بَعْدَ دُخُولِ (كَانَ) عَلَى الجُمْلَةِ: «الطَّالِبَانِ مُجْتَهِدَانِ»:',
          options: [
            {
              label: 'أ',
              text: 'كَانَ الطَّالِبَانِ مُجْتَهِدَانِ',
              isCorrect: false,
              distractorReason: 'Salah karena khabar Kana harus manshub dengan ya (مُجْتَهِدَيْنِ), bukan marfu’.',
            },
            {
              label: 'ب',
              text: 'كَانَ الطَّالِبَيْنِ مُجْتَهِدَانِ',
              isCorrect: false,
              distractorReason: 'Salah karena isim Kana harus marfu’ dengan alif (الطَّالِبَانِ), dan khabarnya harus manshub.',
            },
            {
              label: 'ج',
              text: 'كَانَ الطَّالِبَانِ مُجْتَهِدَيْنِ',
              isCorrect: true,
            },
            {
              label: 'د',
              text: 'كَانَ الطَّالِبَيْنِ مُجْتَهِدَيْنِ',
              isCorrect: false,
              distractorReason: 'Salah karena isim Kana dalam bentuk mutsanna tetap marfu’ dengan alif.',
            },
            {
              label: 'هـ',
              text: 'كَانَا الطَّالِبَانِ مُجْتَهِدَيْنِ',
              isCorrect: false,
              distractorReason: 'Salah karena fi’il tidak diberi dhamir tatsniyah jika fa’il atau isimnya berupa isim zhahir.',
            },
          ],
          correctAnswer: 'ج',
          explanation:
            'Kaidah Kana wa Akhwatuha: تَرْفَعُ الِاسْمَ وَتَنْصِبُ الخَبَرَ (merafa’kan isimnya dan menashabkan khabarnya). Karena الطَّالِبَانِ berbentuk mutsanna, tanda rafa’-nya adalah Alif (الطَّالِبَانِ) dan tanda nashab khabarnya adalah Ya (مُجْتَهِدَيْنِ).',
          distractorAnalysis:
            'Opsi أ keliru karena membiarkan khabar marfu’. Opsi ب terbalik hukum rafa’ dan nashabnya. Opsi د menashabkan keduanya. Opsi هـ menambahkan alif itsnain padahal isim zhahir disebutkan.',
          verifiedByAI: true,
        },
        {
          id: 'q-seed-2',
          number: 2,
          type: 'analisis_teks',
          topicTag: 'Pengertian dan Syarat Mubtada dan Khabar',
          difficulty: 'Sulit',
          cognitiveLevel: 'C4',
          thinkingTier: 'HOTS',
          weight: 5,
          isArabic: true,
          isRTL: false,
          readingPassage:
            'العِلْمُ نُورٌ يَهْدِي القُلُوبَ، وَالمُتَعَلِّمُونَ حَرِيصُونَ عَلَى طَلَبِهِ فِي كُلِّ وَقْتٍ.',
          readingTranslation:
            'Ilmu adalah cahaya yang menerangi hati, dan para penuntut ilmu bersungguh-sungguh mencarinya di setiap waktu.',
          prompt:
            'Identifikasi kedudukan i’rab (Mubtada dan Khabar) serta tanda rafa’ dari kata «العِلْمُ»، «نُورٌ»، «المُتَعَلِّمُونَ»، dan «حَرِيصُونَ» pada teks di atas!',
          correctAnswer:
            'العِلْمُ: مبتدأ مرفوع بالضمة; نُورٌ: خبر مرفوع بالضمة; المُتَعَلِّمُونَ: مبتدأ مرفوع بالواو (جمع مذكر سالم); حَرِيصُونَ: خبر مرفوع بالواو (جمع مذكر سالم).',
          explanation:
            'Teks terdiri atas dua jumlah ismiyah. Pada jumlah pertama, isim mufrad dirafa’kan dengan dhammah zhahirah. Pada jumlah kedua, jamak mudzakkar salim dirafa’kan dengan huruf wawu sebagai pengganti dhammah.',
          rubric:
            'Skor 5: Menyebutkan 4 kedudukan + 4 tanda i’rab + alasan jamak mudzakkar salim dengan tepat. Skor 3: 2–3 analisis tepat. Skor 1: Hanya menerjemahkan tanpa analisis i’rab.',
          verifiedByAI: true,
        },
      ],
      qualityReport: {
        overallScore: 98,
        materialAlignment: true,
        answerKeyVerified: true,
        noDuplicates: true,
        arabicGrammarChecked: true,
        notes: [
          'Harakat dan i’rab mutsanna serta jamak mudzakkar salim telah tervalidasi sesuai kaidah Alfiyah & Jurumiyah.',
          'Tingkat kognitif tersebar pada C3 (MOTS) dan C4 (HOTS).',
        ],
        checkedAt: '2026-11-12T10:15:00.000Z',
      },
    },
    {
      id: 'proj-seed-ipa-02',
      title: 'Struktur Sel Tumbuhan dan Fotosintesis',
      subtitles: [
        'Organel Khas Sel Tumbuhan (Kloroplas & Dinding Sel)',
        'Reaksi Terang dan Siklus Calvin',
        'Faktor yang Memengaruhi Laju Fotosintesis',
      ],
      subject: 'Biologi',
      level: 'SMP',
      language: 'Indonesia',
      difficulty: 'Sedang',
      isFavorite: false,
      createdAt: '2026-11-09T14:20:00.000Z',
      updatedAt: '2026-11-11T09:00:00.000Z',
      header: {
        institutionName: 'Sekolah Islam Terpadu Plus Cordova',
        institutionAddress: 'Sekolah Islam Terpadu Plus Cordova (Jenjang SD–SMA)',
        examTitle: 'ASESMEN SUMATIF HARIAN',
        subject: 'Biologi / IPA Terpadu',
        level: 'SMP',
        gradeClass: 'VIII A',
        semester: 'Ganjil',
        academicYear: '2026/2027',
        teacherName: 'Ustdz Mulyadi, S.T.',
        teacherNip: '',
        timeAllocation: '60 Menit',
        instructions: 'Kerjakan soal dengan teliti dan perhatikan diagram penampang daun.',
        includeStudentIdentityBox: true,
      },
      questions: [
        {
          id: 'q-seed-3',
          number: 1,
          type: 'berbasis_gambar',
          topicTag: 'Organel Khas Sel Tumbuhan',
          difficulty: 'Sedang',
          cognitiveLevel: 'C4',
          thinkingTier: 'HOTS',
          weight: 4,
          isArabic: false,
          isRTL: false,
          prompt:
            'Perhatikan diagram penampang melintang daun di bawah ini. Jika bagian berlabel X (jaringan tiang/palisade) mengalami kerusakan akibat serangan hama, dampak paling langsung terhadap proses fotosintesis adalah...',
          visual: {
            visualType: 'Diagram Anatomi Daun',
            caption: 'Diagram Penampang Melintang Daun Tumbuhan Dikotil',
            svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240" width="480" height="240">
  <rect width="480" height="240" fill="#ffffff" rx="8"/>
  <rect x="40" y="30" width="320" height="16" fill="#d9f99d" stroke="#4d7c0f" stroke-width="1.5"/>
  <text x="372" y="42" font-family="sans-serif" font-size="11" fill="#1e293b">Epidermis Atas</text>
  <g fill="#65a30d" stroke="#365314" stroke-width="1.2">
    <rect x="48" y="48" width="24" height="58" rx="4"/>
    <rect x="78" y="48" width="24" height="58" rx="4"/>
    <rect x="108" y="48" width="24" height="58" rx="4"/>
    <rect x="138" y="48" width="24" height="58" rx="4"/>
    <rect x="168" y="48" width="24" height="58" rx="4"/>
    <rect x="198" y="48" width="24" height="58" rx="4"/>
    <rect x="228" y="48" width="24" height="58" rx="4"/>
    <rect x="258" y="48" width="24" height="58" rx="4"/>
    <rect x="288" y="48" width="24" height="58" rx="4"/>
    <rect x="318" y="48" width="24" height="58" rx="4"/>
  </g>
  <line x1="342" y1="76" x2="368" y2="76" stroke="#0f172a" stroke-width="1.5"/>
  <circle cx="378" cy="76" r="11" fill="#0f294a"/>
  <text x="378" y="80" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="12" fill="#ffffff">X</text>
  <text x="396" y="80" font-family="sans-serif" font-size="11" fill="#1e293b">Parenkim Palisade</text>
  <g fill="#bef264" stroke="#4d7c0f" stroke-width="1.2">
    <circle cx="75" cy="135" r="16"/>
    <circle cx="122" cy="148" r="15"/>
    <circle cx="170" cy="132" r="17"/>
    <circle cx="222" cy="146" r="16"/>
    <circle cx="275" cy="136" r="15"/>
    <circle cx="325" cy="145" r="16"/>
  </g>
  <text x="372" y="142" font-family="sans-serif" font-size="11" fill="#1e293b">Jaringan Spons</text>
  <rect x="40" y="182" width="130" height="16" fill="#d9f99d" stroke="#4d7c0f" stroke-width="1.5"/>
  <rect x="210" y="182" width="150" height="16" fill="#d9f99d" stroke="#4d7c0f" stroke-width="1.5"/>
  <ellipse cx="190" cy="190" rx="14" ry="8" fill="#0284c7" stroke="#0369a1" stroke-width="1.5"/>
  <text x="372" y="194" font-family="sans-serif" font-size="11" fill="#1e293b">Epidermis &amp; Stomata</text>
</svg>`,
          },
          options: [
            {
              label: 'A',
              text: 'Pertukaran gas karbon dioksida dan oksigen terhenti total karena stomata tertutup.',
              isCorrect: false,
              distractorReason: 'Stomata berada di epidermis bawah, bukan pada bagian berlabel X.',
            },
            {
              label: 'B',
              text: 'Penangkapan energi cahaya matahari dan produksi glukosa menurun drastis karena X memiliki kepadatan kloroplas tertinggi.',
              isCorrect: true,
            },
            {
              label: 'C',
              text: 'Pengangkutan air dari akar ke daun terhenti karena xilem tidak lagi berfungsi.',
              isCorrect: false,
              distractorReason: 'Xilem adalah berkas pengangkut, bukan parenkim palisade.',
            },
            {
              label: 'D',
              text: 'Penguapan air melalui permukaan daun meningkat tajam karena lapisan lilin hilang.',
              isCorrect: false,
              distractorReason: 'Lapisan lilin adalah kutikula di atas epidermis atas.',
            },
          ],
          correctAnswer: 'B',
          explanation:
            'Bagian X adalah jaringan parenkim palisade (jaringan tiang) yang tersusun rapat di bawah epidermis atas dan mengandung jumlah kloroplas paling banyak. Kerusakan pada jaringan ini menurunkan penyerapan cahaya dan laju sintesis glukosa secara signifikan.',
          distractorAnalysis:
            'Opsi A merujuk fungsi stomata, opsi C merujuk fungsi xilem, dan opsi D merujuk fungsi kutikula.',
          verifiedByAI: true,
        },
      ],
      qualityReport: {
        overallScore: 96,
        materialAlignment: true,
        answerKeyVerified: true,
        noDuplicates: true,
        arabicGrammarChecked: true,
        notes: [
          'Diagram penampang daun sesuai label anatomi standar SMP/MTs.',
          'Pengecoh opsi menguji kemampuan membedakan fungsi jaringan palisade, stomata, xilem, dan kutikula.',
        ],
        checkedAt: '2026-11-11T09:00:00.000Z',
      },
    },
  ],
  bank: [
    {
      id: 'bank-seed-1',
      savedAt: '2026-11-12T10:20:00.000Z',
      subject: 'Nahwu & Sharaf',
      level: 'MA',
      language: 'Bilingual (Arab-Indonesia)',
      isFavorite: true,
      question: {
        id: 'q-seed-1',
        number: 1,
        type: 'pilihan_ganda',
        topicTag: 'Amal Kana wa Akhwatuha',
        difficulty: 'Sedang',
        cognitiveLevel: 'C3',
        thinkingTier: 'MOTS',
        weight: 2,
        isArabic: true,
        isRTL: false,
        prompt:
          'اخْتَرِ الجُمْلَةَ الصَّحِيحَةَ نَحْوِيًّا بَعْدَ دُخُولِ (كَانَ) عَلَى الجُمْلَةِ: «الطَّالِبَانِ مُجْتَهِدَانِ»:',
        options: [
          { label: 'أ', text: 'كَانَ الطَّالِبَانِ مُجْتَهِدَانِ', isCorrect: false },
          { label: 'ب', text: 'كَانَ الطَّالِبَيْنِ مُجْتَهِدَانِ', isCorrect: false },
          { label: 'ج', text: 'كَانَ الطَّالِبَانِ مُجْتَهِدَيْنِ', isCorrect: true },
          { label: 'د', text: 'كَانَ الطَّالِبَيْنِ مُجْتَهِدَيْنِ', isCorrect: false },
        ],
        correctAnswer: 'ج',
        explanation:
          'Kana merafa’kan isimnya (الطَّالِبَانِ dengan Alif) dan menashabkan khabarnya (مُجْتَهِدَيْنِ dengan Ya).',
        verifiedByAI: true,
      },
    },
  ],
};

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDb(): Promise<DatabaseSchema> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_SEED, null, 2), 'utf-8');
    return structuredClone(DEFAULT_SEED);
  }
}

async function saveDb(data: DatabaseSchema): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmpPath = `${DB_PATH}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmpPath, DB_PATH);
  });
  return writeQueue;
}

export async function getProjects(): Promise<ExamProject[]> {
  const db = await ensureDb();
  return db.projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function upsertProject(project: ExamProject): Promise<ExamProject> {
  const db = await ensureDb();
  const idx = db.projects.findIndex((p) => p.id === project.id);
  const now = new Date().toISOString();
  const nextProject: ExamProject = {
    ...project,
    createdAt: project.createdAt || now,
    updatedAt: now,
  };
  if (idx >= 0) {
    db.projects[idx] = nextProject;
  } else {
    db.projects.unshift(nextProject);
  }
  await saveDb(db);
  return nextProject;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await ensureDb();
  db.projects = db.projects.filter((p) => p.id !== id);
  await saveDb(db);
}

export async function duplicateProject(id: string): Promise<ExamProject | null> {
  const db = await ensureDb();
  const orig = db.projects.find((p) => p.id === id);
  if (!orig) return null;
  const now = new Date().toISOString();
  const copy: ExamProject = {
    ...structuredClone(orig),
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: `${orig.title} (Salinan)`,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  };
  db.projects.unshift(copy);
  await saveDb(db);
  return copy;
}

export async function getBankQuestions(): Promise<BankQuestion[]> {
  const db = await ensureDb();
  return db.bank.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function addBankQuestion(item: BankQuestion): Promise<BankQuestion> {
  const db = await ensureDb();
  const existingIdx = db.bank.findIndex((b) => b.id === item.id);
  if (existingIdx >= 0) {
    db.bank[existingIdx] = item;
  } else {
    db.bank.unshift(item);
  }
  await saveDb(db);
  return item;
}

export async function toggleBankFavorite(id: string): Promise<BankQuestion | null> {
  const db = await ensureDb();
  const item = db.bank.find((b) => b.id === id);
  if (!item) return null;
  item.isFavorite = !item.isFavorite;
  await saveDb(db);
  return item;
}

export async function deleteBankQuestion(id: string): Promise<void> {
  const db = await ensureDb();
  db.bank = db.bank.filter((b) => b.id !== id);
  await saveDb(db);
}

export async function getProfile(): Promise<UserProfile> {
  const db = await ensureDb();
  return db.profile;
}

export async function updateProfile(profile: UserProfile): Promise<UserProfile> {
  const db = await ensureDb();
  db.profile = profile;
  await saveDb(db);
  return db.profile;
}
