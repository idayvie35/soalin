import { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  FileText,
  Globe,
  Loader2,
  Printer,
} from 'lucide-react';
import { QUESTION_TYPE_META } from '../constants.ts';
import {
  generateBloggerHtmlSnippet,
  generateStandaloneHtmlDocument,
} from '../services/bloggerStandaloneExporter.ts';
import { DocxExportMode, exportProjectToDocx } from '../services/docxExporter.ts';
import { ExamHeader, ExamProject } from '../types.ts';
import {
  cleanAsterisks,
  getTextDirection,
  hasArabicText,
  isPureArabicBlock,
} from '../utils/arabic.ts';
import { getSynchronizedMatching } from '../utils/matching.ts';
import { buildKisiKisiRow, getFaseKurikulumMerdeka } from '../utils/kurikulumMerdeka.ts';

interface ExportStudioViewProps {
  project: ExamProject | null;
  onUpdateHeader: (header: ExamHeader) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  onGoToGenerator: () => void;
  initialTab?: 'document' | 'blogger';
}

export function ExportStudioView({
  project,
  onUpdateHeader,
  onNotify,
  onGoToGenerator,
  initialTab = 'document',
}: ExportStudioViewProps) {
  const [activeTab, setActiveTab] = useState<'document' | 'blogger'>(initialTab);
  const [exportMode, setExportMode] = useState<DocxExportMode>('complete');
  const [includeKisiKisi, setIncludeKisiKisi] = useState(true);
  const [compactPrint, setCompactPrint] = useState(true);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [bloggerSubTab, setBloggerSubTab] = useState<'blogger' | 'standalone'>('blogger');
  const [copiedCode, setCopiedCode] = useState(false);

  const bloggerCode = useMemo(
    () => (project ? generateBloggerHtmlSnippet(project) : ''),
    [project]
  );

  const standaloneCode = useMemo(
    () => (project ? generateStandaloneHtmlDocument(project) : ''),
    [project]
  );

  if (!project) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <FileText className="mx-auto h-10 w-10 text-slate-400" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
          Pilih atau Buat Paket Soal Terlebih Dahulu
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Ekspor PDF, DOCX, Cetak Naskah Ujian, dan Generator Kode Blogger/Standalone membutuhkan paket soal yang aktif.
        </p>
        <button
          type="button"
          onClick={onGoToGenerator}
          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0F294A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
        >
          Buat Soal Sekarang
        </button>
      </div>
    );
  }

  const { header } = project;

  const updateHeaderField = <K extends keyof ExamHeader>(
    key: K,
    value: ExamHeader[K]
  ) => {
    onUpdateHeader({ ...header, [key]: value });
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadDocx = async () => {
    setIsExportingDocx(true);
    try {
      await exportProjectToDocx(project, exportMode, includeKisiKisi);
      onNotify('success', 'Dokumen Word (.docx) berhasil diunduh');
    } catch (err) {
      onNotify('error', 'Gagal mengekspor DOCX', (err as Error).message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleCopyBloggerCode = async () => {
    const code = bloggerSubTab === 'blogger' ? bloggerCode : standaloneCode;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      onNotify(
        'success',
        bloggerSubTab === 'blogger'
          ? 'Kode HTML Blogger disalin ke clipboard'
          : 'Kode HTML Standalone disalin ke clipboard'
      );
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin otomatis. Silakan salin manual dari kotak kode.');
    }
  };

  const handleDownloadStandaloneHtml = () => {
    const blob = new Blob([standaloneCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = project.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '-').slice(0, 40);
    a.href = url;
    a.download = `${safeName}-Standalone-Exam.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onNotify('success', 'File HTML Standalone berhasil diunduh');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Bar */}
      <div className="no-print flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Ekspor &amp; Publikasi · {project.title}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Studio Naskah Ujian, PDF, DOCX &amp; Blogger
          </h1>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('document')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'document'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Printer className="h-3.5 w-3.5" />
            Naskah PDF / DOCX
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('blogger')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'blogger'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Blogger &amp; Standalone HTML
          </button>
        </div>
      </div>

      {activeTab === 'blogger' ? (
        /* BLOGGER & STANDALONE STUDIO */
        <div className="no-print grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Ekspor Versi Blogger &amp; Web Standalone
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Terbitkan paket soal interaktif ini langsung ke artikel Blogspot/Blogger atau unduh sebagai satu file HTML mandiri yang berjalan offline di browser mana saja.
              </p>

              <div className="mt-4 flex gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setBloggerSubTab('blogger')}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold ${
                    bloggerSubTab === 'blogger'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Widget Postingan Blogger
                </button>
                <button
                  type="button"
                  onClick={() => setBloggerSubTab('standalone')}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold ${
                    bloggerSubTab === 'standalone'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Aplikasi HTML Standalone
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={handleCopyBloggerCode}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0F294A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4" />
                      Tersalin ke Clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {bloggerSubTab === 'blogger'
                        ? 'Salin Kode HTML Blogger'
                        : 'Salin Kode HTML Standalone'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadStandaloneHtml}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <Download className="h-4 w-4" />
                  Download Lembar Soal Standalone (.html)
                </button>

                <a
                  href="/api/standalone-html"
                  download="index.html"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  <Download className="h-4 w-4" />
                  Download Aplikasi Generator Standalone (index.html)
                </a>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <Code2 className="h-3.5 w-3.5" />
                  Cara Pasang di Blogger:
                </p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-400">
                  <li>Buka Postingan Baru atau Halaman di Dashboard Blogger.</li>
                  <li>Ubah mode editor dari &ldquo;Tampilan Menulis&rdquo; menjadi &ldquo;Tampilan HTML&rdquo;.</li>
                  <li>Tempel (Paste) kode HTML Blogger di atas, lalu Publikasikan.</li>
                </ol>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pratinjau Kode Sumber
              </p>
              <textarea
                readOnly
                rows={10}
                value={bloggerSubTab === 'blogger' ? bloggerCode : standaloneCode}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              />
            </div>
          </div>

          <div className="xl:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
                Pratinjau Langsung {bloggerSubTab === 'blogger' ? 'Widget Blogger' : 'Halaman Standalone'} (Interaktif)
              </div>
              <iframe
                title="Pratinjau Blogger dan Standalone"
                srcDoc={standaloneCode}
                className="h-[720px] w-full bg-slate-100"
                sandbox="allow-scripts allow-modals"
              />
            </div>
          </div>
        </div>
      ) : (
        /* DOCUMENT PRINT / PDF / DOCX STUDIO */
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left Controls (Hidden when printing) */}
          <div className="no-print space-y-5 xl:col-span-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Pilih Paket Ekspor
              </h2>

              <div className="space-y-2">
                {(
                  [
                    {
                      id: 'questions_only',
                      title: 'Soal Saja (Lembar Siswa)',
                      desc: 'Tanpa kunci jawaban & pembahasan',
                    },
                    {
                      id: 'answers_only',
                      title: 'Kunci & Pembahasan Terpisah',
                      desc: 'Khusus pegangan guru & rubrik skor',
                    },
                    {
                      id: 'kisi_kisi_only',
                      title: 'Kisi-Kisi Kurikulum Merdeka',
                      desc: 'Tabel CP, TP, Indikator Soal, Level Kognitif & Bobot',
                    },
                    {
                      id: 'complete',
                      title: 'Paket Lengkap (Soal + Kunci + Kisi-Kisi)',
                      desc: 'Naskah soal, kunci pembahasan & kisi-kisi terpisah',
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      exportMode === opt.id
                        ? 'border-[#0F294A] bg-slate-50 dark:border-blue-500 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="export_mode"
                      checked={exportMode === opt.id}
                      onChange={() => setExportMode(opt.id)}
                      className="mt-0.5 accent-[#0F294A]"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {opt.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>Mode Cetak Padat (Hemat Kertas)</span>
                  <input
                    type="checkbox"
                    checked={compactPrint}
                    onChange={(e) => setCompactPrint(e.target.checked)}
                    className="h-4 w-4 accent-[#0F294A]"
                  />
                </label>
                {exportMode === 'complete' && (
                  <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Sertakan Kisi-Kisi Kurikulum Merdeka</span>
                    <input
                      type="checkbox"
                      checked={includeKisiKisi}
                      onChange={(e) => setIncludeKisiKisi(e.target.checked)}
                      className="h-4 w-4 accent-[#0F294A]"
                    />
                  </label>
                )}
              </div>

              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0F294A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
                >
                  <Printer className="h-4 w-4" />
                  Print Langsung / Simpan PDF
                </button>

                <button
                  type="button"
                  disabled={isExportingDocx}
                  onClick={handleDownloadDocx}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {isExportingDocx ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isExportingDocx ? 'Menyusun DOCX...' : 'Download Word (.docx)'}
                </button>
              </div>
            </section>

            {/* Kop Sekolah & Exam Identity Form */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Identitas Naskah Ujian &amp; Kop Lembaga
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Nama Sekolah / Madrasah / Kampus
                  </label>
                  <input
                    type="text"
                    value={header.institutionName}
                    onChange={(e) => updateHeaderField('institutionName', e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Alamat Lembaga
                  </label>
                  <input
                    type="text"
                    value={header.institutionAddress}
                    onChange={(e) => updateHeaderField('institutionAddress', e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Judul Evaluasi / Ujian
                  </label>
                  <input
                    type="text"
                    value={header.examTitle}
                    onChange={(e) => updateHeaderField('examTitle', e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Mata Pelajaran
                    </label>
                    <input
                      type="text"
                      value={header.subject}
                      onChange={(e) => updateHeaderField('subject', e.target.value)}
                      className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Kelas / Program
                    </label>
                    <input
                      type="text"
                      value={header.gradeClass}
                      onChange={(e) => updateHeaderField('gradeClass', e.target.value)}
                      className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Semester
                    </label>
                    <input
                      type="text"
                      value={header.semester}
                      onChange={(e) => updateHeaderField('semester', e.target.value)}
                      className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Tahun Pelajaran
                    </label>
                    <input
                      type="text"
                      value={header.academicYear}
                      onChange={(e) => updateHeaderField('academicYear', e.target.value)}
                      className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Nama Guru / Dosen
                    </label>
                    <input
                      type="text"
                      value={header.teacherName}
                      onChange={(e) => updateHeaderField('teacherName', e.target.value)}
                      className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Alokasi Waktu
                    </label>
                    <input
                      type="text"
                      value={header.timeAllocation}
                      onChange={(e) => updateHeaderField('timeAllocation', e.target.value)}
                      className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Petunjuk Pengerjaan
                  </label>
                  <textarea
                    rows={2}
                    value={header.instructions}
                    onChange={(e) => updateHeaderField('instructions', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <label className="flex cursor-pointer items-center justify-between pt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>Tampilkan Kolom Identitas Siswa</span>
                  <input
                    type="checkbox"
                    checked={header.includeStudentIdentityBox}
                    onChange={(e) =>
                      updateHeaderField('includeStudentIdentityBox', e.target.checked)
                    }
                    className="h-4 w-4 accent-[#0F294A]"
                  />
                </label>
              </div>
            </section>
          </div>

          {/* Right Live Official A4 Exam Sheet (Exact Print Target) */}
          <div className="xl:col-span-8">
            <div
              className={`print-sheet mx-auto max-w-[840px] rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm ${
                compactPrint ? 'p-4 md:p-6' : 'p-6 md:p-10'
              }`}
            >
              {(exportMode === 'questions_only' || exportMode === 'complete') && (
                <div>
                  {/* Kop Sekolah */}
                  <div className={compactPrint ? 'border-b-2 border-slate-900 pb-1.5 text-center' : 'border-b-4 border-double border-slate-900 pb-3 text-center'}>
                    <h2 className={compactPrint ? 'text-base font-extrabold uppercase tracking-wide text-slate-900' : 'text-lg font-extrabold uppercase tracking-wide text-slate-900'}>
                      {header.institutionName}
                    </h2>
                    {header.institutionAddress && (
                      <p className="text-[11px] text-slate-600">{header.institutionAddress}</p>
                    )}
                  </div>

                  {/* Judul Ujian */}
                  <div className={compactPrint ? 'mt-2 text-center' : 'mt-4 text-center'}>
                    <h3 className={compactPrint ? 'text-sm font-bold uppercase text-slate-900' : 'text-base font-bold uppercase text-slate-900'}>
                      {header.examTitle} · {header.subject} ({project.title})
                    </h3>
                  </div>

                  {/* Metadata Table */}
                  <table className={`${compactPrint ? 'mt-2 text-[11px]' : 'mt-4 text-xs'} w-full border-collapse border border-slate-300`}>
                    <tbody>
                      <tr>
                        <td className="w-1/2 border border-slate-300 px-2.5 py-1">
                          <strong>Jenjang / Kelas / Fase:</strong> {header.level} · {header.gradeClass || '-'} ({getFaseKurikulumMerdeka(header.level, header.gradeClass)})
                        </td>
                        <td className="w-1/2 border border-slate-300 px-2.5 py-1">
                          <strong>Pengampu:</strong> {header.teacherName} · <strong>Waktu:</strong> {header.timeAllocation}
                        </td>
                      </tr>
                      {header.includeStudentIdentityBox && (
                        <tr>
                          <td className="border border-slate-300 px-2.5 py-1">
                            <strong>Nama Siswa:</strong> ..........................................
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1">
                            <strong>Kelas / No:</strong> .................... / ....................
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {header.instructions && (
                    <p className={compactPrint ? 'mt-1.5 text-[10.5px] italic text-slate-600' : 'mt-3 text-xs italic text-slate-600'}>
                      <strong>Petunjuk:</strong> {header.instructions}
                    </p>
                  )}

                  {/* Questions List */}
                  <div className={compactPrint ? 'mt-3 space-y-2.5' : 'mt-6 space-y-5'}>
                    {(() => {
                      let bigArabicIdx = 0;
                      return project.questions.map((q, qIdx) => {
                        const isBigArabic = q.type === 'menebalkan_mewarnai_arab';
                        const prevIsBig =
                          qIdx > 0 && project.questions[qIdx - 1].type === 'menebalkan_mewarnai_arab';
                        let pageBreakCls = '';
                        if (isBigArabic) {
                          if (bigArabicIdx === 0 && qIdx > 0) {
                            pageBreakCls = 'print-page-break';
                          } else if (bigArabicIdx % 2 === 1 && qIdx < project.questions.length - 1) {
                            pageBreakCls = 'print-page-after';
                          }
                          bigArabicIdx++;
                        } else if (prevIsBig && bigArabicIdx % 2 === 1) {
                          pageBreakCls = 'print-page-break';
                        }

                        const cleanPrompt = cleanAsterisks(q.prompt);
                        const cleanPassage = cleanAsterisks(q.readingPassage);
                        const cleanArPrompt = cleanAsterisks(q.arabicPrompt);
                        const promptDir = getTextDirection(cleanPrompt);
                        const passageDir = getTextDirection(cleanPassage);
                        const arPromptDir = getTextDirection(cleanArPrompt);
                        const isArPrompt = q.isArabic || hasArabicText(cleanPrompt);
                        const useTwoColOpts =
                          compactPrint &&
                          q.options &&
                          q.options.length >= 2 &&
                          q.options.every((o) => (o.text || '').length <= 36);
                        const bigArabicWord = cleanAsterisks(
                          q.arabicPrompt || q.readingPassage || q.correctAnswer
                        );

                        if (isBigArabic) {
                          return (
                            <div
                              key={q.id}
                              dir="ltr"
                              className={`arabic-a4-big-card print-avoid-break text-left ${pageBreakCls}`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex gap-1.5 text-left text-[12.5px] font-semibold text-slate-900">
                                  <span className="shrink-0 font-bold tabular-nums">{q.number}.</span>
                                  <span>{cleanPrompt}</span>
                                </div>
                                {q.readingTranslation && (
                                  <span className="shrink-0 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700">
                                    Arti: {cleanAsterisks(q.readingTranslation)}
                                  </span>
                                )}
                              </div>

                              <div className="mt-1.5 rounded-lg border border-dashed border-slate-400 bg-slate-50/40 px-3 py-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                  A. Tebalkan Garis Kata / Kalimat (التَّتَبُّعُ):
                                </div>
                                <div className="arabic-khat-guides mt-1 flex min-h-[34mm] items-center justify-center rounded bg-white px-3 text-center">
                                  <span dir="rtl" className="arabic-trace-text">
                                    {bigArabicWord}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-1.5 rounded-lg border-2 border-slate-400 bg-white px-3 py-1.5">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-700">
                                  <span>B. Warnailah Kata / Kalimat Arab Berikut (التَّلْوِينُ):</span>
                                  <span className="text-[9.5px] font-normal text-slate-500">
                                    Nilai Kerapian: [ ..... ]
                                  </span>
                                </div>
                                <div className="mt-1 flex min-h-[42mm] items-center justify-center rounded border border-dashed border-slate-200 bg-white px-3 text-center">
                                  <span dir="rtl" className="arabic-color-text">
                                    {bigArabicWord}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={q.id} className={`print-avoid-break ${pageBreakCls}`}>
                            {cleanPassage && (
                              <div
                                dir={passageDir}
                                className={`mb-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 ${
                                  passageDir === 'rtl' ? 'text-right' : 'text-left'
                                } ${
                                  hasArabicText(cleanPassage)
                                    ? 'font-arabic text-sm leading-relaxed'
                                    : 'text-[11px] leading-snug'
                                }`}
                              >
                                {cleanPassage}
                              </div>
                            )}

                            <div
                              dir={promptDir}
                              className={`flex gap-1.5 font-medium text-slate-900 ${
                                promptDir === 'rtl' ? 'text-right' : 'text-left'
                              } ${
                                isArPrompt
                                  ? 'font-arabic text-base leading-relaxed'
                                  : compactPrint
                                  ? 'text-[12.5px] leading-snug'
                                  : 'text-sm leading-relaxed'
                              }`}
                            >
                              <span className="shrink-0 font-bold tabular-nums">
                                {q.number}.
                              </span>
                              <div className={`flex-1 ${promptDir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                <span>{cleanPrompt}</span>
                                {cleanArPrompt && (
                                  <p
                                    dir={arPromptDir}
                                    className={`font-arabic mt-0.5 text-base leading-relaxed ${
                                      arPromptDir === 'rtl' ? 'text-right' : 'text-left'
                                    }`}
                                  >
                                    {cleanArPrompt}
                                  </p>
                                )}
                              </div>
                            </div>

                            {q.visual && (q.visual.svgMarkup || q.visual.imageUrl) && (
                              <div className="my-1.5 flex flex-col items-center">
                                {q.visual.svgMarkup ? (
                                  <div
                                    className="max-w-xs overflow-hidden rounded border border-slate-200"
                                    dangerouslySetInnerHTML={{ __html: q.visual.svgMarkup }}
                                  />
                                ) : q.visual.imageUrl ? (
                                  <img
                                    src={q.visual.imageUrl}
                                    alt={q.visual.caption}
                                    referrerPolicy="no-referrer"
                                    className="max-h-44 object-contain"
                                  />
                                ) : null}
                                {q.visual.caption && (
                                  <span className="mt-0.5 text-[10px] italic text-slate-500">
                                    {cleanAsterisks(q.visual.caption)}
                                  </span>
                                )}
                              </div>
                            )}

                            {q.options && q.options.length > 0 && (
                              <div
                                dir={promptDir}
                                className={`mt-1 ${promptDir === 'rtl' ? 'pr-4 text-right' : 'pl-4 text-left'} ${
                                  useTwoColOpts
                                    ? 'grid grid-cols-2 gap-x-4 gap-y-0.5'
                                    : 'space-y-0.5'
                                }`}
                              >
                                {q.options.map((opt, idx) => {
                                  const optClean = cleanAsterisks(opt.text);
                                  const optPureAr = isPureArabicBlock(optClean);
                                  const rowRtl =
                                    isPureArabicBlock(`${opt.label} ${optClean}`) ||
                                    (promptDir === 'rtl' && optPureAr);
                                  return (
                                    <div
                                      key={idx}
                                      dir={rowRtl ? 'rtl' : 'ltr'}
                                      className={`flex gap-1.5 ${rowRtl ? 'text-right' : 'text-left'} ${
                                        hasArabicText(optClean)
                                          ? 'font-arabic text-sm leading-relaxed'
                                          : compactPrint
                                          ? 'text-[12px] leading-snug'
                                          : 'text-sm'
                                      }`}
                                    >
                                      <span className="shrink-0 font-semibold">{cleanAsterisks(opt.label)}.</span>
                                      <span
                                        dir={optPureAr ? 'rtl' : 'ltr'}
                                        style={optPureAr && !rowRtl ? { unicodeBidi: 'isolate' } : undefined}
                                      >
                                        {optClean}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {q.type === 'menjodohkan' &&
                              q.matchingPairs &&
                              q.matchingPairs.length > 0 &&
                              (() => {
                                const sync = getSynchronizedMatching(q.matchingPairs);
                                const lastLetter =
                                  sync.rightOptions[sync.rightOptions.length - 1]?.letter || 'D';
                                return (
                                  <div dir="ltr" className="mt-2.5 space-y-2.5 pl-5 text-left text-xs">
                                    <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700">
                                      Pasangkan <strong>Kolom Kiri (1–{sync.rows.length})</strong> dengan{' '}
                                      <strong>Pilihan Kanan (A–{lastLetter})</strong>, lalu tuliskan jawaban pada kotak isian yang tersedia:
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="rounded border border-slate-200 p-2">
                                        <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">
                                          Kolom Kiri
                                        </div>
                                        {sync.rows.map((row) => (
                                          <div
                                            key={row.number}
                                            className={`border-b border-dotted border-slate-200 py-1 last:border-none ${
                                              hasArabicText(row.left) ? 'font-arabic text-base' : ''
                                            }`}
                                          >
                                            <strong>{row.number}.</strong> {row.left}
                                          </div>
                                        ))}
                                      </div>
                                      <div className="rounded border border-slate-200 p-2">
                                        <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">
                                          Pilihan Kanan
                                        </div>
                                        {sync.rightOptions.map((opt) => (
                                          <div
                                            key={opt.letter}
                                            className={`border-b border-dotted border-slate-200 py-1 last:border-none ${
                                              hasArabicText(opt.text) ? 'font-arabic text-base' : ''
                                            }`}
                                          >
                                            <strong>{opt.letter}.</strong> {opt.text}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                                      {sync.rows.map((row) => (
                                        <div key={row.number} className="rounded border border-slate-400 p-2">
                                          <div className="mb-1 text-[10px] font-semibold text-slate-600">
                                            Jawaban No. {row.number}:
                                          </div>
                                          <div className="min-h-[42px] w-full rounded border border-dashed border-slate-300 bg-white" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                            {q.type === 'mengurutkan' && q.sequenceItems && (
                              <div className="mt-2 space-y-1 pl-5 text-xs">
                                {[...q.sequenceItems]
                                  .sort((a, b) => a.localeCompare(b))
                                  .map((s, sIdx) => (
                                    <div key={sIdx}>[ ..... ] {s}</div>
                                  ))}
                              </div>
                            )}

                            {['esai', 'studi_kasus', 'analisis_teks'].includes(q.type) && (
                              <div className="mt-3 space-y-3 pl-5">
                                <div className="border-b border-dotted border-slate-300 pt-4" />
                                <div className="border-b border-dotted border-slate-300 pt-4" />
                              </div>
                            )}

                            {q.type === 'memisah_hijaiyah' && (
                              <div dir="ltr" className="mt-3 flex flex-wrap items-center gap-2 pl-5">
                                {[1, 2, 3, 4, 5, 6].map((b) => (
                                  <span
                                    key={b}
                                    className="inline-block h-8 w-10 rounded border border-slate-300"
                                  />
                                ))}
                              </div>
                            )}

                            {q.type === 'menyambung_hijaiyah' && (
                              <div dir="ltr" className="mt-3 pl-5">
                                <div className="h-9 max-w-xs rounded border border-slate-300" />
                              </div>
                            )}

                            {q.type === 'menulis_ulang_kalimat' && (
                              <div className="mt-3 space-y-3 pl-5">
                                <div className="border-b border-dotted border-slate-400 pt-5" />
                                <div className="border-b border-dotted border-slate-400 pt-5" />
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Separate Answer Key & Discussion Section */}
              {(exportMode === 'answers_only' || exportMode === 'complete') && (
                <div className={exportMode === 'complete' ? 'print-page-break mt-6 border-t-2 border-slate-300 pt-4' : ''}>
                  <div className="mb-2.5 border-b border-slate-300 pb-1.5">
                    <h3 className="text-sm font-bold uppercase text-slate-900">
                      KUNCI JAWABAN, PEMBAHASAN &amp; RUBRIK PENILAIAN
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      {header.institutionName} · {header.subject} · {project.title}
                    </p>
                  </div>

                  <div className={compactPrint ? 'grid grid-cols-1 gap-2 md:grid-cols-2' : 'space-y-4'}>
                    {project.questions.map((q) => {
                      const rawKeyStr =
                        q.correctAnswers && q.correctAnswers.length > 0
                          ? q.correctAnswers.join(', ')
                          : q.correctAnswer;
                      const keyStr = cleanAsterisks(rawKeyStr);
                      const keyDir = getTextDirection(keyStr);
                      const expClean = cleanAsterisks(q.explanation);
                      const rubricClean = cleanAsterisks(q.rubric);
                      return (
                        <div
                          key={q.id}
                          className={`print-avoid-break rounded border border-slate-200 ${compactPrint ? 'p-2 text-[11px] leading-snug' : 'p-3 text-xs'}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-slate-900">
                            <span>
                              No. {q.number} ({QUESTION_TYPE_META[q.type]?.shortLabel} · {q.cognitiveLevel})
                            </span>
                            <span className="tabular-nums">{q.weight} pt</span>
                          </div>
                          <p className="mt-0.5 text-left">
                            <strong>Kunci: </strong>
                            <span
                              dir={keyDir}
                              style={keyDir === 'rtl' ? { unicodeBidi: 'isolate' } : undefined}
                              className={`${keyDir === 'rtl' ? 'inline-block text-right' : ''} ${hasArabicText(keyStr) ? 'font-arabic text-sm font-bold' : 'font-semibold'}`}
                            >
                              {keyStr}
                            </span>
                          </p>
                          {expClean && (
                            <p
                              dir={getTextDirection(expClean)}
                              className={`mt-0.5 text-slate-700 ${isPureArabicBlock(expClean) ? 'font-arabic text-right' : ''}`}
                            >
                              <strong>Pembahasan: </strong>
                              {expClean}
                            </p>
                          )}
                          {rubricClean && (
                            <p className="mt-0.5 text-slate-600">
                              <strong>Rubrik: </strong>
                              {rubricClean}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Kisi-Kisi Kurikulum Merdeka Section */}
              {(exportMode === 'kisi_kisi_only' || (exportMode === 'complete' && includeKisiKisi)) && (
                <div className={exportMode === 'complete' ? 'print-page-break mt-6 border-t-2 border-slate-300 pt-4' : ''}>
                  <div className="mb-2.5 text-center">
                    <h3 className="text-sm font-bold uppercase text-slate-900">
                      KISI-KISI PENULISAN SOAL (KURIKULUM MERDEKA)
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      {header.institutionName} · {header.subject} · {header.level} {header.gradeClass ? `(${header.gradeClass})` : ''} · {getFaseKurikulumMerdeka(header.level, header.gradeClass)} · Penyusun: {header.teacherName}
                    </p>
                  </div>

                  <table className="w-full border-collapse border border-slate-300 text-left text-[10.5px] leading-snug">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900">
                        <th className="w-8 border border-slate-300 px-1.5 py-1 text-center">No</th>
                        <th className="w-[26%] border border-slate-300 px-2 py-1">TP &amp; Lingkup Materi</th>
                        <th className="w-[40%] border border-slate-300 px-2 py-1">Indikator Soal</th>
                        <th className="w-[18%] border border-slate-300 px-1.5 py-1">Level &amp; Bentuk</th>
                        <th className="w-12 border border-slate-300 px-1.5 py-1 text-center">Bobot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.questions.map((q) => {
                        const row = buildKisiKisiRow(q, {
                          subject: header.subject,
                          level: header.level,
                          gradeClass: header.gradeClass,
                          title: project.title,
                        });
                        return (
                          <tr key={q.id} className="odd:bg-white even:bg-slate-50/70">
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-bold">{row.number}</td>
                            <td className="border border-slate-300 px-2 py-1">
                              <div>{row.tujuanPembelajaran}</div>
                              <div className="mt-0.5 text-[9.5px] italic text-slate-500">Materi: {row.materi}</div>
                            </td>
                            <td className="border border-slate-300 px-2 py-1">{row.indikatorSoal}</td>
                            <td className="border border-slate-300 px-1.5 py-1">
                              <strong>{row.cognitiveLevel}</strong> ({row.thinkingTier})
                              <div className="text-[9.5px] text-slate-600">{row.bentukSoal}</div>
                            </td>
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-mono">{row.weight}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
