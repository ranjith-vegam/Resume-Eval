import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { useToastStore } from "../../store/useToastStore";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-fade-in pointer-events-auto ${
            t.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : t.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          {t.type === "success" ? (
            <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
          ) : t.type === "error" ? (
            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          ) : (
            <Info size={16} className="text-brand-600 mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
