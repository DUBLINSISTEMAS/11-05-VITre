"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { formatRelativeDate } from "@/lib/format";

export interface CustomerTableRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  addressCity: string | null;
  addressState: string | null;
  createdAt: Date;
}

interface CustomersTableProps {
  customers: ReadonlyArray<CustomerTableRow>;
}

/**
 * Lista de clientes do admin (Fase 3 — ADR-0014).
 *
 * Cada row é um <Link> pra /admin/clientes/[id] (page-mode, padrão Vitrê
 * pra forms grandes — memory `admin-form-grande-page-not-modal.md`).
 */
export function CustomersTable({ customers }: CustomersTableProps) {
  return (
    <>
      {/* Desktop */}
      <div className="bg-card hidden overflow-hidden rounded-xl border shadow-sm lg:block">
        <div
          role="rowgroup"
          className="text-eyebrow bg-muted/50 grid grid-cols-[minmax(0,1.4fr)_minmax(0,160px)_minmax(0,1fr)_minmax(0,130px)_32px] items-center gap-4 border-b px-4 py-2.5"
        >
          <span>Nome</span>
          <span>Telefone</span>
          <span>Cidade / E-mail</span>
          <span>Cadastrado</span>
          <span aria-hidden />
        </div>

        <ul className="divide-border divide-y">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/clientes/${c.id}`}
                prefetch
                className="hocus:bg-accent/40 group grid grid-cols-[minmax(0,1.4fr)_minmax(0,160px)_minmax(0,1fr)_minmax(0,130px)_32px] items-center gap-4 px-4 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="min-w-0 truncate font-medium">{c.name}</span>
                <span className="font-mono text-[12.5px] tabular-nums">{c.phone}</span>
                <span className="text-muted-foreground min-w-0 truncate text-[12.5px]">
                  {[
                    [c.addressCity, c.addressState].filter(Boolean).join(" / "),
                    c.email,
                  ]
                    .filter((v) => v && v.length > 0)
                    .join(" · ") || "—"}
                </span>
                <span className="text-muted-foreground text-[12.5px]">
                  {formatRelativeDate(c.createdAt)}
                </span>
                <span
                  aria-hidden
                  className="text-muted-foreground/60 group-hover:text-foreground flex justify-end transition-colors"
                >
                  <ChevronRightIcon className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile */}
      <ul className="divide-border divide-y overflow-hidden rounded-xl border bg-card lg:hidden">
        {customers.map((c) => (
          <li key={c.id}>
            <Link
              href={`/admin/clientes/${c.id}`}
              prefetch
              className="hocus:bg-accent/40 group flex w-full items-center gap-2.5 px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium leading-tight">{c.name}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-[11.5px] leading-tight">
                  <span className="font-mono tabular-nums">{c.phone}</span>
                  {c.addressCity ? <> · {c.addressCity}</> : null}
                </p>
              </div>
              <ChevronRightIcon
                aria-hidden
                className="text-muted-foreground/60 size-4 shrink-0"
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
