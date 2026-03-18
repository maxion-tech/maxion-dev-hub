"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownProps<T> {
  value: T;
  options: readonly T[];
  onChange: (item: T) => void;
  getKey?: (item: T) => string | number;
  renderOption?: (item: T) => React.ReactNode;
  renderSelected?: (item: T) => React.ReactNode;
  label?: string;
  size?: "sm" | "default";
  className?: string;
}

function defaultGetKey<T>(item: T): string | number {
  if (typeof item === "object" && item !== null && "value" in item) {
    return String((item as Record<string, unknown>).value);
  }
  return String(item);
}

function defaultRender<T>(item: T): React.ReactNode {
  if (typeof item === "object" && item !== null && "label" in item) {
    return <span>{String((item as Record<string, unknown>).label)}</span>;
  }
  if (typeof item === "object" && item !== null && "name" in item) {
    return <span>{String((item as Record<string, unknown>).name)}</span>;
  }
  return <span>{String(item)}</span>;
}

export function Dropdown<T>({
  value,
  options,
  onChange,
  getKey = defaultGetKey,
  renderOption,
  renderSelected,
  label,
  size = "default",
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const renderOpt = renderOption ?? defaultRender;
  const renderSel = renderSelected ?? defaultRender;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const triggerClasses =
    size === "sm" ? "px-3 py-2 text-xs" : "px-3.5 py-2.5 text-sm";

  const optionClasses =
    size === "sm" ? "px-3 py-2 text-xs" : "px-3.5 py-2.5 text-sm";

  const chevronSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className={cn("relative", className)} ref={ref}>
      {label && (
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2.5 block">
          {label}
        </label>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-secondary/30 text-foreground transition-colors hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          triggerClasses
        )}
      >
        {renderSel(value)}
        <ChevronDown
          className={cn(
            "text-muted-foreground shrink-0 ml-2 transition-transform duration-150",
            chevronSize,
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-xl max-h-60 overflow-auto"
        >
          {options.map((item) => (
            <button
              key={getKey(item)}
              role="option"
              aria-selected={getKey(item) === getKey(value)}
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center transition-colors first:rounded-t-lg last:rounded-b-lg",
                optionClasses,
                getKey(item) === getKey(value)
                  ? "bg-secondary text-foreground"
                  : "text-foreground/80 hover:bg-secondary/50"
              )}
            >
              {renderOpt(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
