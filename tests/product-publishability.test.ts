import assert from "node:assert/strict";
import test from "node:test";

import { productFormSchema, updateProductSchema } from "../src/actions/product/schema";

const baseProductInput = {
  name: "Vestido Linho",
  description: "",
  basePriceInCents: 10000,
  promoPriceInCents: null,
  categoryId: null,
  trackStock: false,
  stockQuantity: null,
  isActive: true,
  isFeatured: false,
  composition: "",
  modeling: "",
  lining: "",
  washing: "",
  variants: [],
};

test("productFormSchema rejects active product with zero price", () => {
  const result = productFormSchema.safeParse({
    ...baseProductInput,
    basePriceInCents: 0,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["basePriceInCents"]);
    assert.equal(
      result.error.issues[0]?.message,
      "Informe um preço maior que zero para publicar.",
    );
  }
});

test("productFormSchema allows inactive draft with zero price", () => {
  const result = productFormSchema.safeParse({
    ...baseProductInput,
    basePriceInCents: 0,
    isActive: false,
  });

  assert.equal(result.success, true);
});

test("updateProductSchema applies the same publish price rule", () => {
  const result = updateProductSchema.safeParse({
    ...baseProductInput,
    productId: "11111111-1111-4111-8111-111111111111",
    basePriceInCents: 0,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["basePriceInCents"]);
  }
});

test("productFormSchema rejects mixed variant axes", () => {
  const result = productFormSchema.safeParse({
    ...baseProductInput,
    variants: [
      {
        tempId: "tmp-size",
        name: "P",
        priceInCents: null,
        stockQuantity: null,
        axis: "size",
        colorHex: "",
        featuredImageId: null,
      },
      {
        tempId: "tmp-color",
        name: "Cru",
        priceInCents: null,
        stockQuantity: null,
        axis: "color",
        colorHex: "#F5EFE6",
        featuredImageId: null,
      },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["variants"]);
    assert.equal(
      result.error.issues[0]?.message,
      "Use apenas um tipo de variante por produto: tamanho ou cor.",
    );
  }
});

test("updateProductSchema rejects mixed variant axes too", () => {
  const result = updateProductSchema.safeParse({
    ...baseProductInput,
    productId: "11111111-1111-4111-8111-111111111111",
    variants: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "P",
        priceInCents: null,
        stockQuantity: null,
        axis: "size",
        colorHex: "",
        featuredImageId: null,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Azul",
        priceInCents: null,
        stockQuantity: null,
        axis: "color",
        colorHex: "#1E3FE6",
        featuredImageId: null,
      },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["variants"]);
  }
});
