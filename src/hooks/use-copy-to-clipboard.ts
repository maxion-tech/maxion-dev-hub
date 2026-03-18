"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

export function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string, label?: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(label ? `${label} copied` : "Copied to clipboard");
        setTimeout(() => setCopied(false), timeout);
      } catch {
        toast.error("Failed to copy — try selecting and copying manually");
      }
    },
    [timeout]
  );

  return { copied, copy } as const;
}
