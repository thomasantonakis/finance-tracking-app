export function createPageUrl(name) {
  if (!name) return "/";
  if (name.toLowerCase() === "home") return "/";
  return "/" + name.toLowerCase();
}

const DUPLICATE_DATE_KEY = "__base44_duplicate_date__";

export function getDuplicateDate() {
  try {
    return localStorage.getItem(DUPLICATE_DATE_KEY);
  } catch {
    return null;
  }
}

export function setDuplicateDate(dateValue) {
  try {
    if (!dateValue) return;
    localStorage.setItem(DUPLICATE_DATE_KEY, dateValue);
  } catch {
    // Ignore storage failures.
  }
}
