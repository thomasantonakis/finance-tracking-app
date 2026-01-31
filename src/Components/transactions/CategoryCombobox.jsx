import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const normalizeValue = (name) => {
  const trimmed = name?.trim() || "";
  return trimmed.toLowerCase();
};

const formatLabel = (name) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function normalizeCategories(categories) {
  return categories.map((cat) => {
    const rawName = typeof cat === "string" ? cat : cat.name;
    return {
      value: normalizeValue(rawName),
      label: typeof cat === "object" && cat.label ? cat.label : formatLabel(rawName),
      color: typeof cat === "object" ? cat.color : null,
    };
  });
}

export default function CategoryCombobox({
  id,
  label,
  value,
  onChange,
  onSelectItem,
  categories,
  placeholder,
  required,
}) {
  const [open, setOpen] = React.useState(false);
  const [hasUserTyped, setHasUserTyped] = React.useState(false);
  const wrapperRef = React.useRef(null);
  const normalized = React.useMemo(() => normalizeCategories(categories), [categories]);
  const query = open && !hasUserTyped ? "" : value || "";
  const queryLower = query.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!queryLower) return normalized;
    return normalized.filter((cat) => cat.label.toLowerCase().includes(queryLower));
  }, [normalized, queryLower]);

  const hasExactMatch = React.useMemo(() => {
    if (!queryLower) return false;
    return normalized.some((cat) => cat.value === queryLower);
  }, [normalized, queryLower]);

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

    const handleSelect = (item) => {
      onChange(item.label);
      onSelectItem?.(item);
      setHasUserTyped(false);
      setOpen(false);
    };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setHasUserTyped(true);
            setOpen(true);
          }}
          onFocus={() => {
            setHasUserTyped(false);
            setOpen(true);
          }}
          required={required}
        />
        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400">No categories found</div>
            )}
            {filtered.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => handleSelect(cat)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100"
              >
                {cat.color && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                )}
                <span className="capitalize">{cat.label}</span>
              </button>
            ))}
            {!hasExactMatch && queryLower && (
              <button
                type="button"
                onClick={() => handleSelect(query)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
              >
                + Create "{query}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
