import { createBalcaoSaleSchema } from "../src/actions/order/balcao/schema";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

console.log("\n=== QUOTE (igual handleSubmitQuote) ===");
const quoteResult = createBalcaoSaleSchema.safeParse({
  mode: "quote",
  quoteValidityDays: 7,
  items: [{ productId: UUID, variantId: null, quantity: 1 }],
  customerId: null,
  walkInName: null,
  walkInPhone: null,
  discountInCents: null,
  surchargeInCents: null,
  notes: null,
});
console.log(quoteResult.success ? "OK" : JSON.stringify(quoteResult.error.issues, null, 2));

console.log("\n=== FIADO (igual handleSubmitFiado) ===");
const fiadoResult = createBalcaoSaleSchema.safeParse({
  mode: "fiado",
  dueDaysFromNow: 30,
  items: [{ productId: UUID, variantId: null, quantity: 1 }],
  customerId: UUID,
  walkInName: null,
  walkInPhone: null,
  discountInCents: null,
  surchargeInCents: null,
  notes: null,
});
console.log(fiadoResult.success ? "OK" : JSON.stringify(fiadoResult.error.issues, null, 2));

console.log("\n=== SALE NORMAL (controle) ===");
const saleResult = createBalcaoSaleSchema.safeParse({
  items: [{ productId: UUID, variantId: null, quantity: 1 }],
  customerId: null,
  walkInName: null,
  walkInPhone: null,
  payments: [{ method: "cash", amountInCents: 1000, cashReceivedInCents: null, notes: null }],
  discountInCents: null,
  surchargeInCents: null,
  notes: null,
});
console.log(saleResult.success ? "OK" : JSON.stringify(saleResult.error.issues, null, 2));
