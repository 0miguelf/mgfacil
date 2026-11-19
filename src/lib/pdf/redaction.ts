import { PDFDocument } from "@cantoo/pdf-lib";
import { loadPdfDocument } from "./load";
import { loadPdf } from "./pdfjs";
import {
  redactionPixelBounds,
  validateRedactionRects,
  type RedactionPlan,
} from "./redaction-rules";

/**
 * Builds a new PDF in which only the pages that have zones marked are rasterised:
 * those pages become lossless PNGs where the marked pixels were cleared BEFORE
 * encoding (nothing is overlaid, so there is no text or image left underneath).
 * Pages without zones are copied unchanged, keeping their real, searchable text.
 * The output is a fresh document, so the original's metadata, attachments,
 * outline and form data are not carried over.
 */
export async function redactPdf(
  file: File,
  plan: RedactionPlan,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  for (const rects of plan.values()) validateRedactionRects(rects);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const source = await loadPdf(bytes.buffer);
  try {
    const total = source.numPages;
    for (const page of plan.keys()) {
      if (!Number.isInteger(page) || page < 1 || page > total) {
        throw new Error("Selecione páginas válidas para eliminar informações.");
      }
    }
    // Only needed when some pages are kept as they are.
    const original = plan.size < total ? await loadPdfDocument(bytes) : null;
    const output = await PDFDocument.create();

    for (let number = 1; number <= total; number++) {
      const rects = plan.get(number);
      if (!rects) {
        const [copied] = await output.copyPages(original!, [number - 1]);
        output.addPage(copied);
      } else {
        await addRedactedPage(output, source, number, rects);
      }
      onProgress?.(number, total);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    output.setProducer("MGFácil");
    output.setCreator("MGFácil");
    return await output.save({ useObjectStreams: true });
  } finally {
    await source.loadingTask.destroy();
  }
}

type PdfjsDoc = Awaited<ReturnType<typeof loadPdf>>;

async function addRedactedPage(
  output: PDFDocument,
  source: PdfjsDoc,
  number: number,
  rects: { x: number; y: number; width: number; height: number }[],
) {
  const page = await source.getPage(number);
  const viewport = page.getViewport({ scale: 200 / 72 });
  const physical = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  // Fail rather than silently downscale unusually large pages or emit blank content.
  if (canvas.width > 16384 || canvas.height > 16384 || canvas.width * canvas.height > 40_000_000) {
    throw new Error(
      `A página ${number} é demasiado grande para processamento seguro neste navegador.`,
    );
  }
  try {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Não foi possível preparar a página.");
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    ctx.fillStyle = "#ffffff"; // actual paper pixels, not a UI/theme colour
    for (const rect of rects) {
      const bounds = redactionPixelBounds(rect, canvas.width, canvas.height);
      ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Falha ao gerar a página limpa."))),
        "image/png",
      );
    });
    const image = await output.embedPng(await blob.arrayBuffer());
    const cleanPage = output.addPage([physical.width, physical.height]);
    cleanPage.drawImage(image, { x: 0, y: 0, width: physical.width, height: physical.height });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}
