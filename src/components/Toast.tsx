"use client";

import { useCallback, useState } from "react";
import { PartyPopper, AlertTriangle, X } from "lucide-react";

export type ToastItem = { id: number; message: string; tone: "success" | "warning" };

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastItem["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 7000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return { toasts, push, dismiss };
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2.5 bg-surface border border-border rounded-lg px-4 py-3 shadow-lg max-w-xs text-sm animate-[toast-in_0.3s_ease-out]"
        >
          {t.tone === "success" ? (
            <PartyPopper size={16} className="text-positive mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-negative mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-text-muted hover:text-text shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[toast-in_0\\.3s_ease-out\\] { animation: none; }
        }
      `}</style>
    </div>
  );
}
