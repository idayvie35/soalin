import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed bottom-20 right-4 z-50 flex w-full max-w-sm flex-col gap-2 md:bottom-6 md:right-6"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : t.type === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          ) : (
            <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          );

        return (
          <div
            key={t.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {icon}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
              {t.message && (
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{t.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Tutup notifikasi"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
