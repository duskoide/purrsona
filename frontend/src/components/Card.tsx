import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  rainbow?: boolean;
}

export function Card({ children, rainbow = false, className = "" }: CardProps) {
  return (
    <div
      className={`bg-white p-6 border-2 border-neutral-900
        ${rainbow ? "shadow-rainbow" : "shadow-press-md"}
        ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }: Omit<CardProps, "rainbow">) {
  return <h2 className={`text-xl font-bold mb-4 ${className}`}>{children}</h2>;
}
