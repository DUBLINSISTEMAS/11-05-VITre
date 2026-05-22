"use client";

/**
 * Configurações operacionais do PDV — Sprint 3.5 (2026-05-22).
 *
 * Card isolado em /admin/configuracoes. Hoje contém só o switch de
 * "exigir caixa aberto pra registrar venda". Estrutura preparada pra
 * crescer (senha pra desconto > X%, exigir CPF acima de Y, etc) sem
 * inflar o form principal de identidade da loja.
 */

import { Loader2Icon, LockKeyholeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePdvPolicy } from "@/actions/store/update-pdv-policy";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface PdvPolicyCardProps {
  initialRequireOpenCashSession: boolean;
}

export function PdvPolicyCard({
  initialRequireOpenCashSession,
}: PdvPolicyCardProps) {
  const router = useRouter();
  const [requireOpenCashSession, setRequireOpenCashSession] = useState(
    initialRequireOpenCashSession,
  );
  const [isPending, startTransition] = useTransition();

  const dirty = requireOpenCashSession !== initialRequireOpenCashSession;

  const onSave = () => {
    startTransition(async () => {
      const r = await updatePdvPolicy({ requireOpenCashSession });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Configuração de PDV salva.");
      router.refresh();
    });
  };

  return (
    <section className="b3-card space-y-4 p-4 sm:p-5">
      <header className="flex items-center gap-2">
        <LockKeyholeIcon className="text-ink-3 size-4" />
        <div>
          <h2 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
            Disciplina do PDV
          </h2>
          <p className="text-ink-4 text-xs">
            Regras opcionais que tornam o fluxo do balcão mais rígido.
          </p>
        </div>
      </header>

      <div className="flex items-start justify-between gap-3 rounded-md border border-line bg-bg-app p-3">
        <div className="space-y-1">
          <label
            htmlFor="require-open-cash-session"
            className="cursor-pointer text-[13px] font-medium text-ink-1"
          >
            Exigir caixa aberto pra registrar venda
          </label>
          <p className="text-ink-4 text-[11.5px] leading-snug">
            Quando ligado, o PDV bloqueia novas vendas (balcão e fiado)
            se não houver caixa aberto. Orçamento continua permitido. O
            fechamento Z fica mais limpo — sem vendas órfãs.
          </p>
        </div>
        <Switch
          id="require-open-cash-session"
          checked={requireOpenCashSession}
          onCheckedChange={setRequireOpenCashSession}
          disabled={isPending}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onSave}
          disabled={!dirty || isPending}
          size="sm"
        >
          {isPending ? (
            <>
              <Loader2Icon className="mr-1.5 size-4 animate-spin" />
              Salvando…
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </section>
  );
}
