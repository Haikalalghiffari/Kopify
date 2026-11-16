"use client";

import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const buttonVariantStyles = {
    danger: "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500",
    warning: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500",
    primary: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex items-start space-x-3 mb-6">
        <div className="p-2 rounded-full bg-rose-50 text-rose-600 flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
          }}
          disabled={isLoading}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${buttonVariantStyles[variant]}`}
        >
          {isLoading ? "Memproses..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
