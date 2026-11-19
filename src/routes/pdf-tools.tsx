import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Download,
  Trash2,
  Loader2,
  RotateCw,
  Package,
  Plus,
  FileText,
  Merge,
  Scissors,
  Minimize2,
  X,
  GripVertical,
  Eraser,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

import { AppShell, PrivacyBanner } from "../components/AppShell";
import { DropZone } from "../components/DropZone";
import { PdfRedactionTab } from "../components/PdfRedactionTab";
import { Button } from "../components/ui/button";
import { formatBytes, sanitizeFileName, uniqueFileName } from "../lib/format";
import { loadPdf, renderThumbnail } from "../lib/pdf/pdfjs";
import {
  buildFromPages,
  compressPdfAdaptive,
  mergePdfs,
  type CompressProgress,
  type PageRef,
} from "../lib/pdf/ops";

export const Route = createFileRoute("/pdf-tools")({
  head: () => ({
    meta: [
      { title: "Ferramentas de PDF — MGFácil" },
      {
        name: "description",
        content:
          "Juntar, editar, comprimir e remover informações de PDFs, exclusivamente no seu dispositivo.",
      },
      { property: "og:title", content: "Ferramentas de PDF — MGFácil" },
      { property: "og:description", content: "Juntar, editar, comprimir e remover informações de PDFs, exclusivamente no seu dispositivo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PdfToolsPage,
});

type Tab = "merge" | "edit" | "compress" | "redact";

function PdfToolsPage() {
  const [tab, setTab] = useState<Tab>("merge");

  return (
    <AppShell title="Ferramentas de PDF" subtitle="Juntar, editar, comprimir e remover informações localmente">
      <div className="space-y-6">
        <PrivacyBanner />

        <div
          role="tablist"
          aria-label="Ferramentas de PDF"
          className="glass inline-flex w-full flex-wrap gap-1 rounded-full p-1 sm:w-auto"
        >
          <TabButton current={tab} value="merge" onClick={setTab} icon={Merge}>
            Juntar
          </TabButton>
          <TabButton current={tab} value="edit" onClick={setTab} icon={Scissors}>
            Editar / Dividir
          </TabButton>
          <TabButton current={tab} value="compress" onClick={setTab} icon={Minimize2}>
            Comprimir
          </TabButton>
          <TabButton current={tab} value="redact" onClick={setTab} icon={Eraser}>
            Remover informações
          </TabButton>
        </div>

        {/* Todos os separadores ficam montados para não perder os ficheiros carregados */}
        <div hidden={tab !== "merge"}>
          <MergeTab />
        </div>
        <div hidden={tab !== "edit"}>
          <EditTab />
        </div>
        <div hidden={tab !== "compress"}>
          <CompressTab />
        </div>
        <div hidden={tab !== "redact"}>
          <PdfRedactionTab />
        </div>
      </div>
    </AppShell>
  );
}

function TabButton({
  current,
  value,
  onClick,
  icon: Icon,
  children,
}: {
  current: Tab;
  value: Tab;
  onClick: (v: Tab) => void;
  icon: typeof Merge;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Button
      variant="ghost"
      role="tab"
      aria-selected={active}
      onClick={() => onClick(value)}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/70 hover:bg-background/60 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Button>
  );
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues with Blob
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/* -------------------------------- MERGE TAB ------------------------------- */

type MergeItem = { id: string; file: File };

function MergeTab() {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("juncao.pdf");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addFiles = useCallback((files: File[]) => {
    const next = files
      .filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
      .map((f) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file: f }));
    setItems((prev) => [...prev, ...next]);
  }, []);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const doMerge = async () => {
    if (items.length < 2) {
      toast.info("Carregue pelo menos dois PDFs para juntar.");
      return;
    }
    setBusy(true);
    try {
      const bytes = await mergePdfs(items.map((i) => i.file));
      downloadBytes(
        bytes,
        (name.trim().replace(/\.pdf$/i, "") || "juncao") + ".pdf",
      );
      toast.success("PDFs juntos com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro a juntar PDFs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <DropZone
        onFiles={addFiles}
        accept={{ "application/pdf": [".pdf"] }}
        hint="Adicione dois ou mais PDFs. Arraste para reordenar."
      />
      {items.length > 0 && (
        <div className="glass rounded-3xl p-4 sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
            <div className="min-w-0 flex items-center gap-2">
              <label htmlFor="merge-name" className="text-sm font-medium text-foreground">
                Nome:
              </label>
              <input
                id="merge-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 rounded-full border border-border bg-white/70 px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setItems([])}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-white/90 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Limpar
              </button>
              <button
                onClick={doMerge}
                disabled={busy || items.length < 2}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                Juntar e descarregar
              </button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
              <ul className="mt-4 grid gap-2">
                {items.map((it, idx) => (
                  <MergeRow
                    key={it.id}
                    id={it.id}
                    index={idx}
                    file={it.file}
                    onRemove={() =>
                      setItems((prev) => prev.filter((p) => p.id !== it.id))
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function MergeRow({
  id,
  index,
  file,
  onRemove,
}: {
  id: string;
  index: number;
  file: File;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="glass-strong grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/60"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {index + 1}. {file.name}
        </p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <button
        onClick={onRemove}
        className="grid h-8 w-8 place-items-center rounded-full border border-border bg-white/60 text-muted-foreground hover:bg-white hover:text-foreground"
        aria-label="Remover"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/* --------------------------------- EDIT TAB ------------------------------- */

type EditPage = {
  id: string;
  sourcePage: number; // 1-indexed
  rotation: 0 | 90 | 180 | 270;
  thumb: string;
  selected: boolean;
};

type Group = {
  id: string;
  name: string;
  pageIds: string[];
};

function EditTab() {
  const [file, setFile] = useState<File | null>(null);
  const sourceBytesRef = useRef<Uint8Array | null>(null);
  const [pages, setPages] = useState<Record<string, EditPage>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadFile = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setLoading(true);
    setFile(f);
    setPages({});
    setGroups([]);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      sourceBytesRef.current = bytes;
      const pdf = await loadPdf(bytes.buffer);
      const total = pdf.numPages;
      const nextPages: Record<string, EditPage> = {};
      const ids: string[] = [];
      for (let i = 1; i <= total; i++) {
        const { dataUrl } = await renderThumbnail(pdf, i, 200);
        const id = `p${i}`;
        ids.push(id);
        nextPages[id] = {
          id,
          sourcePage: i,
          rotation: 0,
          thumb: dataUrl,
          selected: false,
        };
      }
      setPages(nextPages);
      setGroups([
        {
          id: "g1",
          name: sanitizeFileName(f.name, "documento") + "-editado",
          pageIds: ids,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o PDF.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectedIds = useMemo(
    () => Object.values(pages).filter((p) => p.selected).map((p) => p.id),
    [pages],
  );

  const toggleSelect = (id: string) =>
    setPages((prev) => ({ ...prev, [id]: { ...prev[id], selected: !prev[id].selected } }));

  const rotatePage = (id: string) =>
    setPages((prev) => ({
      ...prev,
      [id]: { ...prev[id], rotation: ((prev[id].rotation + 90) % 360) as 0 | 90 | 180 | 270 },
    }));

  const removePage = (id: string) => {
    setGroups((prev) =>
      prev.map((g) => ({ ...g, pageIds: g.pageIds.filter((pid) => pid !== id) })),
    );
    setPages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const rotateSelected = () => {
    if (selectedIds.length === 0) return;
    setPages((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) {
        next[id] = {
          ...next[id],
          rotation: ((next[id].rotation + 90) % 360) as 0 | 90 | 180 | 270,
        };
      }
      return next;
    });
  };

  const removeSelected = () => {
    if (selectedIds.length === 0) return;
    setGroups((prev) =>
      prev.map((g) => ({ ...g, pageIds: g.pageIds.filter((pid) => !selectedIds.includes(pid)) })),
    );
    setPages((prev) => {
      const next: Record<string, EditPage> = {};
      for (const id in prev) if (!selectedIds.includes(id)) next[id] = prev[id];
      return next;
    });
  };

  const clearSelection = () =>
    setPages((prev) => {
      const next = { ...prev };
      for (const id in next) if (next[id].selected) next[id] = { ...next[id], selected: false };
      return next;
    });

  const moveSelectedToGroup = (groupId: string) => {
    if (selectedIds.length === 0) return;
    setGroups((prev) => {
      const withoutSel = prev.map((g) => ({
        ...g,
        pageIds: g.pageIds.filter((pid) => !selectedIds.includes(pid)),
      }));
      return withoutSel.map((g) =>
        g.id === groupId ? { ...g, pageIds: [...g.pageIds, ...selectedIds] } : g,
      );
    });
    clearSelection();
  };

  const addGroup = () => {
    const id = `g${Date.now().toString(36)}`;
    setGroups((prev) => [
      ...prev,
      { id, name: `documento-${prev.length + 1}`, pageIds: [] },
    ]);
  };

  const renameGroup = (id: string, name: string) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));

  const removeGroup = (id: string) => {
    setGroups((prev) => {
      if (prev.length <= 1) return prev;
      const target = prev.find((g) => g.id === id);
      const rest = prev.filter((g) => g.id !== id);
      if (target && target.pageIds.length && rest[0]) {
        rest[0] = { ...rest[0], pageIds: [...rest[0].pageIds, ...target.pageIds] };
      }
      return rest;
    });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    setGroups((prev) => {
      const activeGroupIdx = prev.findIndex((g) => g.pageIds.includes(activeIdStr));
      if (activeGroupIdx === -1) return prev;

      // over could be a page id or a group id (droppable)
      let overGroupIdx = prev.findIndex((g) => g.id === overIdStr);
      let insertIndex = -1;
      if (overGroupIdx === -1) {
        overGroupIdx = prev.findIndex((g) => g.pageIds.includes(overIdStr));
        if (overGroupIdx === -1) return prev;
        insertIndex = prev[overGroupIdx].pageIds.indexOf(overIdStr);
      }

      if (activeGroupIdx === overGroupIdx) {
        const g = prev[activeGroupIdx];
        const oldIndex = g.pageIds.indexOf(activeIdStr);
        const newIndex = insertIndex === -1 ? g.pageIds.length - 1 : insertIndex;
        const nextIds = arrayMove(g.pageIds, oldIndex, newIndex);
        const next = [...prev];
        next[activeGroupIdx] = { ...g, pageIds: nextIds };
        return next;
      }

      // Move between groups
      const next = prev.map((g) => ({ ...g, pageIds: [...g.pageIds] }));
      next[activeGroupIdx].pageIds = next[activeGroupIdx].pageIds.filter(
        (id) => id !== activeIdStr,
      );
      if (insertIndex === -1) {
        next[overGroupIdx].pageIds.push(activeIdStr);
      } else {
        next[overGroupIdx].pageIds.splice(insertIndex, 0, activeIdStr);
      }
      return next;
    });
  };

  const buildRefsForGroup = (group: Group): PageRef[] =>
    group.pageIds
      .map((pid) => pages[pid])
      .filter(Boolean)
      .map((p) => ({ page: p.sourcePage, rotation: p.rotation }));

  const exportOne = async (group: Group) => {
    if (!sourceBytesRef.current) return;
    if (group.pageIds.length === 0) {
      toast.info("O grupo está vazio.");
      return;
    }
    setBusy(true);
    try {
      const refs = buildRefsForGroup(group);
      const bytes = await buildFromPages(sourceBytesRef.current, refs);
      downloadBytes(bytes, (group.name.replace(/\.pdf$/i, "") || "documento") + ".pdf");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro a exportar.");
    } finally {
      setBusy(false);
    }
  };

  const exportAllZip = async () => {
    if (!sourceBytesRef.current) return;
    const usable = groups.filter((g) => g.pageIds.length > 0);
    if (usable.length === 0) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      for (const g of usable) {
        const bytes = await buildFromPages(sourceBytesRef.current, buildRefsForGroup(g));
        const ab = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(ab).set(bytes);
        zip.file(
          uniqueFileName((g.name.replace(/\.pdf$/i, "") || "documento") + ".pdf", used),
          new Blob([ab], { type: "application/pdf" }),
        );
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pdfs.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      toast.success("Exportação concluída.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro a exportar.");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Object.keys(pages).length;
  const activePage = activeId ? pages[activeId] : null;

  return (
    <div className="space-y-4">
      {!file && (
        <DropZone
          onFiles={loadFile}
          accept={{ "application/pdf": [".pdf"] }}
          multiple={false}
          hint="Carregue um PDF para dividir, reorganizar, rodar ou eliminar páginas."
        />
      )}

      {loading && (
        <div className="glass flex items-center gap-3 rounded-2xl p-4 text-sm text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />A gerar miniaturas do PDF…
        </div>
      )}

      {file && !loading && (
        <>
          <div className="glass grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-4 sm:flex sm:flex-wrap sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {totalPages} páginas · {formatBytes(file.size)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={() => {
                  setFile(null);
                  setPages({});
                  setGroups([]);
                  sourceBytesRef.current = null;
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-white/90"
              >
                <Trash2 className="h-4 w-4" /> Fechar
              </button>
              <button
                onClick={addGroup}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-white/90"
              >
                <Plus className="h-4 w-4" /> Novo grupo
              </button>
              {groups.filter((g) => g.pageIds.length > 0).length > 1 && (
                <button
                  onClick={exportAllZip}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  Exportar todos (ZIP)
                </button>
              )}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="glass-strong flex flex-wrap items-center gap-2 rounded-2xl p-3">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.length} selecionada(s)
              </span>
              <button
                onClick={rotateSelected}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-white/70 px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-white"
              >
                <RotateCw className="h-3 w-3" /> Rodar 90°
              </button>
              <button
                onClick={removeSelected}
                className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50/80 px-2.5 py-1 text-xs font-medium text-red-800 transition hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" /> Eliminar
              </button>
              {groups.length > 1 &&
                groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => moveSelectedToGroup(g.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-white/70 px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-white"
                  >
                    → {g.name || "grupo"}
                  </button>
                ))}
              <button
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Limpar seleção
              </button>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="space-y-4">
              {groups.map((group) => (
                <GroupContainer
                  key={group.id}
                  group={group}
                  pages={pages}
                  canRemove={groups.length > 1}
                  onRename={(name) => renameGroup(group.id, name)}
                  onRemoveGroup={() => removeGroup(group.id)}
                  onExport={() => exportOne(group)}
                  onToggleSelect={toggleSelect}
                  onRotate={rotatePage}
                  onRemovePage={removePage}
                  busy={busy}
                />
              ))}
            </div>
            <DragOverlay>
              {activePage ? (
                <div className="w-[140px] rotate-3 rounded-xl border border-white/70 bg-white shadow-2xl">
                  <img
                    src={activePage.thumb}
                    alt=""
                    className="w-full rounded-xl"
                    style={{ transform: `rotate(${activePage.rotation}deg)` }}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </div>
  );
}

function GroupContainer({
  group,
  pages,
  canRemove,
  onRename,
  onRemoveGroup,
  onExport,
  onToggleSelect,
  onRotate,
  onRemovePage,
  busy,
}: {
  group: Group;
  pages: Record<string, EditPage>;
  canRemove: boolean;
  onRename: (v: string) => void;
  onRemoveGroup: () => void;
  onExport: () => void;
  onToggleSelect: (id: string) => void;
  onRotate: (id: string) => void;
  onRemovePage: (id: string) => void;
  busy: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });
  return (
    <div
      ref={setNodeRef}
      className={`glass rounded-3xl p-4 sm:p-6 ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <input
            value={group.name}
            onChange={(e) => onRename(e.target.value)}
            className="min-w-0 flex-1 rounded-full border border-border bg-white/70 px-3 py-1.5 text-sm outline-none focus:border-primary"
            aria-label="Nome do documento"
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {group.pageIds.length} pág.
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {canRemove && (
            <button
              onClick={onRemoveGroup}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-white/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/90"
            >
              <X className="h-3.5 w-3.5" /> Remover grupo
            </button>
          )}
          <button
            onClick={onExport}
            disabled={busy || group.pageIds.length === 0}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Guardar PDF
          </button>
        </div>
      </div>

      <SortableContext items={group.pageIds} strategy={rectSortingStrategy}>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {group.pageIds.length === 0 && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-white/70 p-8 text-center text-sm text-muted-foreground">
              Arraste páginas para este grupo.
            </div>
          )}
          {group.pageIds.map((pid) => {
            const p = pages[pid];
            if (!p) return null;
            return (
              <PageCard
                key={p.id}
                page={p}
                onToggle={() => onToggleSelect(p.id)}
                onRotate={() => onRotate(p.id)}
                onRemove={() => onRemovePage(p.id)}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}

function PageCard({
  page,
  onToggle,
  onRotate,
  onRemove,
}: {
  page: EditPage;
  onToggle: () => void;
  onRotate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-strong group relative overflow-hidden rounded-2xl p-2 transition ${
        page.selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="block w-full"
        aria-label={`Selecionar página ${page.sourcePage}`}
      >
        <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl bg-white/70">
          <img
            src={page.thumb}
            alt={`Página ${page.sourcePage}`}
            className="max-h-full max-w-full transition"
            style={{ transform: `rotate(${page.rotation}deg)` }}
          />
        </div>
      </button>
      <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>Pág. {page.sourcePage}</span>
        <div className="flex gap-1">
          <button
            {...attributes}
            {...listeners}
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-white/70"
            aria-label="Arrastar"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <button
            onClick={onRotate}
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-white/70"
            aria-label="Rodar página"
          >
            <RotateCw className="h-3 w-3" />
          </button>
          <button
            onClick={onRemove}
            className="grid h-6 w-6 place-items-center rounded-full text-red-700 hover:bg-red-50"
            aria-label="Eliminar página"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ COMPRESS TAB ------------------------------ */

function CompressTab() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CompressProgress | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; originalSize: number } | null>(null);

  const onFiles = (files: File[]) => {
    setFile(files[0] ?? null);
    setResult(null);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setProgress({ phase: "analyze", done: 0, total: 0 });
    try {
      const bytes = await compressPdfAdaptive(file, (p) => setProgress(p));
      setResult({ bytes, originalSize: file.size });
      if (bytes.byteLength < 5 * 1024 * 1024) {
        toast.success("Compressão concluída. Ficheiro abaixo de 5 MB.");
      } else {
        toast.success("Compressão concluída no nível máximo possível.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro a comprimir.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const download = () => {
    if (!result || !file) return;
    downloadBytes(
      result.bytes,
      sanitizeFileName(file.name, "documento") + "-comprimido.pdf",
    );
  };

  const reduction =
    result && file
      ? Math.max(0, Math.round(((file.size - result.bytes.byteLength) / file.size) * 100))
      : null;

  return (
    <div className="space-y-4">
      {!file && (
        <DropZone
          onFiles={onFiles}
          accept={{ "application/pdf": [".pdf"] }}
          multiple={false}
          hint="Carregue um PDF para reduzir o tamanho do ficheiro."
        />
      )}

      {file && (
        <div className="glass rounded-3xl p-4 sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                Tamanho original: {formatBytes(file.size)}
              </p>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-white/90"
            >
              <X className="h-4 w-4" /> Escolher outro
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={run}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
              {busy ? "A reduzir…" : "Reduzir tamanho"}
            </button>
            {progress && (
              <span className="text-xs text-muted-foreground">
                {progress.phase === "analyze"
                  ? "A analisar o documento…"
                  : progress.phase === "finalize"
                    ? "A finalizar…"
                    : `Página ${progress.done} de ${progress.total}`}
              </span>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            A ferramenta analisa primeiro o documento e escolhe de uma só vez a melhor
            resolução possível que mantém o ficheiro abaixo de 5 MB — sem repetir o
            processo várias vezes. As páginas passam a ser imagens, pelo que o texto
            deixa de ser selecionável.
          </p>

          {result && reduction !== null && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatCard label="Original" value={formatBytes(result.originalSize)} />
              <StatCard label="Final" value={formatBytes(result.bytes.byteLength)} />
              <StatCard
                label="Redução"
                value={`${reduction}%`}
                tone={reduction > 0 ? "success" : "muted"}
              />
              <div className="sm:col-span-3">
                <button
                  onClick={download}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:w-auto"
                >
                  <Download className="h-4 w-4" /> Descarregar PDF reduzido
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="glass-strong rounded-2xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
