"use client";

/**
 * Botão "+ Adicionar cliente" do header e do empty state de /admin/clientes.
 *
 * PP2 (2026-05-25): em vez de navegar pra /admin/clientes/novo (página
 * dedicada), dispara `OPEN_CUSTOMER_FORM_EVENT` com customerId=null, e o
 * CustomerFormDrawerListener global abre o drawer inline. Mesmo pattern
 * do ProductCreateButton.
 *
 * Mantém href="/admin/clientes/novo" como fallback pra Ctrl+click abrir
 * em nova aba (rota legacy virou redirect pra ?customer=new).
 */
import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  OPEN_CUSTOMER_FORM_EVENT,
  type OpenCustomerFormEventDetail,
} from "./customer-form-events";

interface CustomerCreateButtonProps {
  children?: React.ReactNode;
  className?: string;
}

function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
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
    new CustomEvent<OpenCustomerFormEventDetail>(OPEN_CUSTOMER_FORM_EVENT, {
      detail: { customerId: null },
    }),
  );
}

export function CustomerCreateButton({
  children,
  className,
}: CustomerCreateButtonProps) {
  return (
    <Link
      href="/admin/clientes/novo"
      onClick={handleClick}
      className={cn("b3-btn b3-btn--cta", className)}
    >
      {children ?? (
        <>
          <PlusIcon size={14} aria-hidden />
          <span className="hidden sm:inline">Adicionar cliente</span>
          <span className="sm:hidden">Novo</span>
        </>
      )}
    </Link>
  );
}
