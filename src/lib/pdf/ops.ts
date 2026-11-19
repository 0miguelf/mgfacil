import { PDFDocument, degrees } from "@cantoo/pdf-lib";
import { loadPdfDocument } from "./load";
import { loadPdf, renderPageToJpegBlob } from "./pdfjs";

export type SourceDoc = {
  bytes: Uint8Array;
  pageCount: number;
};

export async function readSource(file: File): Promise<SourceDoc> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await loadPdfDocument(bytes);
  return { bytes, pageCount: pdf.getPageCount() };
}

/** Merge multiple PDFs in order. */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const src = await loadPdfDocument(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

export type PageRef = {
  /** 1-indexed page number in the source */
  page: number;
  rotation: 0 | 90 | 180 | 270;
};

/** Build a new PDF from picked pages of a source, with optional rotations. */
export async function buildFromPages(
  sourceBytes: Uint8Array,
  refs: PageRef[],
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const src = await loadPdfDocument(sourceBytes);
  const indices = refs.map((r) => r.page - 1);
  const copied = await out.copyPages(src, indices);
  copied.forEach((page, i) => {
    const rot = refs[i].rotation;
    if (rot) {
      const base = page.getRotation().angle;
      page.setRotation(degrees((base + rot) % 360));
    }
    out.addPage(page);
  });
  return out.save();
}

const TARGET_MAX_BYTES = 5 * 1024 * 1024;
const SAFETY = 0.92; // aim slightly below the limit to cover PDF overhead

export type CompressProgress = {
  phase: "analyze" | "render" | "finalize";
  done: number;
  total: number;
};

/**
 * Fast, single-pass compression.
 *
 * Instead of rasterizing the whole document several times, we sample a few
 * pages to estimate how many bytes each page costs at a given DPI/quality,
 * pick the highest-resolution setting whose estimate fits the 5 MB budget,
 * and then render the document exactly once with that setting.
 */
export async function compressPdfAdaptive(
  file: File,
  onProgress?: (p: CompressProgress) => void,
): Promise<Uint8Array> {
  // Already small enough: just rewrite losslessly (keeps real text & resolution).
  if (file.size <= TARGET_MAX_BYTES) {
    const src = await loadPdfDocument(new Uint8Array(await file.arrayBuffer()));
    const out = await src.save({ useObjectStreams: true });
    if (out.byteLength <= TARGET_MAX_BYTES) return out;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await loadPdf(bytes.buffer);
  const total = doc.numPages;

  // Candidate settings, best quality first.
  const candidates: { dpi: number; quality: number }[] = [
    { dpi: 200, quality: 0.82 },
    { dpi: 170, quality: 0.78 },
    { dpi: 150, quality: 0.72 },
    { dpi: 130, quality: 0.68 },
    { dpi: 110, quality: 0.62 },
    { dpi: 96, quality: 0.55 },
    { dpi: 80, quality: 0.5 },
    { dpi: 68, quality: 0.42 },
  ];

  const budgetPerPage = (TARGET_MAX_BYTES * SAFETY) / total;

  // Sample up to 3 representative pages.
  const sampleIdx = Array.from(
    new Set(
      [1, Math.ceil(total / 2), total]
        .map((n) => Math.min(Math.max(1, n), total))
        .slice(0, Math.min(3, total)),
    ),
  );

  onProgress?.({ phase: "analyze", done: 0, total: sampleIdx.length });

  let chosen = candidates[candidates.length - 1];
  for (let c = 0; c < candidates.length; c++) {
    const cand = candidates[c];
    let sum = 0;
    for (let s = 0; s < sampleIdx.length; s++) {
      const { blob } = await renderPageToJpegBlob(doc, sampleIdx[s], cand.dpi, cand.quality);
      sum += blob.size;
      onProgress?.({ phase: "analyze", done: s + 1, total: sampleIdx.length });
    }
    const avg = sum / sampleIdx.length;
    if (avg <= budgetPerPage) {
      chosen = cand;
      break;
    }
  }

  const out = await PDFDocument.create();
  for (let i = 1; i <= total; i++) {
    const { blob, width, height } = await renderPageToJpegBlob(
      doc,
      i,
      chosen.dpi,
      chosen.quality,
    );
    const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const page = out.addPage([width, height]);
    page.drawImage(jpg, { x: 0, y: 0, width, height });
    onProgress?.({ phase: "render", done: i, total });
  }
  onProgress?.({ phase: "finalize", done: total, total });
  return out.save({ useObjectStreams: true });
}
