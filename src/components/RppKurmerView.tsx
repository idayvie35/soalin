import { useEffect, useState } from 'react';
import {
  BookOpen,
  Download,
  Edit3,
  Eye,
  Loader2,
  Printer,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_GRADE_BY_LEVEL,
  EDUCATION_LEVELS,
  GRADE_OPTIONS_BY_LEVEL,
  SUBJECT_LIST,
} from '../constants.ts';
import { generateRppApi } from '../services/api.ts';
import { exportRppToDocx } from '../services/docxExporter.ts';
import {
  EducationLevel,
  ExamProject,
  GenerationConfig,
  RppKurmer,
  UserProfile,
} from '../types.ts';
import { cleanAsterisks, getTextDirection, isPureArabicBlock } from '../utils/arabic.ts';
import { getFaseKurikulumMerdeka } from '../utils/kurikulumMerdeka.ts';

interface RppKurmerViewProps {
  profile: UserProfile;
  activeProject: ExamProject | null;
  genConfig: GenerationConfig;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

const LEARNING_MODELS = [
  'Problem Based Learning (PBL)',
  'Discovery Learning',
  'Project Based Learning (PjBL)',
  'Cooperative Learning (Think-Pair-Share)',
  'Contextual Teaching and Learning (CTL)',
  'Direct Instruction & Latihan Terbimbing',
];

const P5_DIMENSIONS = [
  'Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia',
  'Berkebinekaan Global',
  'Bergotong Royong',
  'Mandiri',
  'Bernalar Kritis',
  'Kreatif',
];

function buildInstantLocalRpp(params: {
  profile: UserProfile;
  subject: string;
  level: EducationLevel;
  gradeClass: string;
  topic: string;
  subtopics: string[];
  alokasiWaktu: string;
  jumlahPertemuan: string;
  modelPembelajaran: string;
  principalName: string;
  principalNip: string;
}): RppKurmer {
  const fase = getFaseKurikulumMerdeka(params.level, params.gradeClass);
  const now = new Date().toISOString();
  const topic = cleanAsterisks(params.topic || 'Materi Pembelajaran');
  const subs =
    params.subtopics.length > 0 ? params.subtopics.map((s) => cleanAsterisks(s)) : [topic];

  return {
    id: `rpp-local-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    institutionName: params.profile.institutionName || 'Sekolah Islam Terpadu Plus Cordova',
    institutionAddress:
      params.profile.institutionAddress || 'Sekolah Islam Terpadu Plus Cordova (SD–SMA)',
    teacherName: params.profile.fullName || 'Ustdz Mulyadi, S.T.',
    teacherNip: params.profile.nipOrId || '-',
    principalName: params.principalName || 'Kepala Sekolah SIT Plus Cordova',
    principalNip: params.principalNip || '-',
    subject: params.subject,
    level: params.level,
    gradeClass: params.gradeClass,
    fase,
    semester: params.profile.defaultSemester || 'Ganjil',
    academicYear: params.profile.defaultAcademicYear || '2026/2027',
    topic,
    subtopics: subs,
    alokasiWaktu: params.alokasiWaktu,
    jumlahPertemuan: params.jumlahPertemuan,
    modelPembelajaran: params.modelPembelajaran,
    targetPesertaDidik: 'Peserta didik reguler/tipikal (dengan diferensiasi kesiapan belajar)',
    kompetensiAwal: `Peserta didik telah mengenal konsep dasar ${params.subject} pada jenjang sebelumnya dan siap mendalami topik ${topic}.`,
    profilPelajarPancasila: [
      'Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia',
      'Bernalar Kritis',
      'Mandiri',
      'Bergotong Royong',
    ],
    saranaPrasarana:
      'Papan tulis, proyektor/LCD, LKPD (Lembar Kerja Peserta Didik), buku teks Kurikulum Merdeka, kartu materi, dan alat tulis.',
    capaianPembelajaran: `Pada akhir ${fase}, peserta didik mampu memahami, menganalisis, dan menerapkan konsep ${topic} (${subs.join(', ')}) dalam mata pelajaran ${params.subject} dengan sikap mandiri, bernalar kritis, dan berakhlak mulia.`,
    tujuanPembelajaran: [
      `Melalui kegiatan pengamatan dan diskusi terbimbing, peserta didik mampu menjelaskan konsep inti ${topic} dengan tepat.`,
      `Melalui latihan terstruktur pada LKPD, peserta didik mampu menerapkan pemahaman ${subs[0]} dalam menyelesaikan permasalahan kontekstual dengan benar.`,
      `Peserta didik menunjukkan sikap aktif, santun, dan bertanggung jawab selama proses pembelajaran kelompok.`,
    ],
    pemahamanBermakna: `Memahami ${topic} membekali peserta didik keterampilan berpikir sistematis dan menerapkannya secara bermakna dalam kehidupan sehari-hari serta ibadah.`,
    pertanyaanPemantik: [
      `Apa yang kamu ketahui tentang ${topic} dan mengapa hal ini penting dipelajari?`,
      `Bagaimana cara menerapkan konsep ${subs[0]} dalam situasi nyata di sekitar kita?`,
    ],
    kegiatanPembelajaran: {
      pendahuluan: {
        durasi: '10 Menit',
        langkah: [
          'Guru membuka pelajaran dengan salam, doa bersama, dan mengecek kehadiran serta kesiapan peserta didik.',
          `Apersepsi: Mengaitkan pengalaman sehari-hari peserta didik dengan materi ${topic}.`,
          'Menyampaikan tujuan pembelajaran, manfaat materi, dan alur kegiatan menggunakan model ' +
            params.modelPembelajaran +
            '.',
        ],
      },
      inti: {
        durasi: '60 Menit',
        langkah: [
          `Orientasi & Eksplorasi: Guru memaparkan stimulus singkat mengenai ${topic} (${subs.join(', ')}).`,
          'Pengorganisasian Belajar: Peserta didik dibagi dalam kelompok kecil untuk mendiskusikan LKPD dan memecahkan masalah inti.',
          'Penyelidikan & Praktik: Peserta didik menganalisis contoh, berlatih mandiri/kelompok, serta mengklarifikasi pemahaman kepada guru.',
          'Presentasi & Penguatan: Perwakilan kelompok memaparkan hasil kerja, ditanggapi bersama, dan guru memberikan penguatan konsep yang benar.',
        ],
      },
      penutup: {
        durasi: '10 Menit',
        langkah: [
          `Peserta didik bersama guru menyimpulkan poin-poin utama materi ${topic}.`,
          'Pelaksanaan evaluasi singkat (kuis formatif) dan refleksi perasaan serta pemahaman belajar.',
          'Guru menyampaikan agenda pertemuan berikutnya, penguatan adab Islami, doa kafaratul majelis, dan salam.',
        ],
      },
    },
    asesmen: {
      diagnostik: `Tanya jawab lisan di awal pelajaran untuk memetakan pengetahuan awal tentang ${topic}.`,
      formatif: `Observasi keaktifan diskusi kelompok, penilaian LKPD, serta umpan balik langsung selama praktik.`,
      sumatif: `Tes tertulis menggunakan paket soal evaluasi ${params.subject} (${topic}) mencakup level kognitif C1–C6 beserta rubrik penilaian.`,
    },
    pengayaanRemedial: {
      pengayaan: `Peserta didik yang mencapai ketuntasan lebih cepat diberikan soal tantangan HOTS / proyek eksplorasi lanjutan terkait ${topic}.`,
      remedial: `Bimbingan ulang konsep dasar ${topic} secara kelompok kecil dengan latihan terbimbing langkah demi langkah.`,
    },
    refleksi: {
      pendidik:
        'Apakah seluruh peserta didik telah mencapai tujuan pembelajaran? Langkah mana yang paling efektif dan perlu diperbaiki pada pertemuan berikutnya?',
      pesertaDidik:
        'Bagian materi apa yang paling kalian kuasai hari ini, dan bagian mana yang masih perlu dijelaskan ulang?',
    },
    glosarium: [
      {
        term: topic,
        definition: `Pokok bahasan utama dalam mata pelajaran ${params.subject} pada ${params.gradeClass} (${fase}).`,
      },
      {
        term: 'Asesmen Formatif',
        definition:
          'Penilaian selama proses pembelajaran untuk memantau perkembangan pemahaman peserta didik.',
      },
    ],
    daftarPustaka: `Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. Panduan Pembelajaran dan Asesmen Kurikulum Merdeka (${params.subject} · ${fase}).`,
  };
}

export function RppKurmerView({
  profile,
  activeProject,
  genConfig,
  onNotify,
}: RppKurmerViewProps) {
  const [subject, setSubject] = useState<string>(
    activeProject?.subject || genConfig.subject || 'Bahasa Arab'
  );
  const [level, setLevel] = useState<EducationLevel>(
    activeProject?.level || genConfig.level || profile.defaultLevel || 'SMP'
  );
  const [gradeClass, setGradeClass] = useState<string>(
    activeProject?.header.gradeClass ||
      activeProject?.gradeClass ||
      genConfig.gradeClass ||
      DEFAULT_GRADE_BY_LEVEL[activeProject?.level || genConfig.level || 'SMP']
  );
  const [topic, setTopic] = useState<string>(
    activeProject?.title || genConfig.title || ''
  );
  const [subtopicsText, setSubtopicsText] = useState<string>(
    (activeProject?.subtitles || genConfig.subtitles || []).join(', ')
  );
  const [alokasiWaktu, setAlokasiWaktu] = useState<string>('2 JP × 40 Menit');
  const [jumlahPertemuan, setJumlahPertemuan] = useState<string>('1 Pertemuan');
  const [modelPembelajaran, setModelPembelajaran] = useState<string>(LEARNING_MODELS[0]);
  const [principalName, setPrincipalName] = useState<string>(
    'Kepala Sekolah SIT Plus Cordova'
  );
  const [principalNip, setPrincipalNip] = useState<string>('-');

  const [rpp, setRpp] = useState<RppKurmer | null>(() => {
    try {
      const saved = localStorage.getItem('cordova_active_rpp_kurmer');
      return saved ? (JSON.parse(saved) as RppKurmer) : null;
    } catch {
      return null;
    }
  });
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  useEffect(() => {
    if (rpp) {
      try {
        localStorage.setItem('cordova_active_rpp_kurmer', JSON.stringify(rpp));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [rpp]);

  const handleSyncFromActiveExam = () => {
    if (activeProject) {
      setSubject(activeProject.subject);
      setLevel(activeProject.level);
      setGradeClass(
        activeProject.header.gradeClass ||
          activeProject.gradeClass ||
          DEFAULT_GRADE_BY_LEVEL[activeProject.level]
      );
      setTopic(activeProject.title);
      setSubtopicsText((activeProject.subtitles || []).join(', '));
      onNotify('info', 'Data disinkronkan dari Paket Soal aktif');
    } else if (genConfig.title) {
      setSubject(genConfig.subject);
      setLevel(genConfig.level);
      setGradeClass(genConfig.gradeClass || DEFAULT_GRADE_BY_LEVEL[genConfig.level]);
      setTopic(genConfig.title);
      setSubtopicsText((genConfig.subtitles || []).join(', '));
      onNotify('info', 'Data disinkronkan dari Form Generator');
    } else {
      onNotify('info', 'Belum ada paket soal aktif. Silakan isi topik secara manual.');
    }
  };

  const handleLevelChange = (nextLevel: EducationLevel) => {
    setLevel(nextLevel);
    setGradeClass(DEFAULT_GRADE_BY_LEVEL[nextLevel]);
  };

  const handleGenerateAi = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      onNotify('error', 'Topik / Materi Pokok wajib diisi terlebih dahulu.');
      return;
    }
    const subtopics = subtopicsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setIsGenerating(true);
    try {
      const generated = await generateRppApi({
        institutionName: profile.institutionName,
        institutionAddress: profile.institutionAddress,
        teacherName: profile.fullName,
        teacherNip: profile.nipOrId,
        principalName,
        principalNip,
        subject,
        level,
        gradeClass,
        semester: profile.defaultSemester,
        academicYear: profile.defaultAcademicYear,
        topic: trimmedTopic,
        subtopics,
        alokasiWaktu,
        jumlahPertemuan,
        modelPembelajaran,
        language: activeProject?.language || genConfig.language,
      });
      setRpp(generated);
      setMode('preview');
      onNotify('success', 'RPP / Modul Ajar Kurikulum Merdeka siap digunakan');
    } catch (err) {
      onNotify(
        'error',
        'AI RPP gagal merespons, beralih ke penyusun cepat lokal',
        (err as Error).message
      );
      const localRpp = buildInstantLocalRpp({
        profile,
        subject,
        level,
        gradeClass,
        topic: trimmedTopic,
        subtopics,
        alokasiWaktu,
        jumlahPertemuan,
        modelPembelajaran,
        principalName,
        principalNip,
      });
      setRpp(localRpp);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateInstantOffline = () => {
    const trimmedTopic = topic.trim() || 'Materi Pembelajaran';
    const subtopics = subtopicsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const created = buildInstantLocalRpp({
      profile,
      subject,
      level,
      gradeClass,
      topic: trimmedTopic,
      subtopics,
      alokasiWaktu,
      jumlahPertemuan,
      modelPembelajaran,
      principalName,
      principalNip,
    });
    setRpp(created);
    setMode('preview');
    onNotify('success', 'RPP Kurikulum Merdeka berhasil disusun seketika');
  };

  const handleExportDocx = async () => {
    if (!rpp) return;
    setIsExportingDocx(true);
    try {
      await exportRppToDocx(rpp);
      onNotify('success', 'File RPP Word (.docx) berhasil diunduh');
    } catch (err) {
      onNotify('error', 'Gagal mengekspor RPP DOCX', (err as Error).message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const gradeOptions = GRADE_OPTIONS_BY_LEVEL[level] || [];
  const faseLabel = getFaseKurikulumMerdeka(level, gradeClass);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="no-print flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Perangkat Ajar · Kurikulum Merdeka ({faseLabel})
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Generator RPP / Modul Ajar Kurikulum Merdeka
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncFromActiveExam}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Ambil dari Soal Aktif
          </button>
          {rpp && (
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#0F294A] px-3.5 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak / PDF A4
              </button>
              <button
                type="button"
                disabled={isExportingDocx}
                onClick={handleExportDocx}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                {isExportingDocx ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download Word (.docx)
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Configurator */}
        <div className="no-print space-y-4 xl:col-span-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Identitas &amp; Parameter Modul Ajar
            </h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Topik / Materi Pokok *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Contoh: Isim Mufrad, Mutsanna & Jamak / Tata Surya"
                  className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Subtopik (pisahkan koma)
                </label>
                <input
                  type="text"
                  value={subtopicsText}
                  onChange={(e) => setSubtopicsText(e.target.value)}
                  placeholder="Pengertian, Contoh Kalimat, Latihan"
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mata Pelajaran
                </label>
                <select
                  value={SUBJECT_LIST.includes(subject) ? subject : '__custom'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom') setSubject(e.target.value);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {SUBJECT_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {!SUBJECT_LIST.includes(subject) && (
                    <option value="__custom">{subject}</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jenjang
                  </label>
                  <select
                    value={level}
                    onChange={(e) => handleLevelChange(e.target.value as EducationLevel)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kelas ({faseLabel})
                  </label>
                  <select
                    value={gradeOptions.includes(gradeClass) ? gradeClass : gradeOptions[0] || ''}
                    onChange={(e) => setGradeClass(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Model Pembelajaran
                </label>
                <select
                  value={modelPembelajaran}
                  onChange={(e) => setModelPembelajaran(e.target.value)}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {LEARNING_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Alokasi Waktu
                  </label>
                  <input
                    type="text"
                    value={alokasiWaktu}
                    onChange={(e) => setAlokasiWaktu(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pertemuan
                  </label>
                  <input
                    type="text"
                    value={jumlahPertemuan}
                    onChange={(e) => setJumlahPertemuan(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    NIP / NIY Kepsek
                  </label>
                  <input
                    type="text"
                    value={principalNip}
                    onChange={(e) => setPrincipalNip(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerateAi}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0F294A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163B69] disabled:opacity-50 dark:bg-blue-600"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isGenerating
                    ? 'Menyusun RPP Kurikulum Merdeka...'
                    : 'Buat RPP Otomatis (AI Cepat)'}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateInstantOffline}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Susun Template Cepat Seketika (Offline)
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Preview / Editor */}
        <div className="xl:col-span-8">
          {!rpp ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                Belum Ada Dokumen RPP / Modul Ajar
              </h2>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                Isi Topik / Materi Pokok di panel kiri (atau klik &ldquo;Ambil dari Soal Aktif&rdquo;), lalu klik &ldquo;Buat RPP Otomatis (AI Cepat)&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mode Toggle */}
              <div className="no-print flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {rpp.subject} · {rpp.gradeClass} ({rpp.fase})
                </span>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setMode('preview')}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold ${
                      mode === 'preview'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Pratinjau A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold ${
                      mode === 'edit'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Isi RPP
                  </button>
                </div>
              </div>

              {mode === 'edit' ? (
                <div className="no-print space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Kompetensi Awal
                      </label>
                      <textarea
                        rows={3}
                        value={rpp.kompetensiAwal}
                        onChange={(e) => setRpp({ ...rpp, kompetensiAwal: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Sarana &amp; Prasarana
                      </label>
                      <textarea
                        rows={3}
                        value={rpp.saranaPrasarana}
                        onChange={(e) => setRpp({ ...rpp, saranaPrasarana: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Dimensi Profil Pelajar Pancasila (P5)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {P5_DIMENSIONS.map((dim) => {
                        const selected = rpp.profilPelajarPancasila.includes(dim);
                        return (
                          <button
                            key={dim}
                            type="button"
                            onClick={() =>
                              setRpp({
                                ...rpp,
                                profilPelajarPancasila: selected
                                  ? rpp.profilPelajarPancasila.filter((d) => d !== dim)
                                  : [...rpp.profilPelajarPancasila, dim],
                              })
                            }
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                              selected
                                ? 'border-[#0F294A] bg-[#0F294A] text-white dark:border-blue-500 dark:bg-blue-600'
                                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {dim}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Capaian Pembelajaran (CP)
                    </label>
                    <textarea
                      rows={3}
                      value={rpp.capaianPembelajaran}
                      onChange={(e) => setRpp({ ...rpp, capaianPembelajaran: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Tujuan Pembelajaran (1 baris = 1 poin)
                    </label>
                    <textarea
                      rows={4}
                      value={rpp.tujuanPembelajaran.join('\n')}
                      onChange={(e) =>
                        setRpp({
                          ...rpp,
                          tujuanPembelajaran: e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pemahaman Bermakna
                    </label>
                    <textarea
                      rows={2}
                      value={rpp.pemahamanBermakna}
                      onChange={(e) => setRpp({ ...rpp, pemahamanBermakna: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pertanyaan Pemantik (1 baris = 1 pertanyaan)
                    </label>
                    <textarea
                      rows={3}
                      value={rpp.pertanyaanPemantik.join('\n')}
                      onChange={(e) =>
                        setRpp({
                          ...rpp,
                          pertanyaanPemantik: e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Pendahuluan ({rpp.kegiatanPembelajaran.pendahuluan.durasi})
                      </label>
                      <textarea
                        rows={5}
                        value={rpp.kegiatanPembelajaran.pendahuluan.langkah.join('\n')}
                        onChange={(e) =>
                          setRpp({
                            ...rpp,
                            kegiatanPembelajaran: {
                              ...rpp.kegiatanPembelajaran,
                              pendahuluan: {
                                ...rpp.kegiatanPembelajaran.pendahuluan,
                                langkah: e.target.value.split('\n').filter((x) => x.trim()),
                              },
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Kegiatan Inti ({rpp.kegiatanPembelajaran.inti.durasi})
                      </label>
                      <textarea
                        rows={5}
                        value={rpp.kegiatanPembelajaran.inti.langkah.join('\n')}
                        onChange={(e) =>
                          setRpp({
                            ...rpp,
                            kegiatanPembelajaran: {
                              ...rpp.kegiatanPembelajaran,
                              inti: {
                                ...rpp.kegiatanPembelajaran.inti,
                                langkah: e.target.value.split('\n').filter((x) => x.trim()),
                              },
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Penutup ({rpp.kegiatanPembelajaran.penutup.durasi})
                      </label>
                      <textarea
                        rows={5}
                        value={rpp.kegiatanPembelajaran.penutup.langkah.join('\n')}
                        onChange={(e) =>
                          setRpp({
                            ...rpp,
                            kegiatanPembelajaran: {
                              ...rpp.kegiatanPembelajaran,
                              penutup: {
                                ...rpp.kegiatanPembelajaran.penutup,
                                langkah: e.target.value.split('\n').filter((x) => x.trim()),
                              },
                            },
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Asesmen Diagnostik
                      </label>
                      <textarea
                        rows={3}
                        value={rpp.asesmen.diagnostik}
                        onChange={(e) =>
                          setRpp({ ...rpp, asesmen: { ...rpp.asesmen, diagnostik: e.target.value } })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Asesmen Formatif
                      </label>
                      <textarea
                        rows={3}
                        value={rpp.asesmen.formatif}
                        onChange={(e) =>
                          setRpp({ ...rpp, asesmen: { ...rpp.asesmen, formatif: e.target.value } })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Asesmen Sumatif
                      </label>
                      <textarea
                        rows={3}
                        value={rpp.asesmen.sumatif}
                        onChange={(e) =>
                          setRpp({ ...rpp, asesmen: { ...rpp.asesmen, sumatif: e.target.value } })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Printable Official A4 Modul Ajar Kurikulum Merdeka */
                <div className="print-sheet mx-auto max-w-[840px] rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm md:p-8">
                  <div className="border-b-4 border-double border-slate-900 pb-2 text-center">
                    <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900">
                      {cleanAsterisks(rpp.institutionName)}
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      {cleanAsterisks(rpp.institutionAddress)}
                    </p>
                  </div>

                  <div className="mt-3 text-center">
                    <h3 className="text-sm font-bold uppercase text-[#0F294A]">
                      MODUL AJAR / RPP KURIKULUM MERDEKA
                    </h3>
                    <p className="text-xs font-semibold text-slate-800">
                      {cleanAsterisks(rpp.subject)} — {cleanAsterisks(rpp.topic)}
                    </p>
                  </div>

                  {/* A. Identitas Modul */}
                  <div className="mt-4">
                    <h4 className="mb-1.5 text-xs font-bold uppercase text-[#0F294A]">
                      A. Informasi Umum &amp; Identitas Modul
                    </h4>
                    <table className="w-full border-collapse border border-slate-300 text-[11px]">
                      <tbody>
                        <tr>
                          <td className="w-1/2 border border-slate-300 px-2.5 py-1">
                            <strong>Penyusun:</strong> {cleanAsterisks(rpp.teacherName)}
                          </td>
                          <td className="w-1/2 border border-slate-300 px-2.5 py-1">
                            <strong>Satuan Pendidikan:</strong> {cleanAsterisks(rpp.institutionName)}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 px-2.5 py-1">
                            <strong>Mata Pelajaran:</strong> {cleanAsterisks(rpp.subject)}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1">
                            <strong>Jenjang / Kelas / Fase:</strong> {rpp.level} · {rpp.gradeClass} ({rpp.fase})
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 px-2.5 py-1">
                            <strong>Tahun / Semester:</strong> {rpp.academicYear} / {rpp.semester}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1">
                            <strong>Alokasi Waktu:</strong> {rpp.alokasiWaktu} ({rpp.jumlahPertemuan})
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 px-2.5 py-1">
                            <strong>Model Pembelajaran:</strong> {cleanAsterisks(rpp.modelPembelajaran)}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1">
                            <strong>Target Peserta Didik:</strong> {cleanAsterisks(rpp.targetPesertaDidik)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-2 space-y-1 text-[11.5px] leading-snug text-slate-800">
                      <p>
                        <strong>Kompetensi Awal:</strong> {cleanAsterisks(rpp.kompetensiAwal)}
                      </p>
                      <p>
                        <strong>Profil Pelajar Pancasila (P5):</strong>{' '}
                        {rpp.profilPelajarPancasila.map((s) => cleanAsterisks(s)).join(', ')}
                      </p>
                      <p>
                        <strong>Sarana &amp; Prasarana:</strong> {cleanAsterisks(rpp.saranaPrasarana)}
                      </p>
                    </div>
                  </div>

                  {/* B. Komponen Inti */}
                  <div className="mt-4 space-y-2.5 text-[11.5px] leading-snug text-slate-800">
                    <h4 className="text-xs font-bold uppercase text-[#0F294A]">
                      B. Komponen Inti
                    </h4>

                    <div>
                      <p className="font-bold text-slate-900">1. Capaian Pembelajaran (CP):</p>
                      <p
                        dir={getTextDirection(rpp.capaianPembelajaran)}
                        className={
                          isPureArabicBlock(rpp.capaianPembelajaran)
                            ? 'font-arabic text-right text-sm'
                            : 'text-left'
                        }
                      >
                        {cleanAsterisks(rpp.capaianPembelajaran)}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900">2. Tujuan Pembelajaran (TP):</p>
                      <ol className="list-decimal space-y-0.5 pl-5">
                        {rpp.tujuanPembelajaran.map((tp, idx) => (
                          <li key={idx}>{cleanAsterisks(tp)}</li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900">3. Pemahaman Bermakna:</p>
                      <p>{cleanAsterisks(rpp.pemahamanBermakna)}</p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900">4. Pertanyaan Pemantik:</p>
                      <ol className="list-decimal space-y-0.5 pl-5">
                        {rpp.pertanyaanPemantik.map((q, idx) => (
                          <li key={idx}>{cleanAsterisks(q)}</li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <p className="mb-1 font-bold text-slate-900">5. Kegiatan Pembelajaran:</p>
                      <table className="w-full border-collapse border border-slate-300 text-[11px]">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="w-36 border border-slate-300 px-2 py-1 text-left">
                              Tahap &amp; Durasi
                            </th>
                            <th className="border border-slate-300 px-2 py-1 text-left">
                              Deskripsi Langkah Pembelajaran
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-slate-300 px-2 py-1.5 align-top font-semibold">
                              Pendahuluan
                              <div className="text-[10px] font-normal text-slate-600">
                                ({rpp.kegiatanPembelajaran.pendahuluan.durasi})
                              </div>
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5">
                              <ol className="list-decimal space-y-0.5 pl-4">
                                {rpp.kegiatanPembelajaran.pendahuluan.langkah.map((l, i) => (
                                  <li key={i}>{cleanAsterisks(l)}</li>
                                ))}
                              </ol>
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 px-2 py-1.5 align-top font-semibold">
                              Kegiatan Inti
                              <div className="text-[10px] font-normal text-slate-600">
                                ({rpp.kegiatanPembelajaran.inti.durasi})
                              </div>
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5">
                              <ol className="list-decimal space-y-0.5 pl-4">
                                {rpp.kegiatanPembelajaran.inti.langkah.map((l, i) => (
                                  <li key={i}>{cleanAsterisks(l)}</li>
                                ))}
                              </ol>
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 px-2 py-1.5 align-top font-semibold">
                              Penutup
                              <div className="text-[10px] font-normal text-slate-600">
                                ({rpp.kegiatanPembelajaran.penutup.durasi})
                              </div>
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5">
                              <ol className="list-decimal space-y-0.5 pl-4">
                                {rpp.kegiatanPembelajaran.penutup.langkah.map((l, i) => (
                                  <li key={i}>{cleanAsterisks(l)}</li>
                                ))}
                              </ol>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="print-avoid-break">
                      <p className="font-bold text-slate-900">6. Asesmen Pembelajaran:</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        <li>
                          <strong>Diagnostik (Awal):</strong> {cleanAsterisks(rpp.asesmen.diagnostik)}
                        </li>
                        <li>
                          <strong>Formatif (Proses):</strong> {cleanAsterisks(rpp.asesmen.formatif)}
                        </li>
                        <li>
                          <strong>Sumatif (Akhir):</strong> {cleanAsterisks(rpp.asesmen.sumatif)}
                        </li>
                      </ul>
                    </div>

                    <div className="print-avoid-break">
                      <p className="font-bold text-slate-900">7. Pengayaan &amp; Remedial:</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        <li>
                          <strong>Pengayaan:</strong> {cleanAsterisks(rpp.pengayaanRemedial.pengayaan)}
                        </li>
                        <li>
                          <strong>Remedial:</strong> {cleanAsterisks(rpp.pengayaanRemedial.remedial)}
                        </li>
                      </ul>
                    </div>

                    <div className="print-avoid-break">
                      <p className="font-bold text-slate-900">8. Refleksi Pendidik &amp; Peserta Didik:</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        <li>
                          <strong>Pendidik:</strong> {cleanAsterisks(rpp.refleksi.pendidik)}
                        </li>
                        <li>
                          <strong>Peserta Didik:</strong> {cleanAsterisks(rpp.refleksi.pesertaDidik)}
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* C. Lampiran */}
                  {rpp.glosarium.length > 0 && (
                    <div className="print-avoid-break mt-4 space-y-1 text-[11px] text-slate-800">
                      <h4 className="text-xs font-bold uppercase text-[#0F294A]">
                        C. Lampiran: Glosarium &amp; Daftar Pustaka
                      </h4>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {rpp.glosarium.map((g, i) => (
                          <li key={i}>
                            <strong>{cleanAsterisks(g.term)}:</strong> {cleanAsterisks(g.definition)}
                          </li>
                        ))}
                      </ul>
                      {rpp.daftarPustaka && (
                        <p className="pt-1 text-[10.5px] text-slate-600">
                          <strong>Daftar Pustaka:</strong> {cleanAsterisks(rpp.daftarPustaka)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Signature Block */}
                  <div className="print-avoid-break mt-6 grid grid-cols-2 gap-8 text-[11px] text-slate-800">
                    <div>
                      <p>Mengetahui,</p>
                      <p className="font-bold">Kepala Sekolah</p>
                      <div className="h-14" />
                      <p className="font-bold underline">{cleanAsterisks(rpp.principalName)}</p>
                      <p className="text-slate-600">NIP/NIY. {rpp.principalNip || '-'}</p>
                    </div>
                    <div>
                      <p>SIT Plus Cordova, {new Date().toLocaleDateString('id-ID')}</p>
                      <p className="font-bold">Guru Mata Pelajaran</p>
                      <div className="h-14" />
                      <p className="font-bold underline">{cleanAsterisks(rpp.teacherName)}</p>
                      <p className="text-slate-600">NIP/NIY. {rpp.teacherNip || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
