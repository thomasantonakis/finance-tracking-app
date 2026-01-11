import React from "react";

export function Button({ children, className = "", variant = "default", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium border " +
    "transition-colors active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none shadow-sm";
  const styles =
    variant === "ghost"
      ? "border-transparent bg-transparent text-slate-700 hover:bg-slate-100"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
