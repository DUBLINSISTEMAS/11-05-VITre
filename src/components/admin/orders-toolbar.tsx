"use client";

// Toolbar da lista de pedidos — port Dublin v3 (ADR-0019, Onda A.6).
// Substitui `OrdersFilters` antigo. URL-driven:
//   - q: busca por shortCode (uppercase) OU substring do nome do cliente
//   - canal: enum whatsapp|balcao (filtro nativo b3-select)
// Status virou OrdersStatusTabs (componente separado).
// Buttons "Hoje" e "Filtros" são placeholders (toast "em breve") até
// onda futura adicionar date-picker + filtros avançados.
import { CalendarIcon, FilterIcon, SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

interface OrdersToolbarProps {
  /** Range visual "X – Y de Z" pro counter da direita. */
  rangeStart: number;
  rangeEnd: number;
  total: number;
}

export function OrdersToolbar({
  rangeStart,
  rangeEnd,
  total,
}: OrdersToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const canal = searchParams.get("canal") ?? "";

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

  const updateCanal = (value: string) => {
    const usp = new URLSearchParams(window.location.search);
    if (!value) usp.delete("canal");
    else usp.set("canal", value);
    usp.delete("page");
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  const handleSoon = (label: string) => {
    toast.info(`${label} chega em breve.`);
  };

  return (
    <div className="b3-toolbar">
      <input
        type="checkbox"
        aria-label="Selecionar todos (em breve)"
        title="Bulk actions chegam em breve"
        disabled
        className="cursor-not-allowed opacity-50"
      />
      <div className="b3-toolbar-search">
        <SearchIcon size={14} aria-hidden />
        <input
          type="search"
          inputMode="search"
          placeholder="Procurar por código ou cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar vendas"
        />
      </div>
      <button
        type="button"
        className="b3-btn b3-btn--sm"
        onClick={() => handleSoon("Filtro por data")}
      >
        <CalendarIcon size={13} /> Hoje
      </button>
      <button
        type="button"
        className="b3-btn b3-btn--sm"
        onClick={() => handleSoon("Filtros avançados")}
      >
        <FilterIcon size={13} /> Filtros
      </button>
      <select
        className="b3-select"
        style={{ width: 150, height: 32, fontSize: 12.5 }}
        value={canal}
        onChange={(e) => updateCanal(e.target.value)}
        aria-label="Filtrar por canal"
      >
        <option value="">Todos os canais</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="balcao">Balcão (PDV)</option>
      </select>
      <div style={{ flex: 1 }} />
      <span
        className="mono"
        style={{ fontSize: 12, color: "var(--ink-4)" }}
        aria-live="polite"
      >
        {total === 0
          ? "0 vendas"
          : `${rangeStart} – ${rangeEnd} de ${total}`}
      </span>
    </div>
  );
}
