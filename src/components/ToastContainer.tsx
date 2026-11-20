import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 border shadow-lg transition-all duration-200 ${
            toast.type === 'error'
              ? 'bg-[#1A1112] border-red-800/70 text-red-50'
              : toast.type === 'info'
              ? 'bg-[#161619] border-[#C5A46D]/40 text-[#F7F5F0]'
              : 'bg-[#0B0B0C] border-[#C5A46D]/50 text-[#F7F5F0]'
          }`}
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-[#C5A46D] shrink-0 mt-0.5" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="w-4 h-4 text-[#C5A46D] shrink-0 mt-0.5" />
          )}
          <p className="text-sm leading-snug flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Fermer la notification"
            className="text-white/50 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
