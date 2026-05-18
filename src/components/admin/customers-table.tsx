"use client";

// Lista de clientes — port Dublin v3 (ADR-0019, Onda A.9).
// REWRITE pra usar `b3-tbl` canônico (substitui grid custom Onda A.5i).
// Mobile responsivo: CSS @media (max-width: 640px) em globals.css faz
// thead esconder e tbody tr virar block stack (já no globals).
//
// Cada row é clicável (router.push pra /admin/clientes/[id]). Checkbox
// per-row é placeholder visual (bulk actions ficam pra onda futura).
//
// Decisões pixel-perfect vs handoff (B3ClientesScreen) + schema:
// - schema `customer` NÃO tem `group` (Padrão/Silver/Gold) — esses
//   chegam com ADR-0022 (Onda B.3). Por enquanto coluna GRUPO sempre
//   renderiza "Padrão" pill default. Não esconde a coluna pra preservar
//   fidelidade visual da grid (memory `pixel-perfect-soon-placeholder-pattern`).
// - schema NÃO tem `status` (ativo/inativo) — coluna sempre "● Ativo"
//   pill --ok. Soft-delete viria com B.x futuro.
// - schema NÃO tem `doc` (CPF/CNPJ) — célula NOME mostra cidade/UF como
//   segunda linha em vez de doc (handoff mostra doc, adaptamos pro que temos).
// - WhatsApp pill (`b3-wa`) é link wa.me/<E.164> — clica e abre WA já com
//   contato pronto.

import { MessageCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { formatRelativeDate } from "@/lib/format";

export interface CustomerTableRow {
  id: string;
  name: string;
  /** E.164: +5511999999999 */
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
          <th style={{ paddingLeft: 20, width: 28 }}>
            <span className="sr-only">Selecionar</span>
          </th>
          <th>Foto</th>
          <th>Nome</th>
          <th>Contato</th>
          <th>Grupo</th>
          <th style={{ paddingRight: 20, textAlign: "right" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((c) => {
          const cityUf = [c.addressCity, c.addressState]
            .filter(Boolean)
            .join(" / ");
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
              <td style={{ paddingLeft: 20 }}>
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${c.name}`}
                  onClick={(e) => e.stopPropagation()}
                  disabled
                  className="cursor-not-allowed opacity-50"
                />
              </td>
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
                {cityUf ? (
                  <div
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-4)",
                      marginTop: 2,
                    }}
                  >
                    {cityUf}
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
                <span className="b3-pill">Padrão</span>
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
