// Client-only image utilities. All processing happens on the user's device.

export type ConvertResult = {
  originalBlob: Blob;
  reducedBlob: Blob;
  originalWidth: number;
  originalHeight: number;
  reducedWidth: number;
  reducedHeight: number;
};

const HEIC_TYPES = ["image/heic", "image/heif"];
const HEIC_EXT = /\.(heic|heif)$/i;
const UNSUPPORTED_EXT = /\.(tif|tiff|arw|cr2|cr3|nef|nrw|orf|raf|rw2|dng|pef|srw|x3f|raw)$/i;

export function isHeic(file: File): boolean {
  return HEIC_TYPES.includes(file.type) || HEIC_EXT.test(file.name);
}

export function isLikelyUnsupported(file: File): boolean {
  // TIFF and RAW cannot be decoded natively by browsers.
  if (UNSUPPORTED_EXT.test(file.name)) return true;
  if (file.type === "image/tiff") return true;
  return false;
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Falha a decodificar a imagem."));
      img.src = url;
    });
    return img;
  } finally {
    // Revoke after a tick so the image finishes decoding
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function decodeToImage(file: File): Promise<HTMLImageElement> {
  if (isHeic(file)) {
    // The "csp" build never evaluates strings as code, so it works under the site's
    // strict Content-Security-Policy (no 'unsafe-eval').
    const { heicTo } = await import("heic-to/csp");
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
    return loadImageFromBlob(blob);
  }
  return loadImageFromBlob(file);
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao codificar JPEG."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function drawImageToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas não suportado.");
  // White background flattens transparency for JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

export async function convertToJpeg(
  file: File,
  opts: { quality: number; maxWidth: number },
): Promise<ConvertResult> {
  const img = await decodeToImage(file);
  const ow = img.naturalWidth;
  const oh = img.naturalHeight;

  const originalCanvas = drawImageToCanvas(img, ow, oh);
  const originalBlob = await canvasToJpeg(originalCanvas, opts.quality);

  // Reduced version: never upscale
  let rw = ow;
  let rh = oh;
  if (ow > opts.maxWidth) {
    rw = opts.maxWidth;
    rh = Math.round((oh * opts.maxWidth) / ow);
  }
  const reducedCanvas = drawImageToCanvas(img, rw, rh);
  // Slightly lower quality for the reduced upload variant
  const reducedBlob = await canvasToJpeg(reducedCanvas, Math.min(opts.quality, 0.82));

  return {
    originalBlob,
    reducedBlob,
    originalWidth: ow,
    originalHeight: oh,
    reducedWidth: rw,
    reducedHeight: rh,
  };
}

export function readableBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
