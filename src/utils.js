export function createPageUrl(name) {
  if (!name) return "/";
  if (name.toLowerCase() === "home") return "/";
  return "/" + name.toLowerCase();
}
