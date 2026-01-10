import React from "react";

const SelectCtx = React.createContext(null);

export function Select({ value, defaultValue, onValueChange, children }) {
  const [internal, setInternal] = React.useState(defaultValue ?? value);
  const current = value ?? internal;

  const setValue = (v) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };

  return (
    <SelectCtx.Provider value={{ value: current, setValue }}>
      {children}
    </SelectCtx.Provider>
  );
}

export function SelectTrigger({ children, className = "" }) {
  return (
    <div className={`border rounded-md px-3 py-2 cursor-pointer ${className}`}>
      {children}
    </div>
  );
}

export function SelectValue({ placeholder }) {
  const ctx = React.useContext(SelectCtx);
  return <span>{ctx?.value ?? placeholder}</span>;
}

export function SelectContent({ children }) {
  return <div className="mt-1 border rounded-md bg-white shadow">{children}</div>;
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
