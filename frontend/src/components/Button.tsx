import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-primary-500 text-white border-2 border-neutral-900 shadow-press-md hover:shadow-press-lg hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-sm active:translate-x-1 active:translate-y-1",
  secondary:
    "bg-secondary-400 text-neutral-900 border-2 border-neutral-900 shadow-press-md hover:shadow-press-lg hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-sm active:translate-x-1 active:translate-y-1",
  ghost:
    "bg-transparent text-primary-500 border-2 border-primary-500 hover:bg-primary-50 active:bg-primary-100",
  destructive:
    "bg-error-main text-white border-2 border-neutral-900 shadow-press-md hover:shadow-press-lg hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-sm active:translate-x-1 active:translate-y-1",
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
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-bold rounded-full
          transition-all duration-100 ease-out
          disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0
          ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && (
          <span className="mr-2 inline-block animate-pulse">...</span>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
