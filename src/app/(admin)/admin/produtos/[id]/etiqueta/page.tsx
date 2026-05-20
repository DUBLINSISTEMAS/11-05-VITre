/**
 * Etiqueta com código de barras — Sprint 2E.
 *
 * Carrega o produto + dados da loja. UI client decide quantas cópias,
 * formato (A4 ou térmica 80mm), e dispara window.print() com layout
 * otimizado por CSS @media print.
 */
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { BarcodeEtiquetaClient } from "./barcode-etiqueta-client";

export const dynamic = "force-dynamic";

interface EtiquetaPageProps {
  params: Promise<{ id: string }>;
}

export default async function EtiquetaPage({ params }: EtiquetaPageProps) {
  const { id } = await params;
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: etiqueta page sem loja");
  }

  const product = await withTenant(store.id, session.user.id, async (tx) => {
    const [row] = await tx
      .select({
        id: productTable.id,
        name: productTable.name,
        basePriceInCents: productTable.basePriceInCents,
        promoPriceInCents: productTable.promoPriceInCents,
        gtin: productTable.gtin,
        internalCode: productTable.internalCode,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.id, id),
          eq(productTable.storeId, store.id),
        ),
      )
      .limit(1);
    return row ?? null;
  });

  if (!product) {
    notFound();
  }

  // Auto-pick: GTIN > código interno > primeiros 8 chars do ID (CODE128 fallback)
  const barcodeValue =
    product.gtin && product.gtin.trim()
      ? product.gtin.trim()
      : product.internalCode && product.internalCode.trim()
        ? product.internalCode.trim()
        : product.id.replace(/-/g, "").slice(0, 12).toUpperCase();

  return (
    <BarcodeEtiquetaClient
      productId={product.id}
      productName={product.name}
      priceInCents={product.basePriceInCents}
      barcodeValue={barcodeValue}
      hasGtin={!!product.gtin?.trim()}
      hasInternalCode={!!product.internalCode?.trim()}
      storeName={store.name}
    />
  );
}
