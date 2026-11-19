export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function sanitizeFileName(name: string, fallback = "ficheiro"): string {
  const base = name.replace(/\.[^.]+$/, "");
  const clean = base.replace(/[^\w\-. ]+/g, "_").trim();
  return clean || fallback;
}

export function extOf(name: string): string {
  const m = name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "";
}
