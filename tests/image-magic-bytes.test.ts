/**
 * Tests de magic-bytes (Sprint 6C).
 *
 * Detecção de formato real do arquivo + integração nos 5 upload
 * actions. Fixtures sintéticas — só os primeiros 12 bytes importam.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  detectImageMagic,
  validateImageMagicBytes,
} from "../src/lib/image";

// ---------------------------------------------------------------------
// Fixtures: primeiros bytes válidos de cada formato + padding
// ---------------------------------------------------------------------

function mk(...bytes: number[]): Buffer {
  // Pad com 0s até 12 bytes (mínimo pra detectImageMagic).
  const out = Buffer.alloc(16, 0);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i]!;
  return out;
}

const JPEG = mk(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const PNG = mk(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
// WebP: RIFF size WEBP
const WEBP = mk(
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
);
// AVIF: 4 bytes size + "ftyp" + "avif"
const AVIF = mk(
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
);
// AVIS (image sequence) também é AVIF semanticamente
const AVIS = mk(
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x73,
);
// Executável Linux (ELF)
const ELF = mk(0x7f, 0x45, 0x4c, 0x46);
// Windows PE (.exe): MZ + padding
const EXE = mk(0x4d, 0x5a, 0x90, 0x00);
// Buffer muito curto
const TINY = Buffer.from([0xff, 0xd8]);

// ---------------------------------------------------------------------
// detectImageMagic
// ---------------------------------------------------------------------

test("detectImageMagic identifica JPEG (FF D8 FF)", () => {
  assert.equal(detectImageMagic(JPEG), "image/jpeg");
});

test("detectImageMagic identifica PNG (89 50 4E 47 ...)", () => {
  assert.equal(detectImageMagic(PNG), "image/png");
});

test("detectImageMagic identifica WebP (RIFF + WEBP)", () => {
  assert.equal(detectImageMagic(WEBP), "image/webp");
});

test("detectImageMagic identifica AVIF (ftypavif)", () => {
  assert.equal(detectImageMagic(AVIF), "image/avif");
});

test("detectImageMagic identifica AVIS (image sequence) como AVIF", () => {
  assert.equal(detectImageMagic(AVIS), "image/avif");
});

test("detectImageMagic rejeita executável Linux (ELF)", () => {
  assert.equal(detectImageMagic(ELF), null);
});

test("detectImageMagic rejeita .exe Windows (MZ header)", () => {
  assert.equal(detectImageMagic(EXE), null);
});

test("detectImageMagic rejeita buffer muito curto (< 12 bytes)", () => {
  assert.equal(detectImageMagic(TINY), null);
});

// ---------------------------------------------------------------------
// validateImageMagicBytes — detecta MIME spoofing
// ---------------------------------------------------------------------

test("validateImageMagicBytes aceita JPEG declarado como JPEG", () => {
  assert.equal(validateImageMagicBytes(JPEG, "image/jpeg"), null);
});

test("validateImageMagicBytes aceita JPEG declarado como image/jpg (alias)", () => {
  assert.equal(validateImageMagicBytes(JPEG, "image/jpg"), null);
});

test("validateImageMagicBytes aceita PNG declarado como PNG", () => {
  assert.equal(validateImageMagicBytes(PNG, "image/png"), null);
});

test("validateImageMagicBytes rejeita .exe renomeado como .png", () => {
  const msg = validateImageMagicBytes(EXE, "image/png");
  assert.notEqual(msg, null);
  assert.match(msg!, /não é uma imagem válida/);
});

test("validateImageMagicBytes rejeita JPEG declarado como PNG (spoofing)", () => {
  const msg = validateImageMagicBytes(JPEG, "image/png");
  assert.notEqual(msg, null);
  assert.match(msg!, /declarado.*não bate/);
});

test("validateImageMagicBytes rejeita PNG declarado como WebP (spoofing)", () => {
  const msg = validateImageMagicBytes(PNG, "image/webp");
  assert.notEqual(msg, null);
  assert.match(msg!, /declarado.*não bate/);
});

// ---------------------------------------------------------------------
// Integração nos 5 upload actions — source-level
// ---------------------------------------------------------------------

const UPLOAD_ACTIONS = [
  "src/actions/product/upload-image.ts",
  "src/actions/product/replace-image.ts",
  "src/actions/category/upload-image.ts",
  "src/actions/store/upload-image.ts",
  "src/actions/banner/upload.ts",
];

for (const file of UPLOAD_ACTIONS) {
  test(`${file} chama validateImageMagicBytes antes de compressImage`, () => {
    const s = readFileSync(file, "utf8");
    assert.match(s, /validateImageMagicBytes\(buffer,\s*file\.type\)/);
    // E loga o mismatch (forense)
    assert.match(s, /magic_bytes_mismatch/);
  });
}
