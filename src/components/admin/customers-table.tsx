"use client";

// Lista de clientes — port Dublin v3 (ADR-0019, Onda A.9).
// REWRITE pra usar `b3-tbl` canônico (substitui grid custom Onda A.5i).
// Mobile responsivo: CSS @media (max-width: 640px) em globals.css faz
// thead esconder e tbody tr virar block stack (já no globals).
//
// Cada row é clicável (router.push pra /admin/clientes/[id]).
// Bulk actions ficam fora desta onda; não renderizamos controles mortos.
//
// Decisões pixel-perfect vs handoff (B3ClientesScreen) + schema:
// - schema `customer` NÃO tem `group` (Padrão/Silver/Gold) — esses
//   chegam com ADR-0026 (Onda B3.2). Por enquanto coluna TIPO mostra
//   PF/PJ (ADR-0021), quando B3.2 landa renomeia/adiciona Grupo.
// - schema NÃO tem `status` (ativo/inativo) — coluna sempre "● Ativo"
//   pill --ok. Soft-delete viria com B.x futuro.
// - schema agora TEM `document` (CPF/CNPJ) via ADR-0021 — segunda linha
//   da célula Nome mostra documento formatado quando preenchido, senão
//   cai pra cidade/UF como antes.
// - WhatsApp pill (`b3-wa`) é link wa.me/<E.164> — clica e abre WA já com
//   contato pronto.

import { MessageCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import type { CustomerType } from "@/db/schema";
import { formatDocument } from "@/lib/document";
import { formatRelativeDate } from "@/lib/format";

export interface CustomerTableRow {
  id: string;
  name: string;
  /** E.164: +5511999999999 */
  phone: string;
  email: string | null;
  /** ADR-0021 — PF/PJ. Pill na coluna Tipo. */
  type: CustomerType;
  /** ADR-0021 — CPF/CNPJ só dígitos. Renderizado formatado na 2ª linha do Nome. */
  document: string | null;
  addressCity: string | null;
  addressState: string | null;
  createdAt: Date;
}

interface CustomersTableProps {
  customers: ReadonlyArray<CustomerTableRow>;
}

/**
 * Retorna iniciais (até 2) pra preencher avatar circular.
 * "João Mario" → "JM", "Sandra" → "SA".
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** wa.me URL a partir de E.164 — strip "+" porque wa.me não aceita. */
function whatsappHref(phoneE164: string): string {
  const digits = phoneE164.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}

export function CustomersTable({ customers }: CustomersTableProps) {
  const router = useRouter();

  return (
    <table className="b3-tbl">
      <thead>
        <tr>
          <th>Foto</th>
          <th>Nome</th>
          <th>Contato</th>
          <th>Tipo</th>
          <th style={{ paddingRight: 20, textAlign: "right" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((c) => {
          const cityUf = [c.addressCity, c.addressState]
            .filter(Boolean)
            .join(" / ");
          // ADR-0021 — doc tem prioridade sobre cidade/UF na 2ª linha do nome.
          const docFormatted = c.document ? formatDocument(c.document, c.type) : "";
          const secondaryLine = docFormatted || cityUf;
          return (
            <tr
              key={c.id}
              onClick={() => router.push(`/admin/clientes/${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/admin/clientes/${c.id}`);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Abrir cliente ${c.name}`}
              className="cursor-pointer outline-none focus-visible:bg-bg-app"
            >
              <td>
                <div className="flex items-center gap-2.5">
                  <span className="b3-avatar">{initialsOf(c.name)}</span>
                  <a
                    href={whatsappHref(c.phone)}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="b3-wa"
                    aria-label={`Abrir WhatsApp de ${c.name}`}
                  >
                    <MessageCircleIcon size={14} aria-hidden />
                  </a>
                </div>
              </td>
              <td>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                {secondaryLine ? (
                  <div
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-4)",
                      marginTop: 2,
                    }}
                  >
                    {secondaryLine}
                  </div>
                ) : null}
              </td>
              <td>
                <div className="mono">{c.phone}</div>
                {c.email ? (
                  <div
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      color: "var(--brand)",
                      marginTop: 2,
                    }}
                  >
                    {c.email}
                  </div>
                ) : null}
              </td>
              <td>
                <span className="b3-pill">
                  {c.type === "company" ? "PJ" : "PF"}
                </span>
              </td>
              <td style={{ textAlign: "right", paddingRight: 20 }}>
                <span
                  className="b3-pill b3-pill--ok"
                  title={`Cadastrado ${formatRelativeDate(c.createdAt)}`}
                >
                  ● Ativo
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
