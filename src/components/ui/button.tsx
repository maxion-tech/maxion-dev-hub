import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-primary text-primary-foreground font-semibold hover:bg-primary/90",
  secondary:
    "border border-border text-foreground font-medium hover:bg-secondary hover:border-primary/20",
  destructive:
    "border border-destructive/30 text-destructive hover:bg-destructive/10",
  ghost:
    "text-muted-foreground hover:text-foreground hover:bg-secondary",
} as const;

const sizes = {
  default: "px-4 py-2 text-sm gap-2",
  sm: "px-3 py-1.5 text-xs gap-1.5",
  icon: "p-2",
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "default", className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
