"use client";

export function KbdShortcut({ shortcut }: { shortcut: string }) {
  const isMac =
    typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
  const display = shortcut.replace("Mod", isMac ? "⌘" : "Ctrl");

  return (
    <kbd className="hidden sm:inline-block px-1.5 py-0.5 font-mono text-xs text-muted-foreground/50 bg-secondary border border-border rounded">
      {display}
    </kbd>
  );
}
