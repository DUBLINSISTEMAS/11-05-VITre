"use client";

// Modal de "Nova venda" — consolidação UX 2026-05-21.
//
// O lojista hoje tem 2 entradas no sidebar pra mesma operação: "Venda
// balcão" (full-page PDV) e "Vendas" (listing). Decisão do founder:
// unificar em "Vendas". Listing fica como ponto de entrada; nova venda
// abre como modal aqui, consumindo o PdvShell intacto.
//
// Regras de fechamento (proteção contra perda de carrinho):
//   - Clicar fora NÃO fecha (preventDefault em onPointerDownOutside +
//     onInteractOutside)
//   - ESC NÃO fecha (preventDefault em onEscapeKeyDown)
//   - Só fecha via setinha "Voltar" (esquerda do header) ou "X" (direita)
//
// Backdrop: bg-black/30 + backdrop-blur-sm dá o "destaque profissional"
// sem chamar atenção.
//
// Truque do height: PdvShell é `h-[calc(100vh-4rem)]` (tela cheia). Dentro
// do modal de 92vh, isso estoura o container. O wrapper aplica
// `[&>div]:!h-full` (variante arbitrária Tailwind) pra sobrescrever a
// altura do primeiro div do PdvShell sem editar suas 2200+ linhas.
//
// CashSessionStatus FORA do modal (audit 2026-05-21) — agora vive na
// página `/admin/pedidos` acima do listing. Decisão founder: dentro do
// modal pollu o fluxo de venda; melhor ver status do caixa na listagem
// e clicar pra abrir/fechar caixa lá.
//
// A rota standalone `/admin/pdv` segue viva — fallback pra deep link e
// pra quando o lojista preferir página cheia. Sai do sidebar mas continua
// acessível via URL direta.

import { ArrowLeftIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";

import { cn } from "@/lib/utils";

// PdvShell tem ~2200 linhas + várias deps próprias. Dynamic import com
// ssr:false faz o chunk baixar só quando o modal abre — initial bundle
// de /admin/pedidos fica leve pro lojista que só quer ver o listing.
// O loading fica escondido sob a animação 150ms de zoom-in do Radix.
const PdvShell = dynamic(
  () =>
    import("@/components/admin/pdv/pdv-shell").then((m) => ({
      default: m.PdvShell,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="text-ink-4 size-6 animate-spin" aria-hidden />
        <span className="sr-only">Carregando PDV…</span>
      </div>
    ),
  },
);

export function NewSaleModalButton() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button type="button" className="b3-btn b3-btn--cta">
          <PlusIcon size={14} aria-hidden /> Nova venda
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm",
            "duration-[150ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        />

        {/* Container do modal — quase a viewport inteira em desktop, tela
            cheia em mobile (rounded-none). Marker `data-pdv-modal` é
            usado pelo handler de F-keys do PdvShell pra distinguir
            este modal (que CONTÉM o PdvShell) de sub-dialogs que abrem
            por cima (ex: ProductPickerDialog, QuickSale) — F-keys
            disparam normalmente dentro deste, mas skipam quando o foco
            está num descendente que não é este. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-pdv-modal="true"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            "bg-surface fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col outline-none",
            "h-dvh w-screen rounded-none",
            "lg:h-[92vh] lg:max-h-[920px] lg:w-[95vw] lg:max-w-[1400px] lg:rounded-[20px]",
            "lg:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25),0_4px_12px_-6px_rgba(0,0,0,0.1)]",
            "duration-[150ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          {/* ── Header sticky 56px: voltar / título / fechar ── */}
          <header
            className={cn(
              "flex h-14 shrink-0 items-center justify-between",
              "border-line border-b px-3",
            )}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Voltar"
              className={cn(
                "text-ink-4 inline-flex size-8 items-center justify-center rounded-md outline-none",
                "hocus:bg-bg-app hocus:text-ink-2 transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
            >
              <ArrowLeftIcon className="size-4" strokeWidth={1.6} aria-hidden />
            </button>

            <DialogPrimitive.Title
              className={cn(
                "text-ink-1 text-[15px] font-semibold tracking-[-0.01em]",
                "max-w-[60vw] truncate sm:max-w-none",
              )}
            >
              Nova venda · Balcão
            </DialogPrimitive.Title>

            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className={cn(
                "text-ink-4 inline-flex size-8 items-center justify-center rounded-md outline-none",
                "hocus:bg-bg-app hocus:text-ink-2 transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
            >
              <XIcon className="size-4" strokeWidth={1.6} aria-hidden />
            </button>
          </header>

          {/* ── Body: só o PdvShell. CashSessionStatus saiu do modal e
              ficou na página /admin/pedidos (acima do listing). ── */}
          <div className="flex flex-1 flex-col overflow-hidden p-3 sm:p-4">
            {/* Wrapper que força o PdvShell (h-[calc(100vh-...)]) a ocupar
                APENAS o espaço restante do modal. A variante arbitrária
                [&>div]:!h-full sobrescreve a altura do primeiro div do
                PdvShell, sem precisar editar suas 2200+ linhas. */}
            <div className="flex-1 min-h-0 overflow-hidden [&>div]:!h-full">
              <PdvShell />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
