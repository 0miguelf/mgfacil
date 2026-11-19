import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFStream,
  popGraphicsState,
  pushGraphicsState,
  concatTransformationMatrix,
  drawObject,
  type PDFDocument,
  type PDFObject,
  type PDFPage,
} from "@cantoo/pdf-lib";

type Box = [number, number, number, number];
type Matrix = [number, number, number, number, number, number];

/**
 * Annotation types whose appearance is part of what the reader sees on the page, and is
 * therefore kept (drawn into the page content). Everything else (comments' hidden text,
 * popups, links, attachments, media, actions) is dropped.
 */
const VISIBLE_SUBTYPES = new Set([
  "Widget", // filled-in form fields
  "FreeText",
  "Stamp",
  "Square",
  "Circle",
  "Line",
  "Polygon",
  "PolyLine",
  "Highlight",
  "Underline",
  "Squiggly",
  "StrikeOut",
  "Ink",
  "Caret",
  "Watermark",
]);

const FLAG_HIDDEN = 1 << 1;
const FLAG_NO_VIEW = 1 << 5;

/**
 * Matrix that places an appearance stream on its annotation rectangle (PDF 32000-1,
 * 12.5.5): the appearance's BBox, transformed by its own Matrix, is scaled and moved
 * to fill Rect. The appearance's Matrix itself is applied by the `Do` operator.
 */
export function appearanceMatrix(rect: Box, bbox: Box, matrix: Matrix): Matrix {
  const [a, b, c, d, e, f] = matrix;
  const corners = [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[1]],
    [bbox[0], bbox[3]],
    [bbox[2], bbox[3]],
  ].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const bx = Math.min(...xs);
  const by = Math.min(...ys);
  const bw = Math.max(...xs) - bx;
  const bh = Math.max(...ys) - by;

  const rx = Math.min(rect[0], rect[2]);
  const ry = Math.min(rect[1], rect[3]);
  const rw = Math.abs(rect[2] - rect[0]);
  const rh = Math.abs(rect[3] - rect[1]);

  const sx = bw > 0 ? rw / bw : 1;
  const sy = bh > 0 ? rh / bh : 1;
  return [sx, 0, 0, sy, rx - bx * sx, ry - by * sy];
}

/**
 * Generate appearances for form fields that only store their value (common in PDFs
 * filled in some viewers), so the value is not lost when the field is flattened.
 * Changes only the source document in memory; failures leave the existing appearances.
 */
export function prepareFormAppearances(doc: PDFDocument): void {
  try {
    doc.getForm().updateFieldAppearances();
  } catch (err) {
    console.warn("Não foi possível atualizar a aparência dos campos do formulário.", err);
  }
}

function numbers(value: unknown, length: number): number[] | null {
  if (!(value instanceof PDFArray) || value.size() !== length) return null;
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const item = value.get(i);
    if (!(item instanceof PDFNumber)) return null;
    out.push(item.asNumber());
  }
  return out;
}

/** The normal appearance stream the reader currently shows for an annotation. */
function normalAppearance(doc: PDFDocument, annot: PDFDict): PDFRef | null {
  const ap = annot.lookupMaybe(PDFName.of("AP"), PDFDict);
  const n = ap?.get(PDFName.of("N"));
  if (!(n instanceof PDFRef)) {
    // A dictionary of states (check boxes, radio buttons): pick the current one.
    const states = n instanceof PDFDict ? n : null;
    const state = annot.lookupMaybe(PDFName.of("AS"), PDFName);
    const ref = states && state ? states.get(state) : undefined;
    return ref instanceof PDFRef ? ref : null;
  }
  const target = doc.context.lookup(n);
  if (target instanceof PDFStream) return n;
  if (target instanceof PDFDict) {
    const state = annot.lookupMaybe(PDFName.of("AS"), PDFName);
    const ref = state ? target.get(state) : undefined;
    return ref instanceof PDFRef ? ref : null;
  }
  return null;
}

/**
 * Draw the visible annotations of a page into its content and remove all annotations
 * and page actions. Filled-in form fields, stamps, text boxes and markups stay visible
 * exactly as before; hidden comments, popups, links and scripts are gone.
 */
export function flattenPageAnnotations(doc: PDFDocument, page: PDFPage): void {
  const node = page.node;
  node.delete(PDFName.of("AA"));
  const annots = node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annots) return;

  let counter = 0;
  for (let i = 0; i < annots.size(); i++) {
    const annot = annots.lookupMaybe(i, PDFDict);
    if (!annot) continue;
    const subtype = annot.lookupMaybe(PDFName.of("Subtype"), PDFName)?.decodeText();
    if (!subtype || !VISIBLE_SUBTYPES.has(subtype)) continue;
    const flags = annot.lookupMaybe(PDFName.of("F"), PDFNumber)?.asNumber() ?? 0;
    if (flags & (FLAG_HIDDEN | FLAG_NO_VIEW)) continue;

    const rect = numbers(annot.lookup(PDFName.of("Rect")), 4);
    const appearanceRef = normalAppearance(doc, annot);
    if (!rect || !appearanceRef) continue;
    const stream = doc.context.lookup(appearanceRef, PDFStream);
    const bbox = numbers(stream.dict.lookup(PDFName.of("BBox")), 4);
    if (!bbox) continue;
    const matrix = numbers(stream.dict.lookup(PDFName.of("Matrix")), 6) ?? [1, 0, 0, 1, 0, 0];

    // pdf-lib registers the XObject under a unique key derived from this tag.
    const key = node.newXObject(`MGFlat${counter++}_`, appearanceRef);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(...appearanceMatrix(rect as Box, bbox as Box, matrix as Matrix)),
      drawObject(key),
      popGraphicsState(),
    );
  }
  node.delete(PDFName.of("Annots"));
}

/**
 * Delete every object that the document no longer references. Removing an annotation
 * from a page leaves its objects (comment text, actions, popups) in the file, and
 * pdf-lib would still write them out.
 */
export function removeUnreachableObjects(doc: PDFDocument): void {
  const ctx = doc.context;
  const reachable = new Set<string>();
  const pending: PDFObject[] = [];
  const { Root, Info } = ctx.trailerInfo;
  for (const root of [Root, Info]) if (root) pending.push(root);

  while (pending.length) {
    const obj = pending.pop()!;
    if (obj instanceof PDFRef) {
      const tag = obj.tag;
      if (reachable.has(tag)) continue;
      reachable.add(tag);
      const target = ctx.lookup(obj);
      if (target) pending.push(target);
    } else if (obj instanceof PDFDict) {
      for (const [, value] of obj.entries()) pending.push(value);
    } else if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) pending.push(obj.get(i));
    } else if (obj instanceof PDFStream) {
      pending.push(obj.dict);
    }
  }

  for (const [ref] of ctx.enumerateIndirectObjects()) {
    if (!reachable.has(ref.tag)) ctx.delete(ref);
  }
}
