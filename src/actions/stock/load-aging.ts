"use server";

/**
 * loadStockAging — S3.6 do Plano de Endurecimento.
 *
 * Aging report = produtos com estoque parado há N dias sem venda.
 * Métrica #1 pra joalheria/loja com capital empatado decidir liquidação.
 *
 * Query: LEFT JOIN LATERAL pra cada produto com estoque > 0 buscar a
 * última `stock_movement.movement_type='sale'`. Se nunca vendeu, conta
 * como "infinitos dias parado" (cohort 180+).
 *
 * Cohorts: 60-90, 90-180, 180+ dias. Lojista decide promoção/liquidação
 * por capital empatado (qty × cost) desc dentro de cada cohort.
 */
import { sql } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export interface AgingRow {
  productId: string;
  productName: string;
  stockQuantity: number;
  /** custo unitário em centavos. NULL = sem custo cadastrado. */
  unitCostInCents: number | null;
  /** valor parado = stockQuantity × unitCost. NULL se sem custo. */
  parkedValueInCents: number | null;
  /** dias desde a última venda. NULL = nunca vendeu. */
  daysSinceLastSale: number | null;
  cohort: "60-90" | "90-180" | "180+";
}

export interface LoadStockAgingResult {
  rows: AgingRow[];
  kpi: {
    parked60to90InCents: number;
    parked90to180InCents: number;
    parked180PlusInCents: number;
    parked60PlusInCents: number;
  };
}

export async function loadStockAging(): Promise<LoadStockAgingResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      rows: [],
      kpi: {
        parked60to90InCents: 0,
        parked90to180InCents: 0,
        parked180PlusInCents: 0,
        parked60PlusInCents: 0,
      },
    };
  }
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return {
      rows: [],
      kpi: {
        parked60to90InCents: 0,
        parked90to180InCents: 0,
        parked180PlusInCents: 0,
        parked60PlusInCents: 0,
      },
    };
  }

  return withTenant(store.id, session.user.id, async (tx) => {
    // LATERAL JOIN pega last_sale_at pra cada produto. Filtro:
    //   - is_active (não-draft, não-excluido)
    //   - stock_quantity > 0 (estoque positivo)
    //   - daysSinceLastSale >= 60 OR last_sale IS NULL (cohort min é 60-90)
    //
    // Indexado: stock_movement_store_idx (store_id) + filter por movementType.
    // Pra loja com 250 produtos × pouco histórico, performance OK.
    const result = await tx.execute<{
      product_id: string;
      product_name: string;
      stock_quantity: number;
      cost_price_in_cents: number | null;
      last_sale_at: Date | null;
      days_since_last_sale: number | null;
    }>(sql`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.stock_quantity,
        p.cost_price_in_cents,
        last_sale.created_at AS last_sale_at,
        CASE
          WHEN last_sale.created_at IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (now() - last_sale.created_at))::int
        END AS days_since_last_sale
      FROM product p
      LEFT JOIN LATERAL (
        SELECT created_at
          FROM stock_movement sm
         WHERE sm.product_id = p.id
           AND sm.store_id = ${store.id}
           AND sm.movement_type = 'sale'
         ORDER BY created_at DESC
         LIMIT 1
      ) last_sale ON true
      WHERE p.store_id = ${store.id}
        AND p.is_active = true
        AND coalesce(p.stock_quantity, 0) > 0
        AND (
          last_sale.created_at IS NULL
          OR last_sale.created_at < now() - INTERVAL '60 days'
        )
      ORDER BY (coalesce(p.stock_quantity, 0) * coalesce(p.cost_price_in_cents, 0)) DESC
    `);

    const rows: AgingRow[] = result.rows.map((r) => {
      const days = r.days_since_last_sale; // null = nunca vendeu
      const cohort: AgingRow["cohort"] =
        days === null || days >= 180 ? "180+" : days >= 90 ? "90-180" : "60-90";
      const parkedValueInCents =
        r.cost_price_in_cents !== null
          ? r.stock_quantity * r.cost_price_in_cents
          : null;
      return {
        productId: r.product_id,
        productName: r.product_name,
        stockQuantity: r.stock_quantity,
        unitCostInCents: r.cost_price_in_cents,
        parkedValueInCents,
        daysSinceLastSale: days,
        cohort,
      };
    });

    const kpi = rows.reduce(
      (acc, r) => {
        const v = r.parkedValueInCents ?? 0;
        if (r.cohort === "60-90") acc.parked60to90InCents += v;
        else if (r.cohort === "90-180") acc.parked90to180InCents += v;
        else acc.parked180PlusInCents += v;
        acc.parked60PlusInCents += v;
        return acc;
      },
      {
        parked60to90InCents: 0,
        parked90to180InCents: 0,
        parked180PlusInCents: 0,
        parked60PlusInCents: 0,
      },
    );

    return { rows, kpi };
  });
}
