"use client";

interface PixelSpinnerProps {
  label?: string;
  className?: string;
}

export function PixelSpinner({ label = "Loading...", className = "" }: PixelSpinnerProps) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`} role="status">
      <span className="pixel-spinner text-primary-500">
        <span className="pixel-spinner-dot" />
        <span className="pixel-spinner-dot" />
        <span className="pixel-spinner-dot" />
      </span>
      <span className="text-sm font-bold text-neutral-600">{label}</span>
    </div>
  );
}
