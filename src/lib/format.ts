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

/**
 * Returns `name`, or `name-2`, `name-3`… (before the extension) if it is already in
 * `used`, and records the result. Prevents files with the same name from overwriting
 * each other inside a ZIP. Comparison ignores case, as Windows and macOS do.
 */
export function uniqueFileName(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base}-${n}${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
