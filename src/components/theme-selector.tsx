"use client";

import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { useTheme, THEMES, type Theme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const THEME_META: Record<Theme, { label: string; bg: string; surface: string; accent: string }> = {
  dark: {
    label: "Dark",
    bg: "#0a0a0c",
    surface: "#13131a",
    accent: "#f5c518",
  },
  light: {
    label: "Light",
    bg: "#faf9f7",
    surface: "#ffffff",
    accent: "#b48208",
  },
  dim: {
    label: "Slate",
    bg: "#1e2433",
    surface: "#252d40",
    accent: "#f5c518",
  },
  dusk: {
    label: "Warm",
    bg: "#231f1b",
    surface: "#2c2722",
    accent: "#f5c518",
  },
};

function ThemePreview({ themeKey, isActive }: { themeKey: Theme; isActive: boolean }) {
  const meta = THEME_META[themeKey];
  return (
    <div
      className={cn(
        "relative w-full aspect-[4/3] rounded-md overflow-hidden border-2 transition-all",
        isActive
          ? "border-primary ring-2 ring-primary/25"
          : "border-border hover:border-muted-foreground"
      )}
      style={{ backgroundColor: meta.bg }}
    >
      {/* Mini card surface */}
      <div
        className="absolute inset-x-1.5 top-1.5 bottom-2.5 rounded-sm"
        style={{ backgroundColor: meta.surface }}
      />
      {/* Accent stripe */}
      <div
        className="absolute bottom-0 inset-x-0 h-[3px]"
        style={{ backgroundColor: meta.accent }}
      />
    </div>
  );
}

export function ThemeSelector({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!popoverOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [popoverOpen]);

  if (collapsed) {
    return (
      <div className="relative flex justify-center">
        <button
          ref={triggerRef}
          onClick={() => setPopoverOpen(!popoverOpen)}
          title="Change theme"
          className={cn(
            "rounded-lg p-2.5 transition-colors",
            popoverOpen
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Palette className="h-4 w-4" />
        </button>

        {popoverOpen && (
          <div
            ref={popoverRef}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 w-40 rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in slide-in-from-left-2 duration-150"
          >
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1.5 pb-1.5">
              Theme
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {THEMES.map((t) => {
                const meta = THEME_META[t];
                const isActive = theme === t;
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t);
                      setPopoverOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg p-1.5 transition-all",
                      isActive
                        ? "bg-primary/10"
                        : "hover:bg-secondary"
                    )}
                  >
                    <ThemePreview themeKey={t} isActive={isActive} />
                    <span className={cn(
                      "text-[10px] font-medium leading-none",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
        Theme
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {THEMES.map((t) => {
          const meta = THEME_META[t];
          const isActive = theme === t;
          return (
            <button
              key={t}
              onClick={() => setTheme(t)}
              title={meta.label}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg p-1.5 transition-all",
                isActive
                  ? "bg-primary/10"
                  : "hover:bg-secondary"
              )}
            >
              <ThemePreview themeKey={t} isActive={isActive} />
              <span className={cn(
                "text-[10px] font-medium leading-none",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
