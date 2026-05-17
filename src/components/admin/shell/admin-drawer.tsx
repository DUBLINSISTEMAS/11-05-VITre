"use client";

// AdminDrawer — right slide-over 480px portal-based (Dublin v3, ADR-0019).
//
// Adoção restrita a forms curtos (3-7 campos) e detalhes de leitura
// (pedido, cliente snapshot). Forms grandes (produto, configurações
// pesadas) seguem em página dedicada — ver memory
// `admin-form-grande-page-not-modal` (Shopify pattern).
//
// Por dentro usa Radix Dialog (Sheet do shadcn) com classes `b3-drawer*`
// definidas em globals.css na Onda 1 — anima slide + fade automático.
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface AdminDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Conteúdo do rodapé (botões de ação). Renderiza só se presente. */
  footer?: ReactNode;
  /** Largura máxima override. Default: 480px Dublin. */
  maxWidth?: number;
}

export function AdminDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = 480,
}: AdminDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          "flex h-full flex-col gap-0 p-0",
          "border-l border-line bg-surface",
        )}
        style={{ maxWidth: `${maxWidth}px`, width: "100%" }}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-line px-6 py-[18px]">
          <div className="min-w-0 flex-1">
            <SheetTitle className="m-0 truncate text-[19px] font-bold tracking-[-0.02em] text-ink-1">
              {title}
            </SheetTitle>
            {description ? (
              <p className="mt-0.5 truncate text-[12.5px] text-ink-4">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="ml-3 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hocus:bg-bg-app hocus:text-ink-1 focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Fechar"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-line bg-surface px-6 py-[14px] pb-[18px]">
            {footer}
          </footer>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
