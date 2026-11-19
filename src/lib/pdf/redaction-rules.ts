/** Rectangles are fractions of the displayed (rotated/cropped) page, from its top-left. */
export type RedactionRect = { x: number; y: number; width: number; height: number };
export type PageScope = "first" | "all" | "selected";

/** Which pages a zone applies to. Page numbers are the same in every loaded document. */
export type ZoneScope =
  { kind: "page"; page: number } | { kind: "all" } | { kind: "pages"; input: string };

export type RedactionZone = RedactionRect & { id: string; scope: ZoneScope };

/** Page number -> zones to remove on that page. Pages not in the map are kept as they are. */
export type RedactionPlan = Map<number, RedactionRect[]>;

/** Parse "1, 3, 5-8" into sorted unique page numbers between 1 and `max`. */
export function parsePageList(input: string, max: number): number[] {
  if (!Number.isInteger(max) || max < 1) throw new Error("O PDF não contém páginas.");
  const pages = new Set<number>();
  for (const part of input.split(",")) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim());
    if (!match) throw new Error("Indique páginas como 1, 3, 5-8.");
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > max) {
      throw new Error(`As páginas devem estar entre 1 e ${max}, em intervalos crescentes.`);
    }
    for (let page = start; page <= end; page++) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

export function resolveRedactionPages(scope: PageScope, total: number, input = ""): number[] {
  if (!Number.isInteger(total) || total < 1) throw new Error("O PDF não contém páginas.");
  if (scope === "first") return [1];
  if (scope === "all") return Array.from({ length: total }, (_, i) => i + 1);
  return parsePageList(input, total);
}

/**
 * Validate a zone's page selection against the longest loaded document.
 * Returns an error message, or null when valid.
 */
export function zoneScopeError(scope: ZoneScope, maxPages: number): string | null {
  if (scope.kind !== "pages") return null;
  try {
    parsePageList(scope.input, maxPages);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Seleção inválida.";
  }
}

/**
 * Pages of a document with `total` pages that a zone applies to. Pages beyond the
 * document's length are ignored, so the same zones work for documents of different sizes.
 * `maxPages` is the longest loaded document, used to validate the typed page list.
 */
export function zonePages(scope: ZoneScope, total: number, maxPages = total): number[] {
  if (scope.kind === "all") return Array.from({ length: total }, (_, i) => i + 1);
  if (scope.kind === "page") return scope.page >= 1 && scope.page <= total ? [scope.page] : [];
  return parsePageList(scope.input, Math.max(maxPages, total)).filter((p) => p <= total);
}

/** Group zones by page for one document. Throws if any zone has an invalid page list. */
export function buildRedactionPlan(
  zones: RedactionZone[],
  total: number,
  maxPages = total,
): RedactionPlan {
  const plan: RedactionPlan = new Map();
  for (const zone of zones) {
    const { x, y, width, height } = zone;
    for (const page of zonePages(zone.scope, total, maxPages)) {
      const list = plan.get(page) ?? [];
      list.push({ x, y, width, height });
      plan.set(page, list);
    }
  }
  return plan;
}

export function validateRedactionRects(rects: RedactionRect[]) {
  if (!rects.length) throw new Error("Selecione pelo menos uma zona a eliminar.");
  for (const rect of rects) {
    if (
      !Object.values(rect).every(Number.isFinite) ||
      rect.x < 0 ||
      rect.y < 0 ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.x + rect.width > 1.000001 ||
      rect.y + rect.height > 1.000001
    ) {
      throw new Error("A zona selecionada deve estar dentro da página.");
    }
  }
}

/** Round outward, with a one-pixel safety margin, to remove boundary antialiasing too. */
export function redactionPixelBounds(rect: RedactionRect, width: number, height: number) {
  const x = Math.max(0, Math.floor(rect.x * width) - 1);
  const y = Math.max(0, Math.floor(rect.y * height) - 1);
  return {
    x,
    y,
    width: Math.min(width, Math.ceil((rect.x + rect.width) * width) + 1) - x,
    height: Math.min(height, Math.ceil((rect.y + rect.height) * height) + 1) - y,
  };
}
