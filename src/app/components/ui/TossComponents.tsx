import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", fullWidth, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-[18px] font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-[#0064FF] text-white hover:bg-[#0052cc] shadow-md shadow-blue-500/20",
      secondary: "bg-[#E8F3FF] text-[#0064FF] hover:bg-[#DBE9FF]",
      ghost: "bg-transparent text-[#4E5968] hover:bg-black/5",
      danger: "bg-red-500 text-white hover:bg-red-600",
    };

    const sizes = {
      sm: "h-10 px-4 text-[15px]",
      md: "h-12 px-5 text-[17px]",
      lg: "h-14 px-6 text-[19px]",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth ? "w-full" : "",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// --- Card ---
export const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "bg-white rounded-[24px] p-6 shadow-sm border border-gray-100",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">{label}</label>}
        <input
          ref={ref}
          className={cn(
            "w-full h-12 px-4 rounded-[16px] bg-[#F9FAFB] border border-transparent text-[#191F28] placeholder-[#B0B8C1] focus:bg-white focus:border-[#0064FF] focus:outline-none transition-colors font-medium text-[17px]",
            error && "bg-red-50 border-red-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-red-500 text-xs ml-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// --- Checkbox ---
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  subLabel?: string;
}

export const Checkbox = ({ label, subLabel, className, ...props }: CheckboxProps) => {
  return (
    <label className={cn("flex items-start gap-3 cursor-pointer group p-2 -ml-2 rounded-xl hover:bg-gray-50 transition-colors text-[#333D4B]", className)}>
      <div className="relative flex items-center mt-0.5">
        <input type="checkbox" className="peer sr-only" {...props} />
        <div className="w-6 h-6 rounded-full border-2 border-[#D1D6DB] peer-checked:bg-[#0064FF] peer-checked:border-[#0064FF] transition-all bg-white" />
        <Check className="w-3.5 h-3.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
      </div>
      <div className="flex-1">
        <p className={cn("text-[15px] font-medium leading-snug", props.checked ? "text-[#191F28]" : "")}>
          {label}
        </p>
        {subLabel && <p className="text-[13px] text-[#8B95A1] mt-0.5 leading-relaxed break-keep">{subLabel}</p>}
      </div>
    </label>
  );
};

// --- Page Header ---
export const PageHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="mb-6 px-1">
    <h1 className="text-[26px] font-bold text-[#191F28] leading-snug mb-2 whitespace-pre-wrap break-keep">
      {title}
    </h1>

  </div>
);
