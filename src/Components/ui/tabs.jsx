import React from "react";

const TabsCtx = React.createContext(null);

export function Tabs({ value, defaultValue, onValueChange, children, className = "" }) {
  const [internal, setInternal] = React.useState(defaultValue ?? value);
  const current = value ?? internal;

  const setValue = (v) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };

  return (
    <TabsCtx.Provider value={{ value: current, setValue }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className = "" }) {
  return <div className={`inline-flex gap-2 ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, children, className = "" }) {
  const ctx = React.useContext(TabsCtx);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx?.setValue(value)}
      className={`rounded-md px-3 py-2 text-sm border ${active ? "bg-slate-100" : "bg-white"} ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "" }) {
  const ctx = React.useContext(TabsCtx);
  if (ctx?.value !== value) return null;
  return <div className={className}>{children}</div>;
}
