import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "standard" | "featured" | "score" | "achievement" | "locked";
  selected?: boolean;
}

const variantStyles: Record<string, string> = {
  standard: "bg-white border-2 border-neutral-900 shadow-[6px_6px_0_#111827]",
  featured:
    "bg-white border-2 border-neutral-900 shadow-[4px_4px_0_#4502FF,8px_8px_0_#FFDA14,12px_12px_0_#111827]",
  score: "bg-primary-500 text-white border-2 border-neutral-900 shadow-[6px_6px_0_#111827]",
  achievement:
    "bg-secondary-400 text-neutral-900 border-2 border-neutral-900 shadow-[4px_4px_0_#4502FF,8px_8px_0_#FFDA14,12px_12px_0_#111827]",
  locked: "bg-neutral-200 text-neutral-500 border-2 border-neutral-400 opacity-60",
};

export function Card({
  children,
  variant = "standard",
  selected = false,
  className = "",
}: CardProps) {
  return (
    <div
      className={`p-6 ${variantStyles[variant]}
        ${selected ? "ring-4 ring-primary-500 ring-offset-2" : ""}
        ${className}`}
      aria-disabled={variant === "locked" || undefined}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={`text-xl font-bold mb-4 ${className}`}>{children}</h2>;
}

export function CardScore({
  value,
  label,
  className = "",
}: {
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      <p className="text-4xl font-bold">{value}</p>
      <p className="text-sm font-bold opacity-80">{label}</p>
    </div>
  );
}
