"use client";

import {
  CheckCircle2Icon,
  ClockIcon,
  MessageSquareTextIcon,
  SearchIcon,
  TrashIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { LeadRow, LeadStats } from "@/actions/lead/types";
import { deleteLead, updateLead } from "@/actions/lead/update";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_LABEL: Record<LeadRow["status"], string> = {
  new: "Novo",
  contacted: "Contatado",
  converted: "Convertido",
  lost: "Perdido",
};
const STATUS_PILL: Record<LeadRow["status"], string> = {
  new: "b3-pill b3-pill--brand",
  contacted: "b3-pill b3-pill--warn",
  converted: "b3-pill b3-pill--ok",
  lost: "b3-pill b3-pill--danger",
};

const SOURCE_LABEL: Record<LeadRow["source"], string> = {
  pdp_button: "PDP",
  list_button: "Listagem",
  cart_button: "Sacola",
  contact_form: "Contato",
  other: "Outro",
};

export function LeadsList({
  rows,
  total,
  page,
  pageSize,
  stats,
  filters,
}: {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: LeadStats;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const [leadToDelete, setLeadToDelete] = useState<LeadRow | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applyParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== "") params.set(k, v);
    }
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.replace(`/admin/contatos?${params.toString()}`);
  }

  function setStatus(id: string, status: LeadRow["status"]) {
    startTransition(async () => {
      const res = await updateLead({ id, status });
      if (res.ok) toast.success(`Marcado como ${STATUS_LABEL[status]}.`);
      else toast.error(res.error);
    });
  }

  function handleDelete(lead: LeadRow) {
    startTransition(async () => {
      const res = await deleteLead({ id: lead.id });
      if (res.ok) {
        toast.success("Recado do site excluído.");
        setLeadToDelete(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Novos hoje" value={stats.newToday} tone="brand" />
        <StatCard
          label="Convertidos no mês"
          value={stats.convertedThisMonth}
          tone="ok"
        />
      </div>

      {/* Filtros */}
      <div className="b3-toolbar flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon
            size={14}
            className="text-ink-4 absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            type="text"
            className="b3-input w-full pl-9"
            placeholder="Buscar nome ou telefone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                applyParams({ q: q.trim() || null, page: "1" });
            }}
          />
        </div>
        <select
          className="b3-input"
          value={filters.status ?? ""}
          onChange={(e) =>
            applyParams({ status: e.target.value || null, page: "1" })
          }
        >
          <option value="">Todos status</option>
          {(["new", "contacted", "converted", "lost"] as const).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        (filters.q ?? filters.status) ? (
          <div className="b3-card b3-card-pad text-center">
            <p className="text-ink-3 text-[13px]">
              Nenhum recado encontrado com esses filtros.
            </p>
            <p className="text-ink-4 mt-1 text-[12px]">
              Limpe a busca ou troque o status pra ver os outros.
            </p>
          </div>
        ) : (
          <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
            <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
              <MessageSquareTextIcon className="size-6" />
            </div>
            <h2 className="text-ink-1 text-lg font-semibold">
              Ainda sem recados
            </h2>
            <p className="text-ink-4 max-w-sm text-sm">
              Quando algum cliente clicar em &ldquo;Pedir pelo WhatsApp&rdquo;
              na sua loja online, o recado dele aparece aqui.
            </p>
          </div>
        )
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-tbl w-full">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Produto</th>
                <th>Origem</th>
                <th>Cliente</th>
                <th>Status</th>
                <th style={{ width: 180 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id}>
                  <td className="text-ink-3 mono text-[12px]">
                    {formatRelativeTime(lead.createdAt)}
                  </td>
                  <td>
                    {lead.productId ? (
                      <Link
                        href={`/admin/produtos?edit=${lead.productId}`}
                        className="text-ink-1 hover:text-brand text-[13px]"
                      >
                        {lead.productName ?? "(produto removido)"}
                      </Link>
                    ) : (
                      <span className="text-ink-4 text-[12.5px]">—</span>
                    )}
                  </td>
                  <td className="text-ink-3 text-[12px]">
                    {SOURCE_LABEL[lead.source]}
                  </td>
                  <td>
                    {lead.customerId && lead.customerDisplayName ? (
                      <Link
                        href={`/admin/clientes?customer=${lead.customerId}`}
                        className="text-ink-1 hover:text-brand text-[13px]"
                      >
                        {lead.customerDisplayName}
                      </Link>
                    ) : lead.customerName ? (
                      <span className="text-ink-2 text-[13px]">
                        {lead.customerName}
                      </span>
                    ) : (
                      <span className="text-ink-4 text-[12.5px]">Anônimo</span>
                    )}
                  </td>
                  <td>
                    <span className={STATUS_PILL[lead.status]}>
                      {STATUS_LABEL[lead.status]}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setStatus(lead.id, "contacted")}
                        className="b3-btn b3-btn--sm"
                        disabled={isPending || lead.status === "contacted"}
                        title="Marcar contatado"
                      >
                        <ClockIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(lead.id, "converted")}
                        className="b3-btn b3-btn--sm"
                        disabled={isPending || lead.status === "converted"}
                        title="Marcar convertido"
                        style={{ color: "var(--ok)" }}
                      >
                        <CheckCircle2Icon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(lead.id, "lost")}
                        className="b3-btn b3-btn--sm"
                        disabled={isPending || lead.status === "lost"}
                        title="Marcar perdido"
                        style={{ color: "var(--danger)" }}
                      >
                        <XCircleIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeadToDelete(lead)}
                        className="b3-btn b3-btn--sm"
                        disabled={isPending}
                        title="Excluir"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-ink-3">
            Página {page} de {totalPages} · {total} no total
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="b3-btn b3-btn--sm"
              disabled={page === 1}
              onClick={() => applyParams({ page: String(page - 1) })}
            >
              Anterior
            </button>
            <button
              type="button"
              className="b3-btn b3-btn--sm"
              disabled={page === totalPages}
              onClick={() => applyParams({ page: String(page + 1) })}
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <AlertDialog
        open={leadToDelete !== null}
        onOpenChange={(open) => !open && setLeadToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recado do site?</AlertDialogTitle>
            <AlertDialogDescription>
              O histórico deste contato sai da fila de atendimento. Produto,
              cliente e vendas vinculadas não são alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || leadToDelete === null}
              onClick={(event) => {
                event.preventDefault();
                if (leadToDelete) handleDelete(leadToDelete);
              }}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              {isPending ? "Excluindo..." : "Excluir recado"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "brand" | "ok";
}) {
  const color =
    tone === "brand"
      ? "var(--brand)"
      : tone === "ok"
        ? "var(--ok)"
        : "var(--ink-1)";
  return (
    <div className="b3-card b3-card-pad">
      <div className="text-ink-4 text-[11px] tracking-[0.06em] uppercase">
        {label}
      </div>
      <div
        className="mono mt-1 text-[22px] font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function formatRelativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
