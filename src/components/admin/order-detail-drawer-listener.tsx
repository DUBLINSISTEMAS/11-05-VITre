"use client";

// Host global do drawer de detalhe da venda — handoff design 2026-05-25.
//
// Montado uma única vez em <AdminShell />, este componente:
//   1. Escuta `OPEN_ORDER_DETAIL_EVENT` (disparado de qualquer ponto da
//      UI: row da OrdersTable, link "Vendas recentes" do dashboard, etc).
//   2. Lê `?detail=<id>` da URL ao montar — preserva deep-link existente
//      (`/admin/pedidos?detail=xyz` continua abrindo o drawer).
//   3. Sincroniza a URL no open/close via `router.replace` — back button
//      do navegador fecha; refresh preserva o drawer aberto.
//
// O drawer em si (`OrderDetailDrawer`) é controlado por `orderId`. Quando
// null, fica fechado. O Sheet do shadcn cuida do unmount via animação.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { OrderDetailDrawer } from "./order-detail-drawer";
import {
  OPEN_ORDER_DETAIL_EVENT,
  type OpenOrderDetailEventDetail,
} from "./order-detail-events";

export function OrderDetailDrawerListener() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailFromUrl = searchParams.get("detail");

  const [openOrderId, setOpenOrderId] = useState<string | null>(detailFromUrl);

  // Sync com URL: quando user navega entre rotas mantendo ?detail= ou
  // quando link externo (dashboard) vem com ?detail=, mantemos o drawer
  // alinhado com o que está no URL.
  useEffect(() => {
    setOpenOrderId(detailFromUrl);
  }, [detailFromUrl]);

  // Escuta evento global de abertura — atualiza URL pra refletir o estado.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenOrderDetailEventDetail>;
      const id = ce.detail?.orderId;
      if (!id) return;
      setOpenOrderId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("detail", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
    window.addEventListener(OPEN_ORDER_DETAIL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ORDER_DETAIL_EVENT, onOpen);
  }, [pathname, router, searchParams]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setOpenOrderId(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("detail");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, {
          scroll: false,
        });
      }
    },
    [pathname, router, searchParams],
  );

  return (
    <OrderDetailDrawer
      orderId={openOrderId}
      onOpenChange={handleOpenChange}
    />
  );
}
