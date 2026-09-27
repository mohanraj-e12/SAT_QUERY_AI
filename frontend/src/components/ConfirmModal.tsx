import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl p-2.5 border ${
                isDestructive
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}
            >
              {isDestructive ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 font-mono">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Confirmation Required</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-[#FD1843]/10 hover:text-[#FD1843] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 font-sans leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#eeddd3]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#eeddd3] bg-white px-4 py-2 text-xs font-mono font-medium text-slate-700 hover:bg-[#FFF9F4] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-mono font-semibold transition-colors shadow-lg ${
              isDestructive
                ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/20'
                : 'bg-[#FD1843] text-white hover:bg-[#e01239] shadow-[#FD1843]/20'
            }`}
          >
            {isDestructive && <Trash2 className="w-3.5 h-3.5" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
