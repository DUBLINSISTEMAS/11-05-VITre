"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_ALL = "__all__";
const CHANNEL_ALL = "__all__";

const STATUS_OPTIONS = [
  { value: STATUS_ALL, label: "Todos" },
  { value: "awaiting_whatsapp", label: "Aguardando WhatsApp" },
  { value: "confirmed", label: "Confirmados" },
  { value: "fulfilled", label: "Cumpridos" },
  { value: "canceled", label: "Cancelados" },
  { value: "expired", label: "Expirados" },
];

const CHANNEL_OPTIONS = [
  { value: CHANNEL_ALL, label: "Todos os canais" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "balcao", label: "Balcão (PDV)" },
];

/**
 * Filtros da lista de pedidos. URL-driven, mesmo padrão dos produtos.
 *  - `q`: matching por shortCode (ex: "A7K2")
 *  - `status`: enum
 */
export function OrdersFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? STATUS_ALL;
  const canal = searchParams.get("canal") ?? CHANNEL_ALL;

  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    const handler = setTimeout(() => {
      const usp = new URLSearchParams(window.location.search);
      const current = usp.get("q") ?? "";
      if (q === current) return;
      const trimmed = q.trim();
      if (trimmed) usp.set("q", trimmed.toUpperCase());
      else usp.delete("q");
      usp.delete("page");
      startTransition(() => {
        router.replace(`?${usp.toString()}`, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [q, router]);

  const updateStatus = (value: string) => {
    const usp = new URLSearchParams(window.location.search);
    if (value === STATUS_ALL) usp.delete("status");
    else usp.set("status", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  const updateCanal = (value: string) => {
    const usp = new URLSearchParams(window.location.search);
    if (value === CHANNEL_ALL) usp.delete("canal");
    else usp.set("canal", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  const clearAll = () => {
    setQ("");
    startTransition(() => {
      router.replace("?", { scroll: false });
    });
  };

  const hasAny =
    q.trim() !== "" || status !== STATUS_ALL || canal !== CHANNEL_ALL;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
      <div className="relative flex-1 sm:max-w-xs">
        <SearchIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          inputMode="search"
          placeholder="Código do pedido (ex: A7K2)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 uppercase"
          aria-label="Buscar pedidos por código"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={updateStatus}>
          <SelectTrigger className="w-full min-w-44 sm:w-auto">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={canal} onValueChange={updateCanal}>
          <SelectTrigger className="w-full min-w-40 sm:w-auto">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasAny ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground"
          >
            <XIcon className="size-4" /> Limpar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
