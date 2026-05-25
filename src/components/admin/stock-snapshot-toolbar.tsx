"use client";

/**
 * Toolbar da aba SALDO do /admin/estoque — Sprint flash 2026-05-24 (Bloco 4).
 *
 * Antes a snapshot tinha só chips de status. Lojista com 200 SKUs em 6
 * categorias tinha que rolar página inteira pra achar "tudo de Perfumaria
 * pra repor" — bug típico de tabela de gestão sem filtro.
 *
 * URL-driven (mesmo padrão de ProductsToolbar):
 *   - `?q=...`         busca por nome (debounced)
 *   - `?categoryId=`   filtro por categoria
 *
 * Mantém `?status=` e `?sort=` em todas as transições (sticky filters).
 */
import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryOption {
  id: string;
  name: string;
}

interface StockSnapshotToolbarProps {
  categories: ReadonlyArray<CategoryOption>;
}

export function StockSnapshotToolbar({
  categories,
}: StockSnapshotToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = searchParams.get("q") ?? "";
  const currentCategory = searchParams.get("categoryId") ?? "all";

  const [q, setQ] = useState(initialQ);
  // Skip o primeiro effect — evita push extra na hidratação que move o
  // foco do input pra fora. Padrão usado em ProductsToolbar.
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    const handler = setTimeout(() => {
      const usp = new URLSearchParams(window.location.search);
      usp.delete("page");
      if (q.trim()) {
        usp.set("q", q.trim());
      } else {
        usp.delete("q");
      }
      startTransition(() => {
        router.replace(`?${usp.toString()}`, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [q, router]);

  const updateCategory = (next: string) => {
    const usp = new URLSearchParams(window.location.search);
    usp.delete("page");
    if (next === "all") {
      usp.delete("categoryId");
    } else {
      usp.set("categoryId", next);
    }
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="b3-toolbar">
      <div className="b3-toolbar-search">
        <SearchIcon size={14} aria-hidden />
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar produto pelo nome"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar produto"
        />
      </div>

      <Select value={currentCategory} onValueChange={updateCategory}>
        <SelectTrigger
          aria-label="Filtrar por categoria"
          className="h-9 min-w-[180px] text-[12.5px]"
        >
          <SelectValue placeholder="Todas as categorias" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as categorias</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
