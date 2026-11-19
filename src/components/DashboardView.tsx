import {
  ArrowRight,
  BookOpen,
  Copy,
  FileText,
  FolderOpen,
  Languages,
  Plus,
  Printer,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { EXAM_TEMPLATES } from '../constants.ts';
import { BankQuestion, ExamProject, ExamTemplate, UserProfile } from '../types.ts';

interface DashboardViewProps {
  profile: UserProfile;
  projects: ExamProject[];
  bank: BankQuestion[];
  onStartNew: () => void;
  onApplyTemplate: (template: ExamTemplate) => void;
  onOpenProject: (project: ExamProject) => void;
  onDuplicateProject: (id: string) => void;
  onExportProject: (project: ExamProject) => void;
  onNavigateProjects: () => void;
}

export function DashboardView({
  profile,
  projects,
  bank,
  onStartNew,
  onApplyTemplate,
  onOpenProject,
  onDuplicateProject,
  onExportProject,
  onNavigateProjects,
}: DashboardViewProps) {
  const totalQuestions = projects.reduce((sum, p) => sum + p.questions.length, 0);
  const arabicProjectsCount = projects.filter(
    (p) => p.language.includes('Arab') || p.questions.some((q) => q.isArabic)
  ).length;
  const verifiedQuestionsCount = projects.reduce(
    (sum, p) => sum + p.questions.filter((q) => q.verifiedByAI).length,
    0
  );

  const recentProjects = projects.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Executive Welcome Header */}
      <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {profile.institutionName} · {profile.defaultAcademicYear}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Selamat datang, {profile.fullName}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Susun naskah ujian, latihan soal HOTS, materi Bahasa Arab berharakat, dan paket evaluasi siap cetak dalam hitungan menit.
          </p>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={onStartNew}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0F294A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#163B69] dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Buat Paket Soal Baru
          </button>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Paket Ujian</span>
            <FolderOpen className="h-4 w-4 text-[#0F294A] dark:text-blue-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {projects.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Proyek tersimpan persisten
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Butir Soal</span>
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {totalQuestions}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {bank.length} soal di Bank Pribadi
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Paket Bahasa Arab RTL</span>
            <Languages className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {arabicProjectsCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Dukungan harakat &amp; i’rab
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Lolos Audit Kualitas</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {verifiedQuestionsCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Kunci &amp; materi terverifikasi
          </p>
        </div>
      </section>

      {/* Quick Start Curriculum Templates */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Template Siap Pakai Berdasarkan Kurikulum
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pilih skema di bawah untuk langsung mengisi konfigurasi materi, subjudul, dan komposisi soal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {EXAM_TEMPLATES.slice(0, 6).map((tpl) => {
            const totalTpl = Object.values(tpl.questionCounts).reduce((a, b) => a + (b || 0), 0);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onApplyTemplate(tpl)}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#0F294A] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{tpl.level}</span>
                    <span aria-hidden="true">·</span>
                    <span>{tpl.subject}</span>
                    <span aria-hidden="true">·</span>
                    <span>{tpl.language}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900 group-hover:text-[#0F294A] dark:text-white dark:group-hover:text-blue-400">
                    {tpl.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                    {tpl.subtitles.join(' · ')}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-medium text-[#0F294A] dark:border-slate-800 dark:text-blue-400">
                  <span className="tabular-nums">{totalTpl} soal terkonfigurasi</span>
                  <span className="inline-flex items-center gap-1">
                    Gunakan Template
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent Projects List (Desktop Table + Mobile Cards) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Paket Soal Terbaru
          </h2>
          <button
            type="button"
            onClick={onNavigateProjects}
            className="text-xs font-semibold text-[#0F294A] hover:underline dark:text-blue-400 whitespace-nowrap"
          >
            Lihat Semua Proyek
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              Belum ada paket soal tersimpan
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Mulai dengan membuat paket soal otomatis menggunakan AI atau pilih template kurikulum di atas.
            </p>
            <button
              type="button"
              onClick={onStartNew}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0F294A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
            >
              <Plus className="h-4 w-4" />
              Buat Soal Pertama
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Judul Materi &amp; Mapel</th>
                    <th className="px-4 py-3">Jenjang</th>
                    <th className="px-4 py-3">Bahasa</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentProjects.map((proj) => (
                    <tr
                      key={proj.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {proj.isFavorite && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenProject(proj)}
                            className="text-left font-semibold text-slate-900 hover:text-[#0F294A] dark:text-white dark:hover:text-blue-400"
                          >
                            {proj.title}
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {proj.subject} · {proj.subtitles.length} subjudul
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                        {proj.level}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                        {proj.language}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {proj.questions.length} soal
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenProject(proj)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0F294A] hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-800 whitespace-nowrap"
                          >
                            Buka Editor
                          </button>
                          <button
                            type="button"
                            onClick={() => onExportProject(proj)}
                            title="Ekspor PDF / DOCX / Blogger"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateProject(proj.id)}
                            title="Duplikasi paket soal"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {recentProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {proj.level} · {proj.subject} · {proj.questions.length} soal
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {proj.title}
                      </h3>
                    </div>
                    {proj.isFavorite && (
                      <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj)}
                      className="min-h-[40px] flex-1 rounded-lg bg-[#0F294A] px-3 py-2 text-xs font-semibold text-white dark:bg-blue-600"
                    >
                      Buka Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportProject(proj)}
                      className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Ekspor
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj.id)}
                      aria-label="Duplikasi"
                      className="min-h-[40px] rounded-lg border border-slate-200 px-2.5 py-2 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
