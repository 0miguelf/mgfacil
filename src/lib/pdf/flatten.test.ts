import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
  PDFName,
  PDFString,
  StandardFonts,
  type PDFPage,
} from "@cantoo/pdf-lib";
import {
  appearanceMatrix,
  flattenPageAnnotations,
  prepareFormAppearances,
  removeUnreachableObjects,
} from "./flatten";

describe("appearanceMatrix", () => {
  test("maps a bounding box at the origin onto the annotation rectangle", () => {
    assert.deepEqual(
      appearanceMatrix([100, 200, 300, 250], [0, 0, 200, 50], [1, 0, 0, 1, 0, 0]),
      [1, 0, 0, 1, 100, 200],
    );
  });

  test("scales and offsets a bounding box that differs from the rectangle", () => {
    assert.deepEqual(
      appearanceMatrix([10, 20, 110, 70], [5, 5, 55, 30], [1, 0, 0, 1, 0, 0]),
      [2, 0, 0, 2, 0, 10],
    );
  });

  test("uses the box after the appearance's own matrix (e.g. rotated 90°)", () => {
    // BBox 0..100 x 0..20 rotated 90° becomes x -20..0, y 0..100
    assert.deepEqual(
      appearanceMatrix([0, 0, 20, 100], [0, 0, 100, 20], [0, 1, -1, 0, 0, 0]),
      [1, 0, 0, 1, 20, 0],
    );
  });

  test("normalises rectangles given with corners in any order", () => {
    assert.deepEqual(
      appearanceMatrix([300, 250, 100, 200], [0, 0, 200, 50], [1, 0, 0, 1, 0, 0]),
      [1, 0, 0, 1, 100, 200],
    );
  });
});

/** A page with a filled form field, a hidden comment, a JavaScript link and a page action. */
async function pageWithAnnotations() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Relatorio", { x: 50, y: 800, size: 12, font });

  const field = doc.getForm().createTextField("nome");
  field.setText("VALOR-DO-CAMPO");
  field.addToPage(page, { x: 50, y: 700, width: 200, height: 24, font });

  const ctx = doc.context;
  const comment = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [50, 600, 70, 620],
      Contents: PDFString.of("COMENTARIO-ESCONDIDO"),
    }),
  );
  const link = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [50, 500, 150, 520],
      A: { S: "JavaScript", JS: PDFString.of("app.alert('ACAO-JS')") },
    }),
  );
  page.node.addAnnot(comment);
  page.node.addAnnot(link);
  page.node.set(
    PDFName.of("AA"),
    ctx.obj({ O: { S: "JavaScript", JS: PDFString.of("ACAO-PAGINA") } }),
  );
  return { doc, page };
}

async function copyLikeRedaction(doc: PDFDocument): Promise<{ out: PDFDocument; page: PDFPage }> {
  prepareFormAppearances(doc);
  const out = await PDFDocument.create();
  const [page] = await out.copyPages(doc, [0]);
  out.addPage(page);
  flattenPageAnnotations(out, page);
  removeUnreachableObjects(out);
  return { out, page };
}

/** Everything a PDF reader could find in the saved file, with streams decompressed. */
async function savedText(doc: PDFDocument): Promise<string> {
  const bytes = await doc.save({ useObjectStreams: false });
  const reloaded = await PDFDocument.load(bytes);
  let text = Buffer.from(bytes).toString("latin1");
  for (const [, obj] of reloaded.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      text += Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1");
    }
  }
  return text;
}

describe("flattenPageAnnotations", () => {
  test("removes every annotation and page action", async () => {
    const { doc } = await pageWithAnnotations();
    const { page } = await copyLikeRedaction(doc);
    assert.equal(page.node.lookupMaybe(PDFName.of("Annots"), PDFArray), undefined);
    assert.equal(page.node.get(PDFName.of("AA")), undefined);
  });

  test("drops hidden comments and scripts from the saved file", async () => {
    const { doc } = await pageWithAnnotations();
    const { out } = await copyLikeRedaction(doc);
    const saved = await savedText(out);
    assert.ok(!saved.includes("COMENTARIO-ESCONDIDO"));
    assert.ok(!saved.includes("ACAO-JS"));
    assert.ok(!saved.includes("ACAO-PAGINA"));
  });

  test("keeps the filled-in field value drawn on the page", async () => {
    const { doc } = await pageWithAnnotations();
    const { out } = await copyLikeRedaction(doc);
    const saved = await savedText(out);
    // pdf-lib writes the field text as a hex string in the appearance stream
    const hex = Buffer.from("VALOR-DO-CAMPO", "latin1").toString("hex").toUpperCase();
    assert.ok(saved.includes(`<${hex}>`) || saved.includes("(VALOR-DO-CAMPO)"));
    // ...and that appearance is now painted by the page content, not by an annotation
    assert.match(saved, /\/MGFlat\d+_-?\d+ Do/);
  });

  test("leaves pages without annotations untouched", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]).drawText("x");
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(doc, [0]);
    out.addPage(page);
    const before = page.node.Contents();
    flattenPageAnnotations(out, page);
    assert.equal(page.node.Contents(), before);
  });
});
