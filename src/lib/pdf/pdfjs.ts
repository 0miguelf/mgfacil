// PDF.js configuration and rendering helpers. Client-only (lazy loaded).
import type * as PdfjsNs from "pdfjs-dist";
import { PASSWORD_PROTECTED_MESSAGE } from "./errors";

type Pdfjs = typeof PdfjsNs;

let pdfjsPromise: Promise<Pdfjs> | null = null;

async function getPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    })();
  }
  return pdfjsPromise;
}

export type ThumbInfo = {
  dataUrl: string;
  width: number;
  height: number;
};

export async function loadPdf(file: File | ArrayBuffer) {
  const pdfjsLib = await getPdfjs();
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjsLib.getDocument({
    // pdf.js transfers (detaches) the buffer it receives to its worker, so always
    // give it a copy; callers keep using the original bytes afterwards (e.g. to save).
    data: new Uint8Array(data).slice(),
  });
  try {
    return await loadingTask.promise;
  } catch (err) {
    if (err instanceof Error && err.name === "PasswordException") {
      throw new Error(PASSWORD_PROTECTED_MESSAGE);
    }
    throw err;
  }
}

export async function renderThumbnail(
  pdf: PdfjsNs.PDFDocumentProxy,
  pageNumber: number,
  maxSize = 220,
): Promise<ThumbInfo> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxSize / viewport.width, maxSize / viewport.height);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(scaled.width);
  canvas.height = Math.ceil(scaled.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a pré-visualização.");
  await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.75),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Render a page to a JPEG blob at a given DPI (relative to the PDF's 72pt base).
 * Uses toBlob (async, off main thread encode) which is much faster than toDataURL.
 */
export async function renderPageToJpegBlob(
  pdf: PdfjsNs.PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(dpi / 72, 4);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(scaled.width));
  canvas.height = Math.max(1, Math.ceil(scaled.height));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Não foi possível preparar a página.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem da página."))),
      "image/jpeg",
      quality,
    );
  });
  // free memory eagerly (important for very large documents)
  canvas.width = 0;
  canvas.height = 0;
  page.cleanup();
  return { blob, width: viewport.width, height: viewport.height };
}

export async function renderPageToJpeg(
  pdf: PdfjsNs.PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number,
  quality: number,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const dpi = (targetWidth / viewport.width) * 72;
  const { blob, width, height } = await renderPageToJpegBlob(pdf, pageNumber, dpi, quality);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}
