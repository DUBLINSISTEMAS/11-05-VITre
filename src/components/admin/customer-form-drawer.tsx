"use client";

// Drawer de cliente — handoff PP2 (2026-05-25).
//
// Sheet slide-right 520px envolvendo o CustomerForm. Header com avatar
// verde de iniciais + nome + pill de pedidos. Body com form embedded.
// Footer custom com Excluir/Cancelar/Salvar. Bloco "Últimas vendas
// vinculadas" abaixo do form quando edit + orderCount > 0.
//
// Carregamento sob demanda: edit chama loadCustomerDetail; new usa
// initialData vazio inline. createCustomer/updateCustomer continuam
// sendo invocados dentro do CustomerForm (sem mudança no save flow).

import {
  Loader2Icon,
  ReceiptIcon,
  SaveIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCustomer } from "@/actions/customer/delete";
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
import { loadCustomerDetail } from "@/actions/customer/load";
import type { CustomerDetail } from "@/actions/customer/types";
import { loadCustomerGroups } from "@/actions/customer-group";
import { CustomerFiadoCard } from "@/components/admin/customer-fiado-card";
import {
  CustomerForm,
  type CustomerGroupOption,
  type CustomerInitialData,
} from "@/components/admin/customer-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatRelativeDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { formatBRL } from "@/lib/pricing";

const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_whatsapp: "Aguardando",
  confirmed: "Confirmado",
  fulfilled: "Cumprido",
  canceled: "Cancelado",
  expired: "Expirado",
};

interface CustomerFormDrawerProps {
  /** UUID do cliente pra editar, "new" pra modo novo, null pra fechado. */
  target: string | "new" | null;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function emptyInitialData(): CustomerInitialData {
  return {
    name: "",
    phone: "",
    type: "individual",
    document: null,
    email: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressNeighborhood: null,
    addressCity: null,
    addressState: null,
    addressZip: null,
    notes: null,
    groupId: null,
  };
}

export function CustomerFormDrawer({
  target,
  onOpenChange,
}: CustomerFormDrawerProps) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  // Audit 2026-05-26 — grupos pra select no form. Carregado 1x ao abrir.
  // Vazio quando lojista não tem nenhum grupo (Select esconde — feature
  // wholesale fica opt-in).
  const [groupOptions, setGroupOptions] = useState<CustomerGroupOption[]>([]);
  const submitRef = useRef<HTMLButtonElement | null>(null);

  const mode: "edit" | "new" | null =
    target === null ? null : target === "new" ? "new" : "edit";

  useEffect(() => {
    if (target === null || target === "new") {
      setDetail(null);
      setError(null);
      return;
    }
    setDetail(null);
    setError(null);
    startLoad(async () => {
      try {
        const res = await loadCustomerDetail(target);
        if (!res) {
          setError("Cliente não encontrado.");
          return;
        }
        setDetail(res);
      } catch (err) {
        logger.error("admin.customer.drawer_load_failed", { err, target });
        setError("Não foi possível carregar o cliente.");
      }
    });
  }, [target]);

