"use client";

import { Loader2Icon, ReceiptIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCustomer } from "@/actions/customer/delete";
import {
  CustomerForm,
  type CustomerInitialData,
} from "@/components/admin/customer-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/format";
import { formatBRL } from "@/lib/pricing";

interface RecentOrderRow {
  id: string;
  shortCode: string;
  totalInCents: number;
  status: string;
  createdAt: Date;
}

interface EditCustomerFormProps {
  initialData: CustomerInitialData & { id: string };
  recentOrders: RecentOrderRow[];
  orderCount: number;
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_whatsapp: "Aguardando",
  confirmed: "Confirmado",
  fulfilled: "Cumprido",
  canceled: "Cancelado",
  expired: "Expirado",
};

/**
 * Página de edição de cliente (Fase 3 — ADR-0014).
 *
 * Form de edição + bloco "Últimos pedidos vinculados" + AlertDialog de
 * exclusão. Delete usa ON DELETE SET NULL — pedidos históricos ficam
 * preservados (snapshot `customer_name`/`customer_phone` na própria
 * linha de order).
 */
export function EditCustomerForm({
  initialData,
  recentOrders,
  orderCount,
}: EditCustomerFormProps) {
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteCustomer({ customerId: initialData.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cliente excluído.");
      router.push("/admin/clientes");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <CustomerForm
        mode="edit"
        initialData={initialData}
        onAfterSave={() => {
          router.refresh();
        }}
      />

      {/* Histórico — só renderiza se há vínculos */}
      {orderCount > 0 ? (
        <section className="b3-card p-4 sm:p-5">
          <header className="mb-3 flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h2 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
                Últimas vendas vinculadas
              </h2>
              <p className="text-ink-4 text-xs">
                Vendas que apontam pra este cliente. Histórico antigo sem
                vínculo aparece direto em <code>/admin/pedidos</code>.
              </p>
            </div>
          </header>
          <ul className="divide-line divide-y">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/pedidos?q=${encodeURIComponent(o.shortCode)}`}
                  prefetch={false}
                  className="hocus:bg-bg-app flex items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <div className="bg-bg-app flex size-8 shrink-0 items-center justify-center rounded-md">
                    <ReceiptIcon className="text-ink-4 size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12.5px] font-medium tabular-nums text-ink-1">
                      {o.shortCode}
                    </p>
                    <p className="text-ink-4 text-[11.5px]">
                      {formatRelativeDate(o.createdAt)} ·{" "}
                      {ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </p>
                  </div>
                  <span className="font-mono text-[13px] tabular-nums text-ink-1">
                    {formatBRL(o.totalInCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Danger zone — exclusão */}
      <section className="border-destructive/30 rounded-xl border p-4 sm:p-5">
        <header className="mb-3 space-y-0.5">
          <h2 className="text-destructive text-[13.5px] font-semibold tracking-tight">
            Excluir cliente
          </h2>
          <p className="text-ink-4 text-xs leading-relaxed">
            Vendas vinculadas <strong>não</strong> são apagadas — elas
            mantêm nome e telefone do momento da compra, só perdem o
            vínculo ativo com este cliente.
          </p>
        </header>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={isDeleting}
            >
              <Trash2Icon /> Excluir cliente
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                {initialData.name} ({initialData.phone}) será removido do
                seu cadastro. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2Icon className="animate-spin" /> Excluindo…
                  </>
                ) : (
                  "Excluir cliente"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
