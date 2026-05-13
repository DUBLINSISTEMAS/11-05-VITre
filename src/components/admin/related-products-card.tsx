"use client";

/**
 * Card de "Produtos relacionados" no /admin/produtos/[id].
 *
 * Curadoria manual da seção "Você pode gostar também" no PDP storefront.
 * Lojista escolhe N produtos (máx 12) entre os ativos da loja. Sem manual,
 * loader cai pro auto (mesma categoria → mais recentes).
 *
 * UX:
 *  - Lista compacta com thumbnail + nome + X pra remover.
 *  - Input com autocomplete por nome — filtra sugestões em memória
 *    (lojista típico tem ≤200 produtos; passar tudo no SSR é OK).
 *  - Save explícito (não embute no submit do ProductForm — separação de
 *    domínio: mídia/preço/variantes vs curadoria de recomendação).
 */
import { GripVerticalIcon, PackageIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProductRelated } from "@/actions/product/update-related";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface RelatedPickerItem {
  id: string;
  name: string;
  cover: string | null;
}

interface RelatedProductsCardProps {
  productId: string;
  initialRelatedIds: string[];
  /** Catálogo completo da loja (ativos, excluindo o produto atual). */
  candidates: RelatedPickerItem[];
}

const MAX_RELATED = 12;

export function RelatedProductsCard({
  productId,
  initialRelatedIds,
  candidates,
}: RelatedProductsCardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialRelatedIds);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [savedSnapshot, setSavedSnapshot] = useState<string[]>(initialRelatedIds);

  const byId = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates],
  );

  const selectedItems = selectedIds
    .map((id) => byId.get(id))
    .filter((p): p is RelatedPickerItem => Boolean(p));

  const isDirty =
    selectedIds.length !== savedSnapshot.length ||
    selectedIds.some((id, idx) => savedSnapshot[idx] !== id);

  const filteredSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    return candidates
      .filter(
        (c) =>
          !selectedIds.includes(c.id) && c.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [candidates, query, selectedIds]);

  const handleAdd = (id: string) => {
    if (selectedIds.length >= MAX_RELATED) {
      toast.warning(`Máximo ${MAX_RELATED} produtos.`);
      return;
    }
    if (selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
    setQuery("");
  };

  const handleRemove = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateProductRelated({
        productId,
        relatedIds: selectedIds,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSavedSnapshot(selectedIds);
      toast.success("Produtos relacionados salvos.");
    });
  };

  return (
    <section className="bg-card rounded-2xl border p-4 shadow-sm sm:p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
            Produtos relacionados
          </h2>
          <p className="text-muted-foreground text-[11.5px] leading-relaxed">
            Aparecem como &ldquo;Você pode gostar também&rdquo; na página deste produto.
            Sem seleção, mostramos automaticamente.
          </p>
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.5px] text-muted-foreground">
          {selectedIds.length}/{MAX_RELATED}
        </span>
      </header>

      {/* Lista de selecionados */}
      {selectedItems.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {selectedItems.map((item, idx) => (
            <li
              key={item.id}
              className="bg-muted/30 group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:border-border"
            >
              <GripVerticalIcon
                className="text-muted-foreground/50 size-4 shrink-0"
                aria-hidden
              />
              <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums">
                {idx + 1}
              </span>
              <div className="bg-background relative size-10 shrink-0 overflow-hidden rounded-md">
                {item.cover ? (
                  <Image
                    src={item.cover}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <PackageIcon className="text-muted-foreground/60 size-4" />
                  </span>
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                {item.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hocus:text-destructive"
                onClick={() => handleRemove(item.id)}
                aria-label={`Remover ${item.name}`}
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bg-muted/20 mb-3 rounded-lg border border-dashed py-4 text-center text-[11.5px] text-muted-foreground">
          Nenhum produto selecionado.
        </p>
      )}

      {/* Picker */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Buscar produto para adicionar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isPending || selectedIds.length >= MAX_RELATED}
          className="text-[13px]"
        />
        {filteredSuggestions.length > 0 ? (
          <ul className="bg-card absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border shadow-md">
            {filteredSuggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(c.id)}
                  className="hocus:bg-accent flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                >
                  <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-md">
                    {c.cover ? (
                      <Image
                        src={c.cover}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      <PackageIcon className="text-muted-foreground/60 m-auto size-4" />
                    )}
                  </div>
                  <span className="truncate text-[12.5px] font-medium">
                    {c.name}
                  </span>
                  <PlusIcon className="text-muted-foreground ml-auto size-4 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Save */}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isDirty || isPending}
          onClick={() => setSelectedIds(savedSnapshot)}
        >
          Desfazer
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!isDirty || isPending}
          onClick={handleSave}
        >
          {isPending ? "Salvando…" : "Salvar relacionados"}
        </Button>
      </div>
    </section>
  );
}
