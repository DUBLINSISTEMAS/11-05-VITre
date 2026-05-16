import assert from "node:assert/strict";
import test from "node:test";

import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../src/actions/customer/schema";

// ---------------------------------------------------------------------
// createCustomerSchema — happy path + validações de boundary
// Fixtures Fase 3 / ADR-0014
// ---------------------------------------------------------------------

test("customer: aceita payload mínimo (name + phone E.164)", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria da Silva",
    phone: "+5511999999999",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.name, "Maria da Silva");
  assert.equal(result.data.phone, "+5511999999999");
  assert.equal(result.data.email, null);
  assert.equal(result.data.addressStreet, null);
  assert.equal(result.data.addressState, null);
  assert.equal(result.data.notes, null);
});

test("customer: rejeita phone sem +", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "5511999999999",
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const phoneError = result.error.issues.find((i) => i.path[0] === "phone");
  assert.ok(phoneError, "expected error on phone");
});

test("customer: rejeita phone com letras", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+55ABC99999",
  });
  assert.equal(result.success, false);
});

test("customer: rejeita phone curto demais", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+551",
  });
  assert.equal(result.success, false);
});

test("customer: rejeita nome vazio", () => {
  const result = createCustomerSchema.safeParse({
    name: "   ",
    phone: "+5511999999999",
  });
  assert.equal(result.success, false);
});

test("customer: rejeita nome > 120 chars", () => {
  const result = createCustomerSchema.safeParse({
    name: "x".repeat(121),
    phone: "+5511999999999",
  });
  assert.equal(result.success, false);
});

test("customer: UF lowercase é normalizada pra uppercase", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    addressState: "ma",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.addressState, "MA");
});

test("customer: UF com 3 letras é rejeitada", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    addressState: "MAR",
  });
  assert.equal(result.success, false);
});

test("customer: CEP com máscara é normalizado pra dígitos", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    addressZip: "65725-000",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.addressZip, "65725000");
});

test("customer: CEP com 7 dígitos é rejeitado", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    addressZip: "6572500",
  });
  assert.equal(result.success, false);
});

test("customer: strings vazias em opcionais viram null", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    email: "",
    addressStreet: "",
    addressCity: "",
    notes: "",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.email, null);
  assert.equal(result.data.addressStreet, null);
  assert.equal(result.data.addressCity, null);
  assert.equal(result.data.notes, null);
});

test("customer: email inválido é rejeitado quando presente", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    email: "naovalido",
  });
  assert.equal(result.success, false);
});

test("customer: email válido é preservado", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    email: "maria@email.com",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.email, "maria@email.com");
});

test("customer: notes > 1000 chars é rejeitado", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    notes: "x".repeat(1001),
  });
  assert.equal(result.success, false);
});

test("customer: notes com exatamente 1000 chars passa", () => {
  const result = createCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
    notes: "x".repeat(1000),
  });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------
// updateCustomerSchema — exige id UUID
// ---------------------------------------------------------------------

test("customer update: rejeita sem id", () => {
  const result = updateCustomerSchema.safeParse({
    name: "Maria",
    phone: "+5511999999999",
  });
  assert.equal(result.success, false);
});

test("customer update: rejeita id não-UUID", () => {
  const result = updateCustomerSchema.safeParse({
    id: "not-a-uuid",
    name: "Maria",
    phone: "+5511999999999",
  });
  assert.equal(result.success, false);
});

test("customer update: aceita id UUID válido", () => {
  const result = updateCustomerSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Maria",
    phone: "+5511999999999",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.id, "550e8400-e29b-41d4-a716-446655440000");
});

test("customer update: campos opcionais funcionam igual ao create", () => {
  const result = updateCustomerSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Maria",
    phone: "+5511999999999",
    addressState: "sp",
    addressZip: "01310-100",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.addressState, "SP");
  assert.equal(result.data.addressZip, "01310100");
});
