import React from "react";

const SelectCtx = React.createContext(null);

const collectLabels = (nodes, map) => {
  React.Children.forEach(nodes, (child) => {
    if (!React.isValidElement(child)) return;
    const typeName = child.type?.displayName;
    if (typeName === "SelectItem") {
      const { value, label, children } = child.props || {};
      const text = label ?? (typeof children === "string" ? children : null);
      if (value && text) {
        map[value] = text;
      }
    }
    if (child.props?.children) {
      collectLabels(child.props.children, map);
    }
  });
};

export function Select({ value, defaultValue, onValueChange, children, className = "" }) {
  const [internal, setInternal] = React.useState(defaultValue ?? value);
  const [open, setOpen] = React.useState(false);
  const [labels, setLabels] = React.useState({});
  const current = value ?? internal;
  const wrapperRef = React.useRef(null);
  const staticLabels = React.useMemo(() => {
    const map = {};
    collectLabels(children, map);
    return map;
  }, [children]);

  const setValue = (v) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
    setOpen(false);
  };

  const registerLabel = React.useCallback((val, label) => {
    if (!val) return;
    setLabels((prev) => (prev[val] === label ? prev : { ...prev, [val]: label }));
  }, []);

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
    <SelectCtx.Provider
      value={{
        value: current,
        setValue,
        open,
        setOpen,
        labels: { ...staticLabels, ...labels },
        registerLabel,
      }}
    >
      <div ref={wrapperRef} className={`relative inline-block ${className}`}>
        {children}
      </div>
    </SelectCtx.Provider>
  );
}

export function SelectTrigger({ children, className = "", variant = "default" }) {
  const ctx = React.useContext(SelectCtx);
  const variantStyles =
    variant === "inverted"
      ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
      : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={() => ctx?.setOpen(!ctx?.open)}
      className={`flex min-w-[8rem] items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-sm ${variantStyles} ${className}`}
    >
      {children}
      <span className="text-slate-400">▾</span>
    </button>
  );
}

export function SelectValue({ placeholder }) {
  const ctx = React.useContext(SelectCtx);
  const label = ctx?.labels?.[ctx?.value];
  return <span>{label ?? ctx?.value ?? placeholder}</span>;
}

export function SelectContent({ children, className = "" }) {
  const ctx = React.useContext(SelectCtx);
  if (!ctx?.open) return null;
  return (
    <div
      className={`absolute z-50 mt-1 min-w-full max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-slate-900 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, children, label }) {
  const ctx = React.useContext(SelectCtx);
  React.useEffect(() => {
    if (!ctx?.registerLabel) return;
    const labelText =
      label ?? (typeof children === "string" ? children : null);
    if (labelText) ctx.registerLabel(value, labelText);
  }, [children, ctx, value, label]);
  return (
    <div
      className="px-3 py-2 cursor-pointer hover:bg-slate-100"
      onClick={() => ctx?.setValue(value)}
    >
      {children}
    </div>
  );
}

SelectItem.displayName = "SelectItem";
