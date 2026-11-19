import { useState } from 'react';
import {
  Bookmark,
  Copy,
  FileDown,
  FolderOpen,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { EDUCATION_LEVELS, QUESTION_TYPE_META } from '../constants.ts';
import { BankQuestion, ExamProject } from '../types.ts';
import { hasArabicText } from '../utils/arabic.ts';

interface ProjectsViewProps {
  projects: ExamProject[];
  onOpenProject: (project: ExamProject) => void;
  onToggleFavorite: (project: ExamProject) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onExportProject: (project: ExamProject) => void;
  onStartNew: () => void;
}

export function ProjectsView({
  projects,
  onOpenProject,
  onToggleFavorite,
  onDuplicateProject,
  onDeleteProject,
  onExportProject,
  onStartNew,
}: ProjectsViewProps) {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const filtered = projects.filter((p) => {
    const matchText =
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.subject.toLowerCase().includes(search.toLowerCase());
    const matchLevel = levelFilter === 'all' || p.level === levelFilter;
    const matchFav = !onlyFavorites || p.isFavorite;
    return matchText && matchLevel && matchFav;
  });

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Arsip &amp; Riwayat Pembuatan Soal
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Proyek Paket Soal
          </h1>
        </div>
        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#0F294A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Buat Paket Baru
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul materi atau mata pelajaran..."
            className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="min-h-[40px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">Semua Jenjang</option>
          {EDUCATION_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyFavorites((v) => !v)}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
            onlyFavorites
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
              : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${onlyFavorites ? 'fill-amber-400 text-amber-500' : ''}`} />
          Favorit
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <FolderOpen className="mx-auto h-9 w-9 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
            Tidak ada proyek yang sesuai filter
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((proj) => (
            <article
              key={proj.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span>{proj.level}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{proj.subject}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{proj.language}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">{proj.questions.length} soal</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(proj)}
                    aria-label="Tandai favorit"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        proj.isFavorite ? 'fill-amber-400 text-amber-500' : ''
                      }`}
                    />
                  </button>
                </div>

                <h3
                  dir="ltr"
                  className={`mt-2 text-left text-base font-bold text-slate-900 dark:text-white ${
                    hasArabicText(proj.title) ? 'font-arabic text-lg' : ''
                  }`}
                >
                  {proj.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                  {proj.subtitles.join(' · ')}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 tabular-nums">
                  Diperbarui {new Date(proj.updatedAt).toLocaleDateString('id-ID')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenProject(proj)}
                    className="min-h-[36px] rounded-lg bg-[#0F294A] px-3 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
                  >
                    Buka Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => onExportProject(proj)}
                    title="Ekspor & Cetak"
                    className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <FileDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateProject(proj.id)}
                    title="Duplikasi"
                    className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProject(proj.id)}
                    title="Hapus proyek"
                    className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-slate-400 hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

interface BankViewProps {
  bank: BankQuestion[];
  hasActiveProject: boolean;
  onToggleFavorite: (id: string) => void;
  onDeleteBankItem: (id: string) => void;
  onInsertIntoActive: (item: BankQuestion) => void;
}

export function BankView({
  bank,
  hasActiveProject,
  onToggleFavorite,
  onDeleteBankItem,
  onInsertIntoActive,
}: BankViewProps) {
  const [search, setSearch] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);

  const filtered = bank.filter((item) => {
    const matchText =
      !search.trim() ||
      item.question.prompt.toLowerCase().includes(search.toLowerCase()) ||
      item.subject.toLowerCase().includes(search.toLowerCase());
    const matchFav = !onlyFav || item.isFavorite;
    return matchText && matchFav;
  });

  return (
    <div className="space-y-6 pb-8">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Koleksi Butir Soal Terkurasi
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Bank Soal Pribadi
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Simpan butir soal terbaik dari berbagai proyek untuk disisipkan ulang kapan saja ke paket ujian baru.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari isi soal atau mata pelajaran..."
            className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyFav((v) => !v)}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap ${
            onlyFav
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
              : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${onlyFav ? 'fill-amber-400 text-amber-500' : ''}`} />
          Soal Favorit
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Bookmark className="mx-auto h-9 w-9 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
            Bank soal masih kosong atau tidak ditemukan
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isAr = item.question.isArabic || hasArabicText(item.question.prompt);
            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div>
                    <span>{item.subject}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{item.level}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{QUESTION_TYPE_META[item.question.type]?.shortLabel}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{item.question.cognitiveLevel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(item.id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          item.isFavorite ? 'fill-amber-400 text-amber-500' : ''
                        }`}
                      />
                    </button>
                    {hasActiveProject && (
                      <button
                        type="button"
                        onClick={() => onInsertIntoActive(item)}
                        className="rounded-lg bg-[#0F294A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
                      >
                        Sisipkan ke Proyek Aktif
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteBankItem(item.id)}
                      className="rounded p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p
                  dir="ltr"
                  className={`mt-3 text-left text-slate-900 dark:text-white ${
                    isAr ? 'font-arabic text-lg' : 'text-sm font-medium'
                  }`}
                >
                  {item.question.prompt}
                </p>

                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <strong>Kunci:</strong> {item.question.correctAnswer}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
