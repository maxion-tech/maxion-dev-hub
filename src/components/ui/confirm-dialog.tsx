"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ConfirmTone = "primary" | "destructive" | "warning";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: ReactNode;
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneIconClass: Record<ConfirmTone, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-warning/10 text-warning border-warning/20",
};

/** Small confirmation modal that follows the dev-hub modal pattern (backdrop blur, Escape, scroll lock). */
export function ConfirmDialog({
  open,
  busy = false,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => confirmRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="p-6 flex gap-4">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", toneIconClass[tone])}>
            {icon ?? <AlertTriangle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 space-y-1.5 pr-4">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant={tone === "destructive" ? "destructive" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
