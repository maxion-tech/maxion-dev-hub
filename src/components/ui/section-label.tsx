import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  as?: "span" | "label" | "p";
  className?: string;
}

export function SectionLabel({ children, as: Tag = "span", className }: SectionLabelProps) {
  return (
    <Tag className={cn("text-xs font-medium text-muted-foreground uppercase tracking-wider", className)}>
      {children}
    </Tag>
  );
}
