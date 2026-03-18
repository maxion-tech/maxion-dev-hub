import { cn } from "@/lib/utils";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  blur?: boolean;
}

export function SectionCard({ children, className, blur }: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card",
        blur && "bg-card/80 backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}
