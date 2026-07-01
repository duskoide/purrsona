import { type InputHTMLAttributes, forwardRef } from "react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, helper, id, className = "", ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div>
        <label
          htmlFor={inputId}
          className="block text-sm font-bold text-neutral-900 mb-1"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-4 py-2 text-base font-sans
            border-2 border-neutral-900 bg-white
            focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-3
            ${error ? "border-error-main" : ""}
            ${className}`}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helper
                ? `${inputId}-helper`
                : undefined
          }
          {...props}
        />
        {helper && !error && (
          <p
            id={`${inputId}-helper`}
            className="mt-1 text-xs text-neutral-500 font-bold"
          >
            {helper}
          </p>
        )}
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1 text-sm text-error-main font-bold"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

TextInput.displayName = "TextInput";
