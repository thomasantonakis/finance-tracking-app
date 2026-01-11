import React from "react";

const SelectCtx = React.createContext(null);

export function Select({ value, defaultValue, onValueChange, children, className = "" }) {
  const [internal, setInternal] = React.useState(defaultValue ?? value);
  const [open, setOpen] = React.useState(false);
  const current = value ?? internal;
  const wrapperRef = React.useRef(null);

  const setValue = (v) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
    setOpen(false);
  };

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <SelectCtx.Provider value={{ value: current, setValue, open, setOpen }}>
      <div ref={wrapperRef} className={`relative inline-block ${className}`}>
        {children}
      </div>
    </SelectCtx.Provider>
  );
}

export function SelectTrigger({ children, className = "" }) {
  const ctx = React.useContext(SelectCtx);
  return (
    <button
      type="button"
      onClick={() => ctx?.setOpen(!ctx?.open)}
      className={`flex min-w-[8rem] items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm hover:bg-slate-50 ${className}`}
    >
      {children}
      <span className="text-slate-400">▾</span>
    </button>
  );
}

export function SelectValue({ placeholder }) {
  const ctx = React.useContext(SelectCtx);
  return <span>{ctx?.value ?? placeholder}</span>;
}

export function SelectContent({ children, className = "" }) {
  const ctx = React.useContext(SelectCtx);
  if (!ctx?.open) return null;
  return (
    <div
      className={`absolute z-50 mt-1 min-w-full max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, children }) {
  const ctx = React.useContext(SelectCtx);
  return (
    <div
      className="px-3 py-2 cursor-pointer hover:bg-slate-100"
      onClick={() => ctx?.setValue(value)}
    >
      {children}
    </div>
  );
}
