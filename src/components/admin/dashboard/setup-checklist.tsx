// Card "Setup N de 6" do dashboard admin (canvas-v1). Lista de 6 ações
// pra deixar a loja completa. Cada item linka pra rota responsável.
//
// Design: fundo brand-tint (cor da loja diluída) + progress bar + lista
// com checkmark quando done. Itens done renderizam line-through e cor
// muted; itens pendentes renderizam Link visível com cor brand.
import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface SetupItem {
  /** Chave estável pra React key. */
  key: string;
  /** Texto da ação (ex: "Adicione o logo da loja"). */
  label: string;
  /** Rota destino. */
  href: string;
  done: boolean;
}

export interface SetupChecklistProps {
  items: ReadonlyArray<SetupItem>;
}

export function SetupChecklist({ items }: SetupChecklistProps) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const isComplete = done === total;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div
      className="bg-brand-tint flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
      aria-label="Configuração inicial da loja"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="space-y-1">
          <span className="text-eyebrow">Configuração</span>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {isComplete
              ? "Tudo pronto na sua loja"
              : `Setup ${done} de ${total}`}
          </h2>
        </div>
        <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="bg-card/60 h-1.5 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              prefetch
              className={cn(
                "hocus:bg-card/60 group flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  item.done
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-foreground/30 bg-card",
                )}
              >
                {item.done ? <CheckIcon className="size-2.5" /> : null}
              </span>
              <span
                className={cn(
                  "flex-1 text-[12.5px]",
                  item.done
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
