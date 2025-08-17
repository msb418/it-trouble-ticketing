// components/ConfirmDialog.tsx
"use client";
import { ReactNode } from "react";

export default function ConfirmDialog({
  open, onClose, onConfirm, title, children,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; children?: ReactNode; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-5">
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <div className="mb-4 text-sm opacity-90">{children}</div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded bg-slate-700 px-3 py-1.5">Cancel</button>
          <button onClick={onConfirm} className="rounded bg-rose-600 px-3 py-1.5">Confirm</button>
        </div>
      </div>
    </div>
  );
}