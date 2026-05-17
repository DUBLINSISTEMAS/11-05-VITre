// Card "Setup N de 6" do dashboard admin (port Dublin v3, Onda 5a).
// Lista de 6 ações pra deixar a loja completa. Cada item linka pra rota
// responsável.
//
// Design: fundo brand-tint (cor da LOJA diluída — intencional, mostra
// preview da personalização da lojista) + progress bar + lista com
// checkmark quando done. Itens done renderizam line-through e cor muted;
// pendentes renderizam Link visível com primary (= cor da loja).
// `bg-brand-tint` é decisão UX preservada (NÃO swap pra brand-wash navy).
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
          <h2 className="text-base font-semibold tracking-tight text-ink-1">
            {isComplete
              ? "Tudo pronto na sua loja"
              : `Setup ${done} de ${total}`}
          </h2>
        </div>
        <span className="font-mono text-[11.5px] text-ink-4 tabular-nums">
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="bg-surface/60 h-1.5 overflow-hidden rounded-full"
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
                "hocus:bg-surface/60 group flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  item.done
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-ink-5 bg-surface",
                )}
              >
                {item.done ? <CheckIcon className="size-2.5" /> : null}
              </span>
              <span
                className={cn(
                  "flex-1 text-[12.5px]",
                  item.done
                    ? "text-ink-4 line-through"
                    : "text-ink-1",
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
