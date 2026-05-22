"use client";

import {
  CheckIcon,
  Link2Icon,
  Link2OffIcon,
  Loader2Icon,
  SearchIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type CustomerSearchHit,
  searchCustomers,
} from "@/actions/customer/search";
import {
  createAndLinkCustomerFromOrder,
  linkOrderToCustomer,
} from "@/actions/order/link-customer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LinkedCustomer {
  id: string;
  name: string;
  phone: string;
}

interface CustomerLinkSectionProps {
  orderId: string;
  linkedCustomer: LinkedCustomer | null;
  /** Snapshots do pedido (nome/phone que vieram no payload do checkout). */
  snapshotName: string;
  snapshotPhone: string | null;
  onChange: () => void;
}

/**
 * Bloco "Cliente cadastrado" no detalhe do pedido (Fase 3 — ADR-0014
 * follow-up).
 *
 * Estados:
 *   - SEM vínculo: combobox de busca + botão "criar a partir deste pedido"
 *   - COM vínculo: card com nome/phone + Link pro detalhe + botão "desvincular"
 *
 * NÃO mexe nos snapshots `customer_name`/`customer_phone` — esses são
 * histórico imutável do momento da compra. Vínculo é metadado adicional.
 */
export function CustomerLinkSection({
  orderId,
  linkedCustomer,
  snapshotName,
  snapshotPhone,
  onChange,
}: CustomerLinkSectionProps) {
  const [isPending, startTransition] = useTransition();

  if (linkedCustomer) {
    const handleUnlink = () => {
      startTransition(async () => {
        const result = await linkOrderToCustomer({
          orderId,
          customerId: null,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Vínculo removido.");
        onChange();
      });
    };

    return (
      <section className="b3-card space-y-3 p-4">
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
            Cliente cadastrado
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={isPending}
            className="text-ink-4"
          >
            {isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <Link2OffIcon className="size-3.5" />
            )}
            Desvincular
          </Button>
        </header>
        <Link
          href={`/admin/clientes/${linkedCustomer.id}`}
          prefetch
          className="hocus:bg-bg-app group flex items-center gap-3 rounded-lg border border-line bg-surface p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <div className="bg-brand-wash text-brand flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold">
            {linkedCustomer.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-ink-1">
              {linkedCustomer.name}
            </p>
            <p className="text-ink-4 font-mono text-[11.5px] leading-tight">
              {linkedCustomer.phone}
            </p>
          </div>
          <Link2Icon className="text-ink-5 group-hover:text-ink-1 size-4 shrink-0 transition-colors" />
        </Link>
      </section>
    );
  }

  // SEM vínculo — combobox + criar-a-partir
  return (
    <UnlinkedSection
      orderId={orderId}
      snapshotName={snapshotName}
      snapshotPhone={snapshotPhone}
      onChange={onChange}
    />
  );
}

interface UnlinkedSectionProps {
  orderId: string;
  snapshotName: string;
  snapshotPhone: string | null;
  onChange: () => void;
}

function UnlinkedSection({
  orderId,
  snapshotName,
  snapshotPhone,
  onChange,
}: UnlinkedSectionProps) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerSearchHit[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const [isLinking, startLink] = useTransition();
  const [isCreating, startCreate] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchCustomers(q);
        setHits(results);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  // Click-outside fecha dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLink = (customerId: string) => {
    startLink(async () => {
      const result = await linkOrderToCustomer({ orderId, customerId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cliente vinculado.");
      setShowResults(false);
      onChange();
    });
  };

  const handleCreateFromOrder = () => {
    startCreate(async () => {
      const result = await createAndLinkCustomerFromOrder({ orderId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cliente criado e vinculado.");
      onChange();
    });
  };

  const busy = isLinking || isCreating;

  return (
    <section className="b3-card space-y-3 p-4">
      <header className="space-y-0.5">
        <h3 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
          Cliente cadastrado
        </h3>
        <p className="text-ink-4 text-xs leading-relaxed">
          Vincule a um cliente do seu cadastro pra ter histórico unificado.
          Os dados deste pedido (<span className="font-medium">{snapshotName}</span>{" "}
          {snapshotPhone ? (
            <>
              {" "}/ <span className="font-mono">{snapshotPhone}</span>
            </>
          ) : null}) ficam
          preservados independente do vínculo.
        </p>
      </header>

      <div ref={containerRef} className="relative space-y-2">
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="text-ink-4 pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            inputMode="search"
            placeholder="Buscar por nome, telefone ou CPF/CNPJ…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setShowResults(true)}
            className="pl-9"
            disabled={busy}
          />
          {isSearching ? (
            <Loader2Icon className="text-ink-4 absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
          ) : null}
        </div>

        {showResults ? (
          <div className="bg-popover absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line shadow-md">
            {hits.length === 0 ? (
              <div className="text-ink-4 flex flex-col items-center gap-1 px-3 py-4 text-center text-xs">
                <UsersIcon className="size-5 opacity-50" />
                <span>Nenhum cliente encontrado.</span>
              </div>
            ) : (
              <ul className="divide-line divide-y">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => handleLink(h.id)}
                      disabled={busy}
                      className={cn(
                        "hocus:bg-bg-app flex w-full items-center gap-2.5 px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                        busy && "opacity-50",
                      )}
                    >
                      <div className="bg-brand-wash text-brand flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                        {h.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium leading-tight text-ink-1">
                          {h.name}
                        </p>
                        <p className="text-ink-4 font-mono text-[11px] leading-tight">
                          {h.phone}
                        </p>
                      </div>
                      <CheckIcon className="text-ink-5 size-4 shrink-0 transition-colors group-hover:text-ink-1" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-1">
          <span className="text-ink-4 text-[11px]">ou</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateFromOrder}
            disabled={busy}
          >
            {isCreating ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <UserPlusIcon />
            )}
            Criar cliente a partir deste pedido
          </Button>
        </div>
      </div>
    </section>
  );
}
