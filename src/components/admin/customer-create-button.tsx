"use client";

/**
 * Botão "+ Adicionar cliente" do header e do empty state de /admin/clientes.
 *
 * Dispara `OPEN_CUSTOMER_FORM_EVENT` com customerId=null pro
 * CustomerFormDrawerListener abrir o drawer inline. Ctrl+click cai no
 * href real (/admin/clientes?customer=new) que o listener detecta no mount.
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
      href="/admin/clientes?customer=new"
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
