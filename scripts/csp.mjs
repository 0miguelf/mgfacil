// Runs after `vite build`: adds a strict Content-Security-Policy to the static site.
//
// The policy only allows scripts served by the site itself plus the exact inline
// scripts the framework writes into each page (allowed by their SHA-256 hash, so any
// injected script is refused), and `connect-src 'self'` stops the browser from sending
// data to any other server. It is written twice:
//   - as a <meta> tag in every page, so it works on any host (and in local previews);
//   - in `_headers`, which Cloudflare Pages and Netlify serve as real HTTP headers
//     (needed for `frame-ancestors`, which browsers ignore in <meta>).
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist/client";

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => {
      const path = join(dir, e.name);
      if (e.isDirectory()) return htmlFiles(path);
      return e.name.endsWith(".html") ? [path] : [];
    }),
  );
  return files.flat();
}

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

function policy(hashes, { meta }) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${hashes.map((h) => `'${h}'`).join(" ")}`,
    // heic2any decodes HEIC photos in a worker created from a blob: URL.
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "img-src 'self' blob: data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ];
  if (!meta) directives.push("frame-ancestors 'none'");
  return directives.join("; ");
}

const files = await htmlFiles(OUT);
if (!files.length) throw new Error(`csp: no HTML files in ${OUT}; run vite build first`);

const pages = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));
const hashes = new Set();
for (const [, html] of pages) {
  for (const [, body] of html.matchAll(INLINE_SCRIPT)) {
    // Hash the script as the browser sees it after HTML parsing: line breaks are
    // normalised to \n and NUL characters (TanStack writes some in route ids) become U+FFFD.
    const parsed = body.replace(/\r\n?/g, "\n").replaceAll("\0", "\uFFFD");
    hashes.add(`sha256-${createHash("sha256").update(parsed, "utf8").digest("base64")}`);
  }
}
const sorted = [...hashes].sort();

const meta = `<meta http-equiv="Content-Security-Policy" content="${policy(sorted, { meta: true })}">`;
for (const [file, html] of pages) {
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  // Right after the charset declaration (which must stay within the first 1024 bytes)
  // and before any script, so the policy applies to everything on the page.
  const anchor = /<meta charSet="utf-8"\/?>/i.test(html) ? /<meta charSet="utf-8"\/?>/i : /<head>/i;
  if (!anchor.test(html)) throw new Error(`csp: no <head> in ${file}`);
  await writeFile(
    file,
    html.replace(anchor, (m) => m + meta),
  );
}

const headers = `/*
  Content-Security-Policy: ${policy(sorted, { meta: false })}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
`;
await writeFile(join(OUT, "_headers"), headers);

console.log(`[csp] ${files.length} pages, ${sorted.length} inline script hashes; wrote _headers`);
