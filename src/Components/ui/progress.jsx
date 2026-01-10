import React from "react";

export function Progress({ value = 0, className = "", ...props }) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-slate-100 ${className}`}
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
      role="progressbar"
      {...props}
    >
      <div
        className="h-full bg-slate-900 transition-[width] duration-300"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
