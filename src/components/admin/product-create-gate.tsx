"use client";

/**
 * ProductDialogGate — fonte única do <ProductDialog> em /admin/produtos.
 *
 * Estado vive na URL (search params), não em useState local:
 *   - `?novo=1`        → abre dialog em modo CREATE
 *   - `?editar=<id>`   → abre dialog em modo EDIT do produto `id`
 *
 * Por que URL state?
 * - Antes (Onda 5), três sites separados montavam <ProductDialog>:
 *   ProductCreateGate (lê ?novo=1), ProductCreateButton (state local),
 *   ProductsTable (state local). Cada um com seu focus-trap; clicar
 *   "Novo produto" no header DEPOIS de chegar via `?novo=1` abria DOIS
 *   dialogs simultâneos (radix permite), trap saltava entre eles.
 *   Crítico C1 da auditoria 2026-05-12.
 * - Lifted-to-URL é a forma idiomática Next 15: páginas server, dialogs
 *   linkáveis (founder pode mandar `/admin/produtos?editar=xxx`), zero
 *   coupling entre os botões consumidores e o dialog.
 *
 * Quem usa:
 * - `ProductCreateButton` (header + empty state) → `router.push("?novo=1")`
 * - `ProductsTable` (click em linha/card)         → `router.push("?editar=<id>")`
 * - Este gate monta o <ProductDialog> uma única vez no page.tsx.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  ProductDialog,
  type ProductDialogState,
} from "./product-dialog";

const QUERY_KEY_CREATE = "novo";
const QUERY_KEY_EDIT = "editar";

export function ProductDialogGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<ProductDialogState>(() => {
    if (searchParams.get(QUERY_KEY_CREATE) === "1") {
      return { mode: "create" };
    }
    const editId = searchParams.get(QUERY_KEY_EDIT);
    if (editId && editId.length > 0) {
      return { mode: "edit", productId: editId };
    }
    return { mode: "closed" };
  }, [searchParams]);

  const handleClose = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(QUERY_KEY_CREATE);
    next.delete(QUERY_KEY_EDIT);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return <ProductDialog state={state} onClose={handleClose} />;
}

/**
 * Compat alias — código antigo importa `ProductCreateGate`. Mantemos
 * o mesmo símbolo apontando pro novo gate até refatorar consumidores.
 * @deprecated Use `ProductDialogGate`.
 */
export const ProductCreateGate = ProductDialogGate;
