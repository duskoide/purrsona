"use client";

import { type ReactNode, useEffect, useRef, useCallback } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  destructive?: boolean;
}

export function Modal({ open, onClose, title, children, destructive = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('[autofocus], button, input')?.focus(), 50);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      triggerRef.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-neutral-900/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-white border-2 border-neutral-900 max-w-md w-full mx-4 p-6
          ${destructive
            ? "shadow-[4px_4px_0_#DC2626,8px_8px_0_#111827]"
            : "shadow-[4px_4px_0_#4502FF,8px_8px_0_#FFDA14,12px_12px_0_#111827]"
          }`}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="modal-title" className="text-xl font-bold">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 font-bold text-lg
              focus-visible:outline-3 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
            aria-label="Close"
          >
            X
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
