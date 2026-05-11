/**
 * Regression suite — page-search-params.
 *
 * Bug capturado: em Zod v4 schemas dentro de z.object() são `nonoptional`
 * por default. `z.union([z.string(), z.undefined()])` NÃO é equivalente a
 * `.optional()` — quando a URL não tem a propriedade, Zod v4 lança
 * "expected nonoptional, received undefined".
 *
 * Esses testes garantem que parse({}) NUNCA lança em nenhum primitive
 * exportado, e que defaults sensatos saem em URL malformada.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  boolFlagSchema,
  enumOrNull,
  enumWithDefault,
  idOrNullSchema,
  pageNumberSchema,
  priceCentsSchema,
  searchTextSchema,
} from "../src/lib/page-search-params";

const STATUS_VALUES = ["active", "inactive", "draft"] as const;

const fullSchema = z.object({
  q: searchTextSchema,
  page: pageNumberSchema,
  priceMin: priceCentsSchema,
  priceMax: priceCentsSchema,
  status: enumOrNull(STATUS_VALUES),
  sort: enumWithDefault(STATUS_VALUES, "active"),
  promo: boolFlagSchema,
  categoryId: idOrNullSchema,
});

test("parse({}) — todos os campos têm default seguro, nunca lança", () => {
  const result = fullSchema.parse({});
  assert.equal(result.q, "");
  assert.equal(result.page, 1);
  assert.equal(result.priceMin, undefined);
  assert.equal(result.priceMax, undefined);
  assert.equal(result.status, null);
  assert.equal(result.sort, "active");
  assert.equal(result.promo, false);
  assert.equal(result.categoryId, null);
});

test("pageNumberSchema: undefined/null/inválido viram 1, cap em 100k", () => {
  assert.equal(pageNumberSchema.parse(undefined), 1);
  assert.equal(pageNumberSchema.parse(null), 1);
  assert.equal(pageNumberSchema.parse(""), 1);
  assert.equal(pageNumberSchema.parse("abc"), 1);
  assert.equal(pageNumberSchema.parse("-5"), 1);
  assert.equal(pageNumberSchema.parse("0"), 1);
  assert.equal(pageNumberSchema.parse("1"), 1);
  assert.equal(pageNumberSchema.parse("42"), 42);
  assert.equal(pageNumberSchema.parse(42), 42);
  assert.equal(pageNumberSchema.parse("999999999"), 100_000);
});

test("searchTextSchema: trim + slice MAX_QUERY_LEN=100", () => {
  assert.equal(searchTextSchema.parse(undefined), "");
  assert.equal(searchTextSchema.parse(""), "");
  assert.equal(searchTextSchema.parse("   bag   "), "bag");
  const long = "a".repeat(500);
  assert.equal(searchTextSchema.parse(long).length, 100);
});

test("boolFlagSchema: apenas '1' vira true", () => {
  assert.equal(boolFlagSchema.parse("1"), true);
  assert.equal(boolFlagSchema.parse("0"), false);
  assert.equal(boolFlagSchema.parse("true"), false);
  assert.equal(boolFlagSchema.parse(undefined), false);
  assert.equal(boolFlagSchema.parse(""), false);
});

test("priceCentsSchema: vazio/inválido = undefined, cap em 100k reais", () => {
  assert.equal(priceCentsSchema.parse(undefined), undefined);
  assert.equal(priceCentsSchema.parse(null), undefined);
  assert.equal(priceCentsSchema.parse(""), undefined);
  assert.equal(priceCentsSchema.parse("abc"), undefined);
  assert.equal(priceCentsSchema.parse("-100"), undefined);
  assert.equal(priceCentsSchema.parse("5000"), 5000);
  assert.equal(priceCentsSchema.parse("999999999"), 100_000_00);
});

test("enumOrNull: valor não-whitelisted vira null", () => {
  const schema = enumOrNull(STATUS_VALUES);
  assert.equal(schema.parse("active"), "active");
  assert.equal(schema.parse("hacker"), null);
  assert.equal(schema.parse(undefined), null);
});

test("enumWithDefault: fallback sempre presente", () => {
  const schema = enumWithDefault(STATUS_VALUES, "draft");
  assert.equal(schema.parse("active"), "active");
  assert.equal(schema.parse("invalid"), "draft");
  assert.equal(schema.parse(undefined), "draft");
});

test("idOrNullSchema: vazio/whitespace = null", () => {
  assert.equal(idOrNullSchema.parse(undefined), null);
  assert.equal(idOrNullSchema.parse(""), null);
  assert.equal(idOrNullSchema.parse("   "), null);
  assert.equal(idOrNullSchema.parse(" abc "), "abc");
});
