import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function ToggleSwitch({ label, checked, onChange, className }: ToggleSwitchProps) {
  return (
    <label className={cn("flex items-center gap-2 cursor-pointer group py-1.5", className)}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 transform rounded-full bg-foreground transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          )}
        />
      </button>
      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
        {label}
      </span>
    </label>
  );
}
