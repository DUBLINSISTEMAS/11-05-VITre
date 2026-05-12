"use client";

/**
 * ProductCreateGate — captura `?novo=1` na URL e abre o ProductDialog
 * em modo create. Monta independentemente do estado da lista (vazia ou
 * não), garantindo que botões de empty state e onboarding também
 * disparem o modal.
 *
 * Onda 5 fix pós-verifier (2026-05-12): o useEffect que lia `?novo=1`
 * vivia em ProductsTable, que não monta quando produtos.length === 0 —
 * quebrava o fluxo "Cadastrar primeiro produto". Verifier marcou FAIL
 * crítico. Solução: subir esse consumer pra um componente que mora no
 * page.tsx e sempre monta.
 *
 * ProductsTable continua dono do dialog de EDIT (precisa do state local
 * pra mapear click→productId). Aqui só CREATE.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ProductDialog,
  type ProductDialogState,
} from "./product-dialog";

export function ProductCreateGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialog, setDialog] = useState<ProductDialogState>({ mode: "closed" });

  useEffect(() => {
    if (searchParams.get("novo") === "1" && dialog.mode === "closed") {
      setDialog({ mode: "create" });
      const next = new URLSearchParams(searchParams);
      next.delete("novo");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [searchParams, dialog.mode, pathname, router]);

  return (
    <ProductDialog
      state={dialog}
      onClose={() => setDialog({ mode: "closed" })}
    />
  );
}
