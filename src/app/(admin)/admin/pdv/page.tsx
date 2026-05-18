import { CalculatorIcon } from "lucide-react";
import Link from "next/link";

import { PdvShell } from "@/components/admin/pdv/pdv-shell";

/**
 * PDV / venda balcão (Fase 5 — ADR-0016, port Dublin v3 Onda A.11).
 *
 * Estado client-side (carrinho, cliente, pagamento) — esta venda é
 * efêmera até o lojista clicar "Finalizar". Server-action persiste tudo
 * em uma transação atômica e redireciona pro recibo imprimível.
 *
 * Mobile-first stack; desktop 2 colunas (grid lg:[1fr_400px]).
 *
 * Decisões pixel-perfect vs handoff (B3PDVScreen):
 * - H1 22px font-bold tracking -0.025em (substitui AdminPageHeader)
 * - Meta "Caixa do dia · N venda(s)" no canto direito (placeholder
 *   substituindo "Caixa #03 · aberto às 08:02" do handoff — sessão de
 *   caixa formal vira ADR-0024 / Onda B.8; por ora só CTA "Caixa do dia")
 * - Subtítulo removido (Dublin v3 não tem)
 */
export default async function PdvPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.025em] text-ink-1">
          PDV · Balcão
        </h1>
        <Link
          href="/admin/pdv/caixa"
          className="b3-btn b3-btn--sm"
          prefetch
        >
          <CalculatorIcon size={13} aria-hidden />
          <span>Caixa do dia</span>
        </Link>
      </div>
      <PdvShell />
    </div>
  );
}
