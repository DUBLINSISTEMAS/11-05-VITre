import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildPublicOrderPath,
  generatePublicOrderToken,
  PUBLIC_ORDER_TOKEN_LENGTH,
} from "../src/lib/public-order";

test("generatePublicOrderToken returns a long URL-safe token", () => {
  const token = generatePublicOrderToken();

  assert.equal(token.length, PUBLIC_ORDER_TOKEN_LENGTH);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test("buildPublicOrderPath uses the opaque public token", () => {
  assert.equal(buildPublicOrderPath("tok_ABC123"), "/p/tok_ABC123");
});

test("public order page does not build WhatsApp messages with customer PII", () => {
  const page = readFileSync("src/app/p/[token]/page.tsx", "utf8");

  assert.doesNotMatch(page, /customerName:\s*order\.customerName/);
  assert.doesNotMatch(page, /customerNotes:\s*order\.customerNotes/);
  assert.doesNotMatch(page, /buildOrderMessage/);
});

test("public order route uses [token] folder name matching the resolver semantics", () => {
  const page = readFileSync("src/app/p/[token]/page.tsx", "utf8");

  assert.match(page, /interface PageParams\s*\{\s*token:\s*string;?\s*\}/);
  assert.match(page, /const \{ token \} = await params/);
  assert.doesNotMatch(page, /shortCode:\s*publicToken/);
  assert.doesNotMatch(page, /\[shortCode\]/);
});

test("success page links to publicToken instead of shortCode", () => {
  const page = readFileSync(
    "src/app/(storefront)/[storeSlug]/sucesso/page.tsx",
    "utf8",
  );

  assert.match(page, /order\.publicToken/);
  assert.doesNotMatch(page, /href=\{`\/p\/\$\{order\.shortCode\}`\}/);
  assert.doesNotMatch(page, /Mangos Pay\.app\/p\/\{order\.shortCode\}/);
});

test("whatsapp opened tracking uses publicToken instead of shortCode", () => {
  const action = readFileSync("src/actions/order/mark-whatsapp-opened.ts", "utf8");
  const button = readFileSync(
    "src/components/storefront/whatsapp-open-button.tsx",
    "utf8",
  );

  assert.match(action, /publicToken/);
  assert.match(action, /eq\(orderTable\.publicToken/);
  assert.doesNotMatch(action, /eq\(orderTable\.shortCode/);
  assert.match(button, /publicToken/);
  assert.doesNotMatch(button, /markWhatsAppOpened\(\{ shortCode \}\)/);
});
