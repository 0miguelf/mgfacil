import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRedactionPlan,
  redactionPixelBounds,
  resolveRedactionPages,
  validateRedactionRects,
  zonePages,
  zoneScopeError,
} from "./redaction-rules";

describe("páginas para remover informações", () => {
  test("primeira aplica apenas à página 1", () => {
    assert.deepEqual(resolveRedactionPages("first", 5), [1]);
  });
  test("todas aplica a cada página", () => {
    assert.deepEqual(resolveRedactionPages("all", 5), [1, 2, 3, 4, 5]);
  });
  test("selecionadas respeita páginas individuais e intervalos", () => {
    assert.deepEqual(resolveRedactionPages("selected", 8, "1, 3, 5-8, 3"), [1, 3, 5, 6, 7, 8]);
  });
  test("rejeita seleção inválida ou fora do documento", () => {
    for (const input of ["", "0", "9", "4-2", "1,", "1.5", "1-10000000"]) {
      assert.throws(() => resolveRedactionPages("selected", 8, input));
    }
  });
});

test("remove também os pixels nas margens da zona escolhida", () => {
  const bounds = redactionPixelBounds({ x: 0.1, y: 0.1, width: 0.5, height: 0.2 }, 1000, 2000);
  assert.equal(bounds.x, 99);
  assert.equal(bounds.y, 199);
  assert.equal(bounds.width, 502);
  assert.ok(bounds.height >= 402 && bounds.height <= 403);
  assert.deepEqual(redactionPixelBounds({ x: 0, y: 0, width: 1, height: 1 }, 100, 200), {
    x: 0,
    y: 0,
    width: 100,
    height: 200,
  });
});

test("exige uma zona real dentro da página", () => {
  assert.throws(() => validateRedactionRects([]));
  assert.throws(() => validateRedactionRects([{ x: 0.9, y: 0, width: 0.2, height: 0.1 }]));
  assert.doesNotThrow(() => validateRedactionRects([{ x: 0, y: 0, width: 1, height: 0.2 }]));
});
describe("zonas por página e vários documentos", () => {
  const rect = { x: 0.1, y: 0.1, width: 0.2, height: 0.1 };
  test("zona numa página aplica-se só a essa página", () => {
    assert.deepEqual(zonePages({ kind: "page", page: 2 }, 5), [2]);
  });
  test("zona numa página que o documento não tem é ignorada", () => {
    assert.deepEqual(zonePages({ kind: "page", page: 4 }, 3), []);
    assert.deepEqual(zonePages({ kind: "pages", input: "2, 4-6" }, 4, 6), [2, 4]);
  });
  test("plano junta zonas diferentes em páginas diferentes", () => {
    const plan = buildRedactionPlan(
      [
        { ...rect, id: "a", scope: { kind: "page", page: 2 } },
        { ...rect, x: 0.5, id: "b", scope: { kind: "page", page: 3 } },
        { ...rect, y: 0.8, id: "c", scope: { kind: "all" } },
      ],
      4,
    );
    assert.deepEqual([...plan.keys()].sort(), [1, 2, 3, 4]);
    assert.equal(plan.get(1)!.length, 1);
    assert.equal(plan.get(2)!.length, 2);
    assert.equal(plan.get(3)![0].x, 0.5);
  });
  test("páginas sem zonas ficam fora do plano", () => {
    const plan = buildRedactionPlan([{ ...rect, id: "a", scope: { kind: "page", page: 1 } }], 10);
    assert.deepEqual([...plan.keys()], [1]);
  });
  test("lista de páginas inválida dá erro legível", () => {
    assert.equal(zoneScopeError({ kind: "pages", input: "2-1" }, 5) !== null, true);
    assert.equal(zoneScopeError({ kind: "pages", input: "1,3" }, 5), null);
    assert.equal(zoneScopeError({ kind: "all" }, 5), null);
  });
});
