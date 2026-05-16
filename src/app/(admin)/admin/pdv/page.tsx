import { CalculatorIcon } from "lucide-react";
import Link from "next/link";

import { PdvShell } from "@/components/admin/pdv/pdv-shell";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";

/**
 * PDV / venda balcão (Fase 5 — ADR-0016).
 *
 * Estado client-side (carrinho, cliente, pagamento) — esta venda é
 * efêmera até o lojista clicar "Finalizar". Server-action persiste tudo
 * em uma transação atômica e redireciona pro recibo imprimível.
 *
 * Mobile-first stack; desktop 2 colunas (grid lg:[1fr_400px]).
 */
export default async function PdvPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="PDV"
        subtitle="Registre uma venda no balcão. Estoque desce automaticamente."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/pdv/caixa">
              <CalculatorIcon />
              Fechar caixa
            </Link>
          </Button>
        }
      />
      <PdvShell />
    </div>
  );
}
