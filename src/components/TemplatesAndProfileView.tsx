import { useState } from 'react';
import { ArrowRight, Check, Save, UserCheck } from 'lucide-react';
import { EDUCATION_LEVELS, EXAM_TEMPLATES } from '../constants.ts';
import { ExamTemplate, UserProfile } from '../types.ts';

interface TemplatesViewProps {
  onApplyTemplate: (template: ExamTemplate) => void;
}

export function TemplatesView({ onApplyTemplate }: TemplatesViewProps) {
  const [catFilter, setCatFilter] = useState('all');
  const categories = Array.from(new Set(EXAM_TEMPLATES.map((t) => t.category)));

  const visible = EXAM_TEMPLATES.filter(
    (t) => catFilter === 'all' || t.category === catFilter
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Katalog Skema Kurikulum &amp; Dirasah
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Template Paket Soal
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Gunakan template terstruktur untuk sekolah umum, madrasah, pesantren, dan perguruan tinggi.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCatFilter('all')}
          className={`min-h-[38px] rounded-lg px-3.5 text-xs font-semibold ${
            catFilter === 'all'
              ? 'bg-[#0F294A] text-white dark:bg-blue-600'
              : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          Semua Kategori
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCatFilter(cat)}
            className={`min-h-[38px] rounded-lg px-3.5 text-xs font-semibold ${
              catFilter === cat
                ? 'bg-[#0F294A] text-white dark:bg-blue-600'
                : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visible.map((tpl) => {
          const total = Object.values(tpl.questionCounts).reduce((a, b) => a + (b || 0), 0);
          return (
            <article
              key={tpl.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tpl.category} · {tpl.level} · {tpl.language}
                </p>
                <h3 className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
                  {tpl.name}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Materi: {tpl.title}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-400">
                  {tpl.subtitles.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="font-mono text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {total} soal · {tpl.thinkingTier} · {tpl.difficulty}
                </span>
                <button
                  type="button"
                  onClick={() => onApplyTemplate(tpl)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0F294A] px-3.5 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
                >
                  Pakai Template
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

interface ProfileViewProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
}

export function ProfileView({ profile, onSaveProfile }: ProfileViewProps) {
  const [form, setForm] = useState<UserProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedOk(false);
    try {
      await onSaveProfile(form);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Identitas Pengajar &amp; Kop Lembaga Default
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Pengaturan Profil Pengguna
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Data di bawah otomatis mengisi kop sekolah/madrasah dan nama pengampu setiap kali Anda membuat paket soal baru.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F294A] text-white dark:bg-blue-600">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{form.fullName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{form.institutionName}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nama Lengkap &amp; Gelar
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Jabatan / Peran
            </label>
            <input
              type="text"
              value={form.roleTitle}
              onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              NIP / NIY / NIDN
            </label>
            <input
              type="text"
              value={form.nipOrId}
              onChange={(e) => setForm({ ...form, nipOrId: e.target.value })}
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Jenjang Default
            </label>
            <select
              value={form.defaultLevel}
              onChange={(e) =>
                setForm({ ...form, defaultLevel: e.target.value as UserProfile['defaultLevel'] })
              }
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {EDUCATION_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Nama Lembaga / Sekolah / Madrasah / Universitas
          </label>
          <input
            type="text"
            value={form.institutionName}
            onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
            className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Alamat Lembaga (Kop Ujian)
          </label>
          <input
            type="text"
            value={form.institutionAddress}
            onChange={(e) => setForm({ ...form, institutionAddress: e.target.value })}
            className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tahun Pelajaran Default
            </label>
            <input
              type="text"
              value={form.defaultAcademicYear}
              onChange={(e) => setForm({ ...form, defaultAcademicYear: e.target.value })}
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Semester Default
            </label>
            <input
              type="text"
              value={form.defaultSemester}
              onChange={(e) => setForm({ ...form, defaultSemester: e.target.value })}
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0F294A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#163B69] disabled:opacity-50 dark:bg-blue-600"
          >
            {savedOk ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? 'Menyimpan...' : savedOk ? 'Tersimpan' : 'Simpan Profil'}
          </button>
        </div>
      </form>
    </div>
  );
}
