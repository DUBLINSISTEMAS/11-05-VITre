"use client";

// Host global do drawer de produto — handoff PP1 Fase B (2026-05-25).
//
// Montado uma única vez em <AdminShell />. Este componente:
//   1. Escuta `OPEN_PRODUCT_FORM_EVENT` (disparado de qualquer ponto:
//      row da ProductsTable, ProductCreateButton, Cmd+K palette).
//   2. Lê `?edit=<id|new>` da URL ao montar — preserva deep-link.
//      `/admin/produtos?edit=xyz` abre o drawer; `/admin/produtos?edit=new`
//      abre vazio. As rotas antigas `/admin/produtos/[id]` e
//      `/admin/produtos/novo` viraram redirects pra esse padrão.
//   3. Sincroniza a URL no open/close via `router.replace` — back button
//      do navegador fecha o drawer; refresh preserva o estado.
//
// O drawer em si (`ProductFormDrawer`) é controlado por `target`:
//   - null  → fechado
//   - "new" → modo novo (form vazio + createProductFromValues)
//   - uuid  → modo edit

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ProductFormDrawer } from "./product-form-drawer";
import {
  OPEN_PRODUCT_FORM_EVENT,
  type OpenProductFormEventDetail,
} from "./product-form-events";

interface ProductFormDrawerListenerProps {
  storeSlug: string;
}

export function ProductFormDrawerListener({
  storeSlug,
}: ProductFormDrawerListenerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editFromUrl = searchParams.get("edit");

  const [target, setTarget] = useState<string | "new" | null>(editFromUrl);

  // Sync com URL: navegação ou link externo que vem com ?edit= mantém
  // o drawer alinhado com a URL.
  useEffect(() => {
    setTarget(editFromUrl);
  }, [editFromUrl]);

  // Escuta evento global de abertura — atualiza URL pra refletir estado.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenProductFormEventDetail>;
      const id = ce.detail?.productId ?? null;
      const next = id ?? "new";
      setTarget(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("edit", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
    window.addEventListener(OPEN_PRODUCT_FORM_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PRODUCT_FORM_EVENT, onOpen);
  }, [pathname, router, searchParams]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setTarget(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("edit");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, {
          scroll: false,
        });
        // Refresh pra a tabela /admin/produtos pegar mudanças (nome, preço,
        // status) sem reload manual.
        router.refresh();
      }
    },
    [pathname, router, searchParams],
  );

  return (
    <ProductFormDrawer
      target={target}
      onOpenChange={handleOpenChange}
      storeSlug={storeSlug}
    />
  );
}
