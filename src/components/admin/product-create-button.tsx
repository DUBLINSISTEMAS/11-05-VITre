"use client";

/**
 * Botão "+ Adicionar produto" do header e do empty state.
 *
 * Dispara `OPEN_PRODUCT_FORM_EVENT` com productId=null pro
 * ProductFormDrawerListener abrir o drawer inline (modo "new") sem
 * perder contexto da tabela. Ctrl+click cai no href real
 * (/admin/produtos?edit=new) que o listener detecta no mount.
 */
import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  OPEN_PRODUCT_FORM_EVENT,
  type OpenProductFormEventDetail,
} from "./product-form-events";

interface ProductCreateButtonProps {
  children?: React.ReactNode;
  className?: string;
  /** Tamanho do botão. `lg` adiciona altura/padding extras pra empty state CTAs. */
  size?: "default" | "lg";
}

function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
  // Modifier keys → deixa o browser abrir o href em nova aba/janela.
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  ) {
    return;
  }
  e.preventDefault();
  window.dispatchEvent(
    new CustomEvent<OpenProductFormEventDetail>(OPEN_PRODUCT_FORM_EVENT, {
      detail: { productId: null },
    }),
  );
}

export function ProductCreateButton({
  children,
  className,
  size = "default",
}: ProductCreateButtonProps) {
  return (
    <Link
      href="/admin/produtos?edit=new"
      onClick={handleClick}
      className={cn(
        "b3-btn b3-btn--cta",
        size === "lg" && "h-11 px-5 text-[14px]",
        className,
      )}
    >
      {children ?? (
        <>
          <PlusIcon size={14} />
          <span className="hidden sm:inline">Adicionar produto</span>
          <span className="sm:hidden">Adicionar</span>
        </>
      )}
    </Link>
  );
}
