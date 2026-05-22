import { ClipboardListIcon, InfoIcon, PackageIcon } from "lucide-react";
import Link from "next/link";

import { loadCountableInventory } from "@/actions/stock/load";
import { PhysicalInventoryForm } from "@/components/admin/physical-inventory-form";

/**
 * /admin/estoque/contagem — Sprint 3C.
 *
 * Tela de contagem física em batch. Lojista vai com tablet pela loja,
 * digita o que CONTOU em cada produto/variante, e submete todas as
 * diferenças de uma vez. Sistema gera stock_movement type='adjustment'
 * pra cada linha com delta != 0.
 *
 * Append-only: o saldo no sistema NUNCA é sobrescrito. O ajuste vira
 * uma linha de auditoria no histórico (visível em /admin/estoque).
 */
export default async function ContagemFisicaPage() {
  const items = await loadCountableInventory();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-ink-4 mb-1 text-[11px] tracking-wide uppercase">
            <Link href="/admin/estoque" className="hover:text-ink-1">
              Estoque
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink-2">Contagem física</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.025em] text-ink-1">
            Contagem física
          </h1>
          <p className="text-ink-4 mt-1 text-sm">
            Digite a quantidade contada de cada produto. O sistema cria os
            ajustes em massa — só linhas com diferença viram movimentação.
          </p>
        </div>
      </div>

      {items.length === 0 ? <EmptyState /> : <PhysicalInventoryForm items={items} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
        <ClipboardListIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">
        Nenhum produto controla estoque
      </h2>
      <p className="text-ink-4 max-w-md text-sm">
        Ative <span className="font-medium">Controlar estoque</span> nos
        produtos físicos pra eles aparecerem aqui na contagem.
      </p>
      <Link href="/admin/produtos" className="b3-btn mt-2" prefetch>
        <PackageIcon size={14} aria-hidden />
        Ver produtos
      </Link>
      <div className="mt-4 inline-flex items-start gap-2 rounded-md bg-bg-app px-3 py-2 text-left text-xs text-ink-4">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Serviços e produtos sob encomenda ficam de fora da contagem por
          padrão — quem não controla peças não precisa contar.
        </span>
      </div>
    </div>
  );
}
