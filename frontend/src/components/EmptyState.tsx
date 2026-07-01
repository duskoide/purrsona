import { type ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`border-2 border-neutral-900 border-dashed p-8 text-center ${className}`}
    >
      <h3 className="text-xl font-bold text-neutral-600 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-neutral-500 mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
