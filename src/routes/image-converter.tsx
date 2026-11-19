import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

import { AppShell, PrivacyBanner } from "../components/AppShell";
import { DropZone } from "../components/DropZone";
import { formatBytes, uniqueFileName } from "../lib/format";
import {
  convertToJpeg,
  isLikelyUnsupported,
  readableBaseName,
  type ConvertResult,
} from "../lib/image/convert";

export const Route = createFileRoute("/image-converter")({
  head: () => ({
    meta: [
      { title: "Conversor de imagens para JPG — MGFácil" },
      {
        name: "description",
        content:
          "Converta PNG, WebP, HEIC/HEIF e outros formatos para JPG localmente no navegador, com versão original e versão reduzida.",
      },
      { property: "og:title", content: "Conversor de imagens para JPG — MGFácil" },
      { property: "og:description", content: "Converta imagens para JPG no dispositivo, com versão original e reduzida." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImageConverterPage,
});

type Status = "pending" | "processing" | "done" | "error" | "unsupported";

type Item = {
  id: string;
  file: File;
  previewUrl: string;
  status: Status;
  message?: string;
  result?: ConvertResult;
};

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ImageConverterPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState<number>(0.9);
  const [maxWidth, setMaxWidth] = useState<number>(1600);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    return () => {
      // Revoke preview URLs on unmount
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const next: Item[] = files.map((file) => {
      const unsupported = isLikelyUnsupported(file);
      return {
        id: newId(),
        file,
        previewUrl: unsupported ? "" : URL.createObjectURL(file),
        status: unsupported ? "unsupported" : "pending",
        message: unsupported
          ? "Formato TIFF/RAW não é suportado pelos navegadores. Converta para PNG/JPG numa aplicação de escritório antes de carregar."
          : undefined,
      };
    });
    setItems((prev) => [...prev, ...next]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }, []);

  const runConversion = useCallback(async () => {
    setIsProcessing(true);
    try {
      const pending = items.filter((it) => it.status === "pending" || it.status === "error");
      for (const item of pending) {
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: "processing", message: undefined } : p,
          ),
        );
        try {
          const result = await convertToJpeg(item.file, { quality, maxWidth });
          setItems((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: "done", result } : p)),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro desconhecido.";
          setItems((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: "error", message } : p)),
          );
        }
      }
      toast.success("Conversão concluída.");
    } finally {
      setIsProcessing(false);
    }
  }, [items, quality, maxWidth]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, []);

  const downloadAllZip = useCallback(
    async (which: "original" | "reduced") => {
      const done = items.filter((it) => it.status === "done" && it.result);
      if (done.length === 0) {
        toast.info("Nenhuma imagem convertida ainda.");
        return;
      }
      const zip = new JSZip();
      const used = new Set<string>();
      for (const it of done) {
        const base = readableBaseName(it.file.name);
        const blob = which === "original" ? it.result!.originalBlob : it.result!.reducedBlob;
        const suffix = which === "original" ? "" : "-reduzida";
        // e.g. foto.png and foto.heic would both become foto.jpg and overwrite each other
        zip.file(uniqueFileName(`${base}${suffix}.jpg`, used), blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(
        blob,
        which === "original" ? "imagens-originais.zip" : "imagens-reduzidas.zip",
      );
    },
    [items, downloadBlob],
  );

  const readyCount = useMemo(
    () => items.filter((i) => i.status === "done").length,
    [items],
  );
  const pendingCount = useMemo(
    () => items.filter((i) => i.status === "pending" || i.status === "error").length,
    [items],
  );

  return (
    <AppShell
      title="Conversor de imagens para JPG"
      subtitle="Processado localmente, sem envio de ficheiros"
    >
      <div className="space-y-6">
        <PrivacyBanner />

        <DropZone
          onFiles={addFiles}
          accept={{
            "image/*": [
              ".png",
              ".jpg",
              ".jpeg",
              ".webp",
              ".heic",
              ".heif",
              ".bmp",
              ".tif",
              ".tiff",
            ],
          }}
          hint="PNG, WebP, HEIC/HEIF, BMP · TIFF/RAW não são suportados pelos navegadores"
        />

        <div className="glass grid gap-4 rounded-3xl p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <label className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
              Qualidade JPG
              <span className="text-xs text-muted-foreground">
                {Math.round(quality * 100)}%
              </span>
            </label>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={Math.round(quality * 100)}
              onChange={(e) => setQuality(Number(e.target.value) / 100)}
              className="w-full accent-primary"
              aria-label="Qualidade de conversão JPG"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              A qualidade aplica-se à versão original. A versão reduzida usa até 82% para caber
              em plataformas clínicas.
            </p>
          </div>
          <div>
            <label className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
              Largura máxima da versão reduzida
              <span className="text-xs text-muted-foreground">{maxWidth}px</span>
            </label>
            <input
              type="range"
              min={800}
              max={2400}
              step={100}
              value={maxWidth}
              onChange={(e) => setMaxWidth(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Largura máxima da versão reduzida"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Imagens menores não são aumentadas artificialmente.
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="glass rounded-3xl p-4 sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">
                  {items.length} {items.length === 1 ? "ficheiro" : "ficheiros"}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {readyCount} convertidos · {pendingCount} por converter
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-white/90 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={runConversion}
                  disabled={isProcessing || pendingCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  {isProcessing ? "A converter…" : "Converter"}
                </button>
              </div>
            </div>

            {readyCount > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/50 pt-4">
                <button
                  type="button"
                  onClick={() => downloadAllZip("original")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-white/90"
                >
                  <Package className="h-4 w-4" />
                  ZIP · originais
                </button>
                <button
                  type="button"
                  onClick={() => downloadAllZip("reduced")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-white/90"
                >
                  <Package className="h-4 w-4" />
                  ZIP · reduzidas
                </button>
              </div>
            )}

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="glass-strong grid grid-cols-[80px_minmax(0,1fr)_auto] gap-3 rounded-2xl p-3"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {it.previewUrl ? (
                      <img
                        src={it.previewUrl}
                        alt={it.file.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {it.file.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(it.file.type || "—").replace("image/", "").toUpperCase() || "—"} ·{" "}
                      {formatBytes(it.file.size)}
                    </p>
                    <div className="mt-2">
                      <StatusPill item={it} />
                    </div>
                    {it.result && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            downloadBlob(
                              it.result!.originalBlob,
                              `${readableBaseName(it.file.name)}.jpg`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-white/70 px-2 py-1 text-xs font-medium text-foreground transition hover:bg-white"
                        >
                          <Download className="h-3 w-3" />
                          Original · {formatBytes(it.result.originalBlob.size)}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadBlob(
                              it.result!.reducedBlob,
                              `${readableBaseName(it.file.name)}-reduzida.jpg`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-white/70 px-2 py-1 text-xs font-medium text-foreground transition hover:bg-white"
                        >
                          <Download className="h-3 w-3" />
                          Reduzida · {formatBytes(it.result.reducedBlob.size)}
                        </button>
                      </div>
                    )}
                    {it.message && it.status !== "done" && (
                      <p className="mt-1.5 text-xs text-destructive">{it.message}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-white/60 text-muted-foreground transition hover:bg-white hover:text-foreground"
                    aria-label={`Remover ${it.file.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatusPill({ item }: { item: Item }) {
  switch (item.status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Pendente
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          <Loader2 className="h-3 w-3 animate-spin" /> A converter…
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          {item.result
            ? `${item.result.originalWidth}×${item.result.originalHeight} → ${item.result.reducedWidth}×${item.result.reducedHeight}`
            : "Concluído"}
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          <AlertTriangle className="h-3 w-3" /> Erro
        </span>
      );
    case "unsupported":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          <AlertTriangle className="h-3 w-3" /> Formato não suportado
        </span>
      );
  }
}
