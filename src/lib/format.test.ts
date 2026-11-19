import { test } from "node:test";
import assert from "node:assert/strict";
import { uniqueFileName } from "./format";

test("keeps the first name and numbers repeats before the extension", () => {
  const used = new Set<string>();
  assert.equal(uniqueFileName("foto.jpg", used), "foto.jpg");
  assert.equal(uniqueFileName("foto.jpg", used), "foto-2.jpg");
  assert.equal(uniqueFileName("foto.jpg", used), "foto-3.jpg");
  assert.equal(uniqueFileName("outra.jpg", used), "outra.jpg");
});

test("does not reuse a name that already exists as a numbered one", () => {
  const used = new Set<string>();
  assert.equal(uniqueFileName("foto-2.jpg", used), "foto-2.jpg");
  assert.equal(uniqueFileName("foto.jpg", used), "foto.jpg");
  assert.equal(uniqueFileName("foto.jpg", used), "foto-3.jpg");
});

test("compares names case-insensitively, like Windows and macOS", () => {
  const used = new Set<string>();
  assert.equal(uniqueFileName("Foto.jpg", used), "Foto.jpg");
  assert.equal(uniqueFileName("foto.JPG", used), "foto-2.JPG");
});

test("handles names without extension", () => {
  const used = new Set<string>();
  assert.equal(uniqueFileName("documento", used), "documento");
  assert.equal(uniqueFileName("documento", used), "documento-2");
});
