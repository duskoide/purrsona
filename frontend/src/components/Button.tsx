import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  locked?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-primary-500 text-white border-2 border-neutral-900 shadow-[6px_6px_0_#111827]",
  secondary:
    "bg-secondary-400 text-neutral-900 border-2 border-neutral-900 shadow-[6px_6px_0_#111827]",
  ghost:
    "bg-transparent text-primary-500 border-2 border-primary-500",
  destructive:
    "bg-error-main text-white border-2 border-neutral-900 shadow-[6px_6px_0_#111827]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-6 py-2 text-base",
  lg: "px-8 py-3 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      locked = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading || locked;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        className={`inline-flex items-center justify-center font-bold rounded-full
          transition-all duration-100 ease-out cursor-pointer select-none
          focus-visible:outline-3 focus-visible:outline-offset-3
          ${variant === "primary" || variant === "secondary" || variant === "destructive"
            ? `hover:shadow-[8px_8px_0_#111827] hover:-translate-x-0.5 hover:-translate-y-0.5
               active:shadow-[2px_2px_0_#111827] active:translate-x-1 active:translate-y-1
               focus-visible:outline-secondary-400`
            : "hover:bg-primary-50 active:bg-primary-100 focus-visible:outline-primary-500"
          }
          ${isDisabled ? "opacity-50 pointer-events-none shadow-none translate-x-0 translate-y-0" : ""}
          ${locked ? "opacity-60 cursor-not-allowed" : ""}
          ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && (
          <span className="pixel-spinner mr-2" aria-hidden="true">
            <span className="pixel-spinner-dot" />
            <span className="pixel-spinner-dot" />
            <span className="pixel-spinner-dot" />
          </span>
        )}
        {locked && <span className="mr-2" aria-hidden="true">LOCKED</span>}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