  // Audit 2026-05-26 — carrega grupos quando drawer abre (qualquer modo).
  useEffect(() => {
    if (target === null) return;
    let cancelled = false;
    loadCustomerGroups()
      .then((groups) => {
        if (cancelled) return;
        setGroupOptions(
          groups.map((g) => ({
            id: g.id,
            name: g.name,
            defaultPricingTier: g.defaultPricingTier,
          })),
        );
      })
      .catch(() => {
        // Falha silenciosa — sem grupos, Select esconde.
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Bloco I UX (2026-05-29) — confirm() proibido pelo CLAUDE.md. AlertDialog
  // controlado por state local. Trigger explícito via deleteAskOpen.
  const [deleteAskOpen, setDeleteAskOpen] = useState(false);
  const confirmDelete = () => {
    if (!detail) return;
    setDeleteAskOpen(false);
    startDelete(async () => {
      const res = await deleteCustomer({ customerId: detail.customer.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Cliente excluído.");
      onOpenChange(false);
    });
  };
  const handleDelete = () => {
    if (!detail) return;
    setDeleteAskOpen(true);
  };

  const initialData: CustomerInitialData =
    mode === "new"
      ? emptyInitialData()
      : detail
        ? {
            name: detail.customer.name,
            phone: detail.customer.phone,
            type: detail.customer.type,
            document: detail.customer.document,
            email: detail.customer.email,
            addressStreet: detail.customer.addressStreet,
            addressNumber: detail.customer.addressNumber,
            addressComplement: detail.customer.addressComplement,
            addressNeighborhood: detail.customer.addressNeighborhood,
            addressCity: detail.customer.addressCity,
            addressState: detail.customer.addressState,
            addressZip: detail.customer.addressZip,
            notes: detail.customer.notes,
            groupId: detail.customer.groupId,
          }
        : emptyInitialData();

  const initialDataWithId =
    mode === "edit" && detail
      ? { ...initialData, id: detail.customer.id }
      : initialData;

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]"
      >
        {/* Header — avatar verde + nome + pill pedidos. */}
        <SheetHeader className="border-line shrink-0 gap-0 border-b px-5 py-4">
          <div className="flex items-start gap-3">
            <div
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold"
              style={{
                background: "var(--mangos-green-100)",
                color: "var(--mangos-green-800)",
              }}
            >
              {mode === "new" ? (
                <UserIcon className="size-4" aria-hidden />
              ) : detail ? (
                getInitials(detail.customer.name)
              ) : (
                "…"
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <SheetTitle className="text-ink-1 text-[15px] font-semibold tracking-tight">
                {mode === "new"
                  ? "Novo cliente"
                  : detail
                    ? `Editar ${detail.customer.name}`
                    : "Carregando…"}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="text-ink-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
                  {mode === "new" ? (
                    <span>Nome e telefone bastam pra começar.</span>
                  ) : detail ? (
                    detail.orderCount > 0 ? (
                      <>
                        <span className="b3-pill b3-pill--brand">
                          {detail.orderCount}{" "}
                          {detail.orderCount === 1 ? "pedido" : "pedidos"}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="font-mono">
                          {detail.customer.phone}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="b3-pill">Sem pedidos</span>
                        <span aria-hidden>·</span>
                        <span className="font-mono">
                          {detail.customer.phone}
                        </span>
                      </>
                    )
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Body — scroll vertical interno. */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {isLoading || (mode === "edit" && !detail && !error) ? (
            <DrawerLoading />
          ) : error ? (
            <DrawerError message={error} />
          ) : (
            <>
              {mode === "edit" && detail ? (
                <CustomerFiadoCard
                  summary={detail.fiadoSummary}
                  pendingReceivables={detail.pendingReceivables}
                />
              ) : null}

              <CustomerForm
                key={detail?.customer.id ?? "new"}
                mode={mode === "new" ? "create" : "edit"}
                embedded
                submitRef={submitRef}
                initialData={initialDataWithId}
                groupOptions={groupOptions}
                onAfterSave={() => {
                  onOpenChange(false);
                }}
              />

              {mode === "edit" && detail && detail.orderCount > 0 ? (
                <section className="b3-card p-4">
                  <header className="mb-3 space-y-0.5">
                    <h3 className="text-ink-1 text-[13px] font-semibold tracking-tight">
                      Últimas vendas vinculadas
                    </h3>
                    <p className="text-ink-4 text-[11px]">
                      Vendas que apontam pra este cliente.
                    </p>
                  </header>
                  <ul className="divide-line divide-y">
                    {detail.recentOrders.map((o) => (
                      <li key={o.id}>
                        <Link
                          href={`/admin/pedidos?detail=${o.id}`}
                          prefetch={false}
                          className="hocus:bg-bg-app flex items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <div className="bg-bg-app flex size-8 shrink-0 items-center justify-center rounded-md">
                            <ReceiptIcon className="text-ink-4 size-4" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-ink-1 font-mono text-[12.5px] font-medium tabular-nums">
                              {o.shortCode}
                            </p>
                            <p className="text-ink-4 text-[11.5px]">
                              {formatRelativeDate(o.createdAt)} ·{" "}
                              {ORDER_STATUS_LABEL[o.status] ?? o.status}
                            </p>
                          </div>
                          <span className="text-ink-1 font-mono text-[13px] tabular-nums">
                            {formatBRL(o.totalInCents)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>

        {/* Footer com ações — Excluir (só edit) / Cancelar / Salvar. */}
        {!error && mode !== null && (mode === "new" || detail) ? (
          <div className="border-line bg-surface shrink-0 flex flex-wrap items-center gap-2 border-t p-4">
            {mode === "edit" && detail ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="b3-btn b3-btn--sm"
                style={{ color: "var(--danger)" }}
                aria-label="Excluir cliente"
              >
                {isDeleting ? (
                  <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <TrashIcon className="size-3.5" aria-hidden />
                )}
                Excluir
              </button>
            ) : null}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="b3-btn b3-btn--sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => submitRef.current?.click()}
              className="b3-btn b3-btn--sm b3-btn--primary"
            >
              <SaveIcon className="size-3.5" aria-hidden />
              {mode === "new" ? "Cadastrar" : "Salvar"}
            </button>
          </div>
        ) : null}
      </SheetContent>

      {/* Bloco I UX (2026-05-29) — AlertDialog substitui window.confirm
          (CLAUDE.md proíbe). Detalhe: vendas vinculadas mantêm o snapshot
          do nome/telefone — cliente excluído não some do histórico. */}
      <AlertDialog open={deleteAskOpen} onOpenChange={setDeleteAskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir{" "}
              {detail ? `"${detail.customer.name}"` : "este cliente"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vendas vinculadas mantêm o snapshot do nome e telefone — o
              histórico não some. O cadastro só sai dos filtros e da
              listagem de clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              {isDeleting ? "Excluindo..." : "Excluir cliente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function DrawerLoading() {
  return (
    <div className="text-ink-4 flex items-center justify-center gap-2 py-12 text-sm">
      <Loader2Icon className="size-4 animate-spin" aria-hidden /> Carregando…
    </div>
  );
}

function DrawerError({ message }: { message: string }) {
  return (
    <div className="border-danger/30 bg-danger/5 rounded-[10px] border p-4 text-[13px] text-danger">
      <p className="font-semibold">Não foi possível abrir o cliente</p>
      <p className="mt-1 text-[12px] opacity-90">{message}</p>
    </div>
  );
}
