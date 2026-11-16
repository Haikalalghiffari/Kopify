import React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  name?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  name,
  error,
  required,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5 w-full", className)}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      </div>

      {children}

      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}

      {error && (
        <p className="text-xs text-rose-600 font-medium animate-in fade-in">
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors",
          "placeholder:text-slate-400 focus:ring-2 focus:ring-offset-1",
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
            : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-100",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
