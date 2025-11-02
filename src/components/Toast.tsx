"use client";

import { useEffect } from "react";
import type { Toast as ToastType } from "./ToastProvider";

interface ToastProps {
  toast: ToastType;
  onClose: (id: string) => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast.autoClose !== false) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration ?? 5000);

      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  const variantStyles = {
    success: {
      container: "bg-green-500/20 border-green-400/30 text-green-300",
      icon: (
        <svg
          className="h-5 w-5 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    error: {
      container: "bg-red-500/20 border-red-400/30 text-red-300",
      icon: (
        <svg
          className="h-5 w-5 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    info: {
      container: "bg-blue-500/20 border-blue-400/30 text-blue-300",
      icon: (
        <svg
          className="h-5 w-5 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  };

  const styles = variantStyles[toast.variant ?? "info"];

  return (
    <div
      className={`flex items-start gap-3 rounded-xl backdrop-blur-sm p-4 border shadow-lg min-w-[300px] max-w-md animate-slide-in-right ${styles.container}`}
      role="alert"
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
    >
      <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1">
        {toast.title && (
          <p className="font-semibold text-sm mb-1">{toast.title}</p>
        )}
        <p className="text-sm">{toast.message}</p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-white/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded transition-colors"
        aria-label="Close notification"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

