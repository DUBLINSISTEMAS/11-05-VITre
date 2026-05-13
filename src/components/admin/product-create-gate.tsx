"use client";

/**
 * ProductDialogGate — fonte única do <ProductDialog> em /admin/produtos.
 *
 * Estado primário vive na URL (search params):
 *   - `?novo=1`        → abre dialog em modo CREATE
 *   - `?editar=<id>`   → abre dialog em modo EDIT do produto `id`
 *
 * Por que URL state? Linkável, sem duplicação, evita race de focus-trap
 * (3 mountings que existiam antes). Crítico C1 da auditoria 2026-05-12.
 *
 * MAS — para fechar com responsividade percebida instantânea — usamos
 * um override local `closedOverride`. Click no X faz unmount IMEDIATO
 * via setState; a limpeza da URL roda em `startTransition` em background.
 * Isso resolve a percepção de modal "preso" porque sem o override o
 * fechamento dependia do round-trip RSC do Next 15 (60–250ms só pra
 * lista re-renderizar antes de a animação saída começar).
 *
 * Categorias chegam via `initialCategories` (server SSR) — modal de
 * create abre com Select já populado, sem refetch.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import type { CategoryOption } from "./category-dialog";
import {
  ProductDialog,
  type ProductDialogState,
} from "./product-dialog";

const QUERY_KEY_CREATE = "novo";
const QUERY_KEY_EDIT = "editar";

interface ProductDialogGateProps {
  /**
   * Categorias da loja, pré-fetchadas no SSR. Repassadas pro modo
   * `create` pra evitar 1 round-trip a cada abertura de "Novo produto".
   * O modo `edit` ainda chama loadProductDetail (precisa do produto
   * completo com imagens/variantes).
   */
  initialCategories: CategoryOption[];
}

export function ProductDialogGate({ initialCategories }: ProductDialogGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Override pra fechar instantâneo. Sincroniza com URL via useEffect:
  // se a URL muda pra qualquer outro dialog state, o override é resetado.
  const [closedOverride, setClosedOverride] = useState(false);
  const urlNovo = searchParams.get(QUERY_KEY_CREATE);
  const urlEditar = searchParams.get(QUERY_KEY_EDIT);
  useEffect(() => {
    setClosedOverride(false);
  }, [urlNovo, urlEditar]);

  const state = useMemo<ProductDialogState>(() => {
    if (closedOverride) return { mode: "closed" };
    if (urlNovo === "1") return { mode: "create" };
    if (urlEditar && urlEditar.length > 0) {
      return { mode: "edit", productId: urlEditar };
    }
    return { mode: "closed" };
  }, [closedOverride, urlNovo, urlEditar]);

  const handleClose = useCallback(() => {
    // Fecha INSTANTÂNEO no client; URL limpa em background. Sem isso, o
    // close do modal dependia do round-trip RSC do Next 15 pra que a
    // searchParams atualizasse, fazendo o fechamento parecer travado.
    setClosedOverride(true);
    startTransition(() => {
      const next = new URLSearchParams(searchParams);
      next.delete(QUERY_KEY_CREATE);
      next.delete(QUERY_KEY_EDIT);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  return (
    <ProductDialog
      state={state}
      onClose={handleClose}
      initialCategories={initialCategories}
    />
  );
}

/**
 * Compat alias — código antigo importa `ProductCreateGate`.
 * @deprecated Use `ProductDialogGate`.
 */
export const ProductCreateGate = ProductDialogGate;
