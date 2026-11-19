import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Eraser,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Button } from "./ui/button";
import { DropZone } from "./DropZone";
import { loadPdf, renderThumbnail } from "../lib/pdf/pdfjs";
import { redactPdf } from "../lib/pdf/redaction";
import {
  buildRedactionPlan,
  zonePages,
  zoneScopeError,
  type RedactionRect,
  type RedactionZone,
  type ZoneScope,
} from "../lib/pdf/redaction-rules";
import { sanitizeFileName } from "../lib/format";

type Doc = { id: string; file: File; total: number };
type Result = { name: string; bytes: Uint8Array };
type NewZoneScope = "page" | "all";

let nextId = 0;
const uid = (prefix: string) => `${prefix}${++nextId}`;

export function PdfRedactionTab() {
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const loadId = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState("");
  const [zones, setZones] = useState<RedactionZone[]>([]);
  const [draft, setDraft] = useState<RedactionRect | null>(null);
  const [newZoneScope, setNewZoneScope] = useState<NewZoneScope>("page");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ file: 0, files: 0, page: 0, pages: 0 });
  const [results, setResults] = useState<Result[] | null>(null);

  const previewDoc = docs.find((d) => d.id === previewDocId) ?? null;
  const total = previewDoc?.total ?? 0;
  const maxPages = docs.reduce((max, d) => Math.max(max, d.total), 0);
  const differentLengths = new Set(docs.map((d) => d.total)).size > 1;

  useEffect(
    () => () => {
      loadId.current++;
      void pdfRef.current?.loadingTask.destroy();
    },
    [],
  );
  useEffect(() => {
    setResults(null);
  }, [zones, docs]);

  const zoneErrors = useMemo(
    () => new Map(zones.map((z) => [z.id, zoneScopeError(z.scope, Math.max(maxPages, 1))])),
    [zones, maxPages],
  );
  const hasErrors = [...zoneErrors.values()].some(Boolean);

  const zonesOnPage = useMemo(() => {
    if (!total) return [];
    return zones.filter((z) => {
      if (zoneErrors.get(z.id)) return false;
      return zonePages(z.scope, total, maxPages).includes(page);
    });
  }, [zones, zoneErrors, total, maxPages, page]);

  const reset = () => {
    loadId.current++;
    void pdfRef.current?.loadingTask.destroy();
    pdfRef.current = null;
    setDocs([]);
    setPreviewDocId(null);
    setPreview("");
    setZones([]);
    setDraft(null);
    setResults(null);
  };

  /** Open a document for preview at a given page. */
  const showDoc = async (doc: Doc, pageNumber: number) => {
    const id = ++loadId.current;
    setPreviewLoading(true);
    try {
      void pdfRef.current?.loadingTask.destroy();
      pdfRef.current = null;
      const pdf = await loadPdf(doc.file);
      if (id !== loadId.current) {
        await pdf.loadingTask.destroy();
        return;
      }
      pdfRef.current = pdf;
      const target = Math.min(Math.max(1, pageNumber), pdf.numPages);
      const thumb = await renderThumbnail(pdf, target, 1400);
      if (id !== loadId.current) return;
      setPreviewDocId(doc.id);
      setPage(target);
      setPreview(thumb.dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível mostrar o PDF.");
    } finally {
      if (id === loadId.current) setPreviewLoading(false);
    }
  };

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setLoading(true);
    const added: Doc[] = [];
    for (const file of files) {
      try {
        const pdf = await loadPdf(file);
        added.push({ id: uid("d"), file, total: pdf.numPages });
        await pdf.loadingTask.destroy();
      } catch (error) {
        toast.error(
          `${file.name}: ${error instanceof Error ? error.message : "não foi possível abrir o PDF."}`,
        );
      }
    }
    setLoading(false);
    if (!added.length) return;
    const wasEmpty = docs.length === 0;
    setDocs((prev) => [...prev, ...added]);
    if (wasEmpty) await showDoc(added[0], 1);
  };

  const removeDoc = async (id: string) => {
    const remaining = docs.filter((d) => d.id !== id);
    if (!remaining.length) {
      reset();
      return;
    }
    setDocs(remaining);
    if (id === previewDocId) await showDoc(remaining[0], page);
  };

  const navigate = async (next: number) => {
    const pdf = pdfRef.current;
    if (!pdf || next < 1 || next > total) return;
    setPreviewLoading(true);
    try {
      const thumb = await renderThumbnail(pdf, next, 1400);
      setPreview(thumb.dataUrl);
      setPage(next);
    } catch {
      toast.error("Não foi possível mostrar esta página.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const point = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  };
  const updateDraft = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (!origin) return null;
    const end = point(event);
    const rect = {
      x: Math.min(origin.x, end.x),
      y: Math.min(origin.y, end.y),
      width: Math.abs(end.x - origin.x),
      height: Math.abs(end.y - origin.y),
    };
    setDraft(rect);
    return rect;
  };

  const updateZoneScope = (id: string, scope: ZoneScope) =>
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, scope } : z)));

  const run = async () => {
    if (!docs.length || !zones.length || hasErrors || busy) return;
    setBusy(true);
    setResults(null);
    const out: Result[] = [];
    const usedNames = new Set<string>();
    try {
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        setProgress({ file: i + 1, files: docs.length, page: 0, pages: doc.total });
        const plan = buildRedactionPlan(zones, doc.total, maxPages);
        const bytes = await redactPdf(doc.file, plan, (done, pages) =>
          setProgress({ file: i + 1, files: docs.length, page: done, pages }),
        );
        let name = `${sanitizeFileName(doc.file.name, "documento")}-sem-informacoes.pdf`;
        for (let n = 2; usedNames.has(name); n++) {
          name = `${sanitizeFileName(doc.file.name, "documento")}-sem-informacoes-${n}.pdf`;
        }
        usedNames.add(name);
        out.push({ name, bytes });
      }
      setResults(out);
      toast.success(
        out.length === 1
          ? "As zonas selecionadas foram eliminadas do novo PDF."
          : `As zonas selecionadas foram eliminadas de ${out.length} PDFs.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível eliminar as informações.",
      );
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!results?.length) return;
    let blob: Blob;
    let filename: string;
    if (results.length === 1) {
      const buffer = new ArrayBuffer(results[0].bytes.byteLength);
      new Uint8Array(buffer).set(results[0].bytes);
      blob = new Blob([buffer], { type: "application/pdf" });
      filename = results[0].name;
    } else {
      const zip = new JSZip();
      for (const r of results) zip.file(r.name, r.bytes);
      blob = await zip.generateAsync({ type: "blob" });
      filename = "documentos-sem-informacoes.zip";
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const scopeLabel = (scope: ZoneScope) =>
    scope.kind === "all"
      ? "Todas as páginas"
      : scope.kind === "page"
        ? `Página ${scope.page}`
        : "Páginas específicas";

  return (
    <div className="space-y-4">
      {!docs.length && !loading && (
        <DropZone
          onFiles={addFiles}
          accept={{ "application/pdf": [".pdf"] }}
          multiple
          hint="Um ou vários PDFs. Com vários documentos semelhantes, as mesmas zonas são removidas em todos."
        />
      )}
      {loading && !docs.length && (
        <div role="status" className="glass flex items-center gap-2 rounded-2xl p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> A abrir os PDFs…
        </div>
      )}
      {docs.length > 0 && (
        <div className="glass space-y-5 rounded-2xl p-4 sm:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">Remover informações</h2>
              <p className="truncate text-sm text-muted-foreground">
                {docs.length === 1
                  ? `${docs[0].file.name} · ${docs[0].total} ${docs[0].total === 1 ? "página" : "páginas"}`
                  : `${docs.length} documentos`}
              </p>
            </div>
            <Button variant="outline" disabled={busy || previewLoading} onClick={reset}>
              <X /> Recomeçar
            </Button>
          </header>
          <p className="text-sm text-foreground/80">
            A remoção é definitiva no novo PDF, não uma barra sobre o original. Só as páginas com
            zonas marcadas passam a imagem nítida (200 dpi), sem texto por baixo; as restantes ficam
            iguais ao original, com texto pesquisável. O novo PDF não leva os metadados nem os
            anexos do original.
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Página anterior"
                    title="Página anterior"
                    disabled={busy || previewLoading || page === 1}
                    onClick={() => navigate(page - 1)}
                  >
                    <ArrowLeft />
                  </Button>
                  <span className="text-sm tabular-nums">
                    Página {page} de {total}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Página seguinte"
                    title="Página seguinte"
                    disabled={busy || previewLoading || page === total}
                    onClick={() => navigate(page + 1)}
                  >
                    <ArrowRight />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!zones.length || busy}
                  onClick={() => setZones((prev) => prev.slice(0, -1))}
                >
                  <Undo2 /> Desfazer zona
                </Button>
              </div>
              {docs.length > 1 && previewDoc && (
                <p className="truncate text-xs text-muted-foreground">
                  A pré-visualizar:{" "}
                  <span className="font-medium text-foreground">{previewDoc.file.name}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Arrasta sobre a página para marcar uma zona. Cada zona fica na posição proporcional
                da página
                {docs.length > 1 ? " e é aplicada a todos os documentos" : ""}; podes mudar as
                páginas de cada zona na lista ao lado.
              </p>
              <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-border bg-card">
                <div
                  className="relative cursor-crosshair touch-none select-none"
                  aria-label="Pré-visualização para selecionar zonas"
                  onPointerDown={(event) => {
                    if (busy || previewLoading || event.button !== 0) return;
                    start.current = point(event);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraft(null);
                  }}
                  onPointerMove={updateDraft}
                  onPointerUp={(event) => {
                    const rect = updateDraft(event);
                    if (rect && rect.width > 0.003 && rect.height > 0.003) {
                      const scope: ZoneScope =
                        newZoneScope === "all" ? { kind: "all" } : { kind: "page", page };
                      setZones((prev) => [...prev, { ...rect, id: uid("z"), scope }]);
                    }
                    start.current = null;
                    setDraft(null);
                  }}
                  onPointerCancel={() => {
                    start.current = null;
                    setDraft(null);
                  }}
                >
                  {preview && (
                    <img
                      src={preview}
                      alt={`Pré-visualização da página ${page}`}
                      draggable={false}
                      className="block h-auto max-h-[850px] w-auto max-w-full"
                    />
                  )}
                  {zonesOnPage.map((rect) => (
                    <div
                      key={rect.id}
                      className="pointer-events-none absolute border-2 border-destructive bg-destructive/25"
                      style={{
                        left: `${rect.x * 100}%`,
                        top: `${rect.y * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                      }}
                    >
                      <span className="absolute -top-0.5 left-0.5 text-[10px] font-semibold text-destructive">
                        {zones.indexOf(rect) + 1}
                      </span>
                    </div>
                  ))}
                  {draft && (
                    <div
                      className="pointer-events-none absolute border-2 border-dashed border-destructive bg-destructive/15"
                      style={{
                        left: `${draft.x * 100}%`,
                        top: `${draft.y * 100}%`,
                        width: `${draft.width * 100}%`,
                        height: `${draft.height * 100}%`,
                      }}
                    />
                  )}
                  {previewLoading && (
                    <div className="absolute inset-0 grid place-items-center bg-background/80">
                      <Loader2 className="animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              {!zonesOnPage.length && zones.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma zona é aplicada a esta página; ela fica igual ao original.
                </p>
              )}
            </div>

            <aside className="space-y-5">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Documentos</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || loading}
                    onClick={() => addInputRef.current?.click()}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar
                  </Button>
                  <input
                    ref={addInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    hidden
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      void addFiles(files);
                    }}
                  />
                </div>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {docs.map((doc) => (
                    <li
                      key={doc.id}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                        doc.id === previewDocId ? "bg-primary/10" : "hover:bg-white/50"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        disabled={busy || previewLoading}
                        onClick={() => showDoc(doc, page)}
                        title="Pré-visualizar este documento"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{doc.file.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                          {doc.total} pág.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                        aria-label={`Remover ${doc.file.name}`}
                        disabled={busy}
                        onClick={() => removeDoc(doc.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                {docs.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Clica num documento para confirmar que as zonas ficam no sítio certo.
                    {differentLengths &&
                      " Os documentos têm números de páginas diferentes: zonas em páginas que não existem num documento são ignoradas nesse documento."}
                  </p>
                )}
              </section>

              <fieldset disabled={busy} className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Novas zonas aplicam-se a</legend>
                {(
                  [
                    ["page", "Só à página onde as desenho"],
                    ["all", "Todas as páginas"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="new-zone-scope"
                      value={value}
                      checked={newZoneScope === value}
                      onChange={() => setNewZoneScope(value)}
                      className="accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Zonas marcadas{" "}
                  {zones.length > 0 && (
                    <span className="font-normal text-muted-foreground">({zones.length})</span>
                  )}
                </h3>
                {!zones.length && (
                  <p className="text-xs text-muted-foreground">Ainda não marcaste nenhuma zona.</p>
                )}
                <ol className="space-y-2">
                  {zones.map((zone, index) => {
                    const error = zoneErrors.get(zone.id);
                    const selectValue = zone.scope.kind;
                    return (
                      <li
                        key={zone.id}
                        className="space-y-1.5 rounded-lg border border-white/60 bg-white/50 p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-destructive/15 text-[11px] font-semibold text-destructive">
                            {index + 1}
                          </span>
                          <select
                            aria-label={`Páginas da zona ${index + 1}`}
                            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            value={selectValue}
                            disabled={busy}
                            onChange={(e) => {
                              const kind = e.target.value as ZoneScope["kind"];
                              if (kind === "all") updateZoneScope(zone.id, { kind: "all" });
                              else if (kind === "page")
                                updateZoneScope(zone.id, {
                                  kind: "page",
                                  page: zone.scope.kind === "page" ? zone.scope.page : page,
                                });
                              else
                                updateZoneScope(zone.id, {
                                  kind: "pages",
                                  input: zone.scope.kind === "page" ? String(zone.scope.page) : "",
                                });
                            }}
                          >
                            <option value="page">
                              {zone.scope.kind === "page"
                                ? scopeLabel(zone.scope)
                                : `Página ${page}`}
                            </option>
                            <option value="all">Todas as páginas</option>
                            <option value="pages">Páginas específicas…</option>
                          </select>
                          {zone.scope.kind === "page" && zone.scope.page !== page && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={busy || previewLoading || zone.scope.page > total}
                              onClick={() =>
                                zone.scope.kind === "page" && navigate(zone.scope.page)
                              }
                            >
                              Ver
                            </Button>
                          )}
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                            aria-label={`Apagar zona ${index + 1}`}
                            disabled={busy}
                            onClick={() => setZones((prev) => prev.filter((z) => z.id !== zone.id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {zone.scope.kind === "pages" && (
                          <div>
                            <input
                              value={zone.scope.input}
                              onChange={(e) =>
                                updateZoneScope(zone.id, { kind: "pages", input: e.target.value })
                              }
                              placeholder="1, 3, 5-8"
                              aria-label={`Números de páginas da zona ${index + 1}`}
                              aria-invalid={Boolean(error)}
                              disabled={busy}
                              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            />
                            {error && (
                              <p role="alert" className="mt-1 text-xs text-destructive">
                                {error}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>

              <Button
                className="w-full"
                disabled={busy || previewLoading || loading || !zones.length || hasErrors}
                onClick={run}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Eraser />}
                {busy
                  ? "A eliminar…"
                  : docs.length === 1
                    ? "Eliminar informações"
                    : `Eliminar informações (${docs.length} PDFs)`}
              </Button>
              {busy && (
                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                  {progress.files > 1 && `Documento ${progress.file} de ${progress.files} · `}
                  página {Math.min(progress.page + 1, progress.pages)} de {progress.pages}…
                </p>
              )}
              {results && (
                <div className="space-y-3" role="status">
                  <p className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    {results.length === 1 ? "PDF pronto" : `${results.length} PDFs prontos`}
                  </p>
                  <Button onClick={download} className="w-full">
                    <Download /> {results.length === 1 ? "Descarregar PDF" : "Descarregar ZIP"}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Processamento exclusivamente local. Confirma os PDFs descarregados antes de os
                partilhares: dados identificáveis fora das zonas marcadas continuam visíveis e
                pesquisáveis. Esta ferramenta não garante anonimização completa.
              </p>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
