import { useEffect, useState } from 'react';
import { Check, Code2, Copy, Download, FileCode, Loader2 } from 'lucide-react';

interface BundleFile {
  name: string;
  content: string;
  lines: number;
}

interface GasBundleViewProps {
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export function GasBundleView({ onNotify }: GasBundleViewProps) {
  const [files, setFiles] = useState<BundleFile[]>([]);
  const [selectedName, setSelectedName] = useState<string>('Code.gs');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/gas-bundle')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const list = (data.files || []) as BundleFile[];
        setFiles(list);
        if (list.length > 0 && !list.some((f) => f.name === selectedName)) {
          setSelectedName(list[0].name);
        }
      })
      .catch((err) => {
        onNotify('error', 'Gagal memuat paket GAS & Blogger', err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentFile = files.find((f) => f.name === selectedName) || files[0];

  const handleCopy = async () => {
    if (!currentFile) return;
    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      onNotify('success', `Kode ${currentFile.name} disalin ke clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('error', 'Gagal menyalin otomatis');
    }
  };

  const handleDownloadFile = (file: BundleFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Paket Instalasi Standalone · HTML Standalone + Google Blogger + Google Apps Script + Google Sheets
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Kode Lengkap Standalone index.html, GAS &amp; Blogger
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Mencakup halaman mandiri <code className="font-mono text-xs">standalone-index.html</code> (siap pakai tanpa server) serta seluruh file <code className="font-mono text-xs">.gs</code> dan <code className="font-mono text-xs">blogger-frontend.html</code>.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href="/api/standalone-html"
            download="index.html"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#0F294A] px-4 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh index.html Standalone
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat paket file Google Apps Script &amp; Blogger...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* File Explorer */}
          <div className="lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Daftar File ({files.length} file)
              </p>
              <div className="mt-1 max-h-[560px] space-y-1 overflow-y-auto">
                {files.map((file) => {
                  const active = file.name === selectedName;
                  return (
                    <button
                      key={file.name}
                      type="button"
                      onClick={() => setSelectedName(file.name)}
                      className={`flex min-h-[38px] w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                        active
                          ? 'bg-[#0F294A] font-semibold text-white dark:bg-blue-600'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 truncate font-mono">
                        <FileCode className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </span>
                      <span className={`font-mono text-[11px] tabular-nums ${active ? 'text-slate-200' : 'text-slate-400'}`}>
                        {file.lines}L
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="lg:col-span-8">
            {currentFile && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-[#0F294A] dark:text-blue-400" />
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {currentFile.name}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      · {currentFile.lines} baris
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#0F294A] px-3 text-xs font-semibold text-white hover:bg-[#163B69] dark:bg-blue-600"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Tersalin' : 'Salin Kode'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(currentFile)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh File
                    </button>
                  </div>
                </div>
                <pre className="max-h-[560px] overflow-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
                  <code>{currentFile.content}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
