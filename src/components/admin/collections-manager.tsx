"use client";

import {
  EyeIcon,
  EyeOffIcon,
  LayoutGridIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type CollectionDetail,
  type CollectionListItem,
  deleteCollection,
  loadCollectionDetail,
  setCollectionProducts,
  upsertCollection,
} from "@/actions/storefront-collection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/pricing";

type Product = {
  id: string;
  name: string;
  slug: string;
  basePriceInCents: number;
};

export function CollectionsManager({
  initialCollections,
  availableProducts,
}: {
  initialCollections: CollectionListItem[];
  availableProducts: Product[];
}) {
  const [collections, setCollections] =
    useState<CollectionListItem[]>(initialCollections);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, startBusy] = useTransition();

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Apagar vitrine "${name}"? Os produtos não são apagados — só a vitrine.`)) return;
    startBusy(async () => {
      const r = await deleteCollection(id);
      if (!r.ok) {
        toast.error("Falha ao apagar.");
        return;
      }
      toast.success("Vitrine apagada.");
      setCollections((cs) => cs.filter((c) => c.id !== id));
    });
  };

  const refresh = (next: CollectionListItem[]) => setCollections(next);

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="b3-btn b3-btn--cta"
        >
          <PlusIcon size={14} /> Nova vitrine
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
          <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
            <LayoutGridIcon className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-ink-1">
            Crie sua primeira vitrine
          </h2>
          <p className="text-ink-4 max-w-sm text-sm">
            Vitrines agrupam produtos pra aparecer como seções na home da loja
            online (ex: &ldquo;Promoções de maio&rdquo;, &ldquo;Mais
            queridos&rdquo;).
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="b3-btn b3-btn--cta mt-2"
          >
            <PlusIcon size={14} /> Criar primeira vitrine
          </button>
        </div>
      ) : (
        <div className="b3-card overflow-hidden">
          <table className="b3-tbl w-full">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Endereço</th>
                <th className="text-right">Produtos</th>
                <th>Visibilidade</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="text-ink-1 text-[13px] font-medium">
                      {c.name}
                    </div>
                    {c.description && (
                      <div className="text-ink-4 text-[11px]">
                        {c.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <code className="text-ink-3 text-[11.5px]">
                      /colecao/{c.slug}
                    </code>
                  </td>
                  <td className="text-right tabular-nums">{c.productCount}</td>
                  <td>
                    <div className="flex flex-col gap-1 text-[11px]">
                      {c.isActive ? (
                        <span className="b3-pill b3-pill--ok flex items-center gap-1">
                          <EyeIcon size={10} /> Ativa
                        </span>
                      ) : (
                        <span className="b3-pill b3-pill--gold flex items-center gap-1">
                          <EyeOffIcon size={10} /> Inativa
                        </span>
                      )}
                      {c.showInHome && c.isActive && (
                        <span className="text-ink-4 text-[10.5px]">
                          + na home
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(c.id)}
                        disabled={busy}
                        className="hover:bg-bg-app text-ink-3 hover:text-ink-1 rounded p-1.5"
                        aria-label="Editar"
                      >
                        <PencilIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={busy}
                        className="hover:bg-bg-app text-ink-3 hover:text-danger rounded p-1.5"
                        aria-label="Apagar"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CollectionEditor
          collection={null}
          availableProducts={availableProducts}
          onClose={() => setShowCreate(false)}
          onSaved={(c) => {
            refresh([...collections, c]);
            setShowCreate(false);
          }}
        />
      )}
      {editingId && (
        <EditingDialog
          id={editingId}
          availableProducts={availableProducts}
          onClose={() => setEditingId(null)}
          onSaved={(updated) => {
            refresh(
              collections.map((c) => (c.id === updated.id ? updated : c)),
            );
            setEditingId(null);
          }}
        />
      )}
    </>
  );
}

function EditingDialog({
  id,
  availableProducts,
  onClose,
  onSaved,
}: {
  id: string;
  availableProducts: Product[];
  onClose: () => void;
  onSaved: (c: CollectionListItem) => void;
}) {
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  useEffect(() => {
    loadCollectionDetail(id).then((d) => setDetail(d));
  }, [id]);
  if (!detail) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Carregando…</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <CollectionEditor
      collection={detail}
      availableProducts={availableProducts}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function CollectionEditor({
  collection,
  availableProducts,
  onClose,
  onSaved,
}: {
  collection: CollectionDetail | null;
  availableProducts: Product[];
  onClose: () => void;
  onSaved: (c: CollectionListItem) => void;
}) {
  const isEdit = !!collection;
  const [name, setName] = useState(collection?.name ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  // PP5 — kicker + cor de fundo do card colorido na home (handoff 2026-05-25).
  const [kicker, setKicker] = useState(collection?.kicker ?? "");
  const [bgColor, setBgColor] = useState(collection?.bgColor ?? "");
  const [showInHome, setShowInHome] = useState(collection?.showInHome ?? true);
  const [isActive, setIsActive] = useState(collection?.isActive ?? true);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    collection?.productIds ?? [],
  );
  const [pickerQuery, setPickerQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, startBusy] = useTransition();

  const filteredProducts = pickerQuery.trim()
    ? availableProducts.filter((p) =>
        p.name.toLowerCase().includes(pickerQuery.toLowerCase()),
      )
    : availableProducts;

  const toggleProduct = (id: string) => {
    setSelectedIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  };

  const moveProduct = (from: number, to: number) => {
    setSelectedIds((curr) => {
      const next = [...curr];
      const [item] = next.splice(from, 1);
      if (!item) return curr;
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleSave = () => {
    setErrors({});
    startBusy(async () => {
      const result = await upsertCollection({
        id: collection?.id ?? null,
        name,
        slug: slug.trim() || null,
        description: description.trim() || null,
        kicker: kicker.trim() || null,
        bgColor: bgColor.trim() || null,
        showInHome,
        isActive,
        position: collection?.position ?? 0,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      // Salva ordem dos produtos
      const itemsResult = await setCollectionProducts({
        collectionId: result.id,
        productIds: selectedIds,
      });
      if (!itemsResult.ok) {
        toast.error(itemsResult.error ?? "Falha nos produtos.");
        return;
      }
      toast.success(isEdit ? "Vitrine atualizada." : "Vitrine criada.");
      onSaved({
        id: result.id,
        name: name.trim(),
        slug: slug.trim() || slugifyClient(name),
        description: description.trim() || null,
        kicker: kicker.trim() || null,
        bgColor: bgColor.trim() || null,
        position: collection?.position ?? 0,
        showInHome,
        isActive,
        productCount: selectedIds.length,
      });
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar vitrine" : "Nova vitrine"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="text-ink-2 mb-1 block text-[12px] font-medium">
                Nome *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Promoções de maio"
                className="b3-input w-full"
                maxLength={80}
              />
              {errors.name && (
                <p className="mt-1 text-[10.5px] text-red-600">{errors.name}</p>
              )}
            </div>
            <div>
              <label className="text-ink-2 mb-1 block text-[12px] font-medium">
                Endereço (slug)
              </label>
              <div className="flex items-center gap-1">
                <span className="text-ink-4 text-[12px]">/colecao/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={slugifyClient(name) || "promocoes-maio"}
                  className="b3-input flex-1"
                  maxLength={60}
                />
              </div>
              <p className="text-ink-4 mt-1 text-[10.5px]">
                Letras minúsculas, números e hífens. Vazio = gera do nome.
              </p>
              {errors.slug && (
                <p className="mt-1 text-[10.5px] text-red-600">{errors.slug}</p>
              )}
            </div>
            <div>
              <label className="text-ink-2 mb-1 block text-[12px] font-medium">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                className="border-line bg-surface focus:border-brand w-full resize-none rounded-[8px] border px-3 py-2 text-[13px] outline-none"
                placeholder="Texto curto que aparece no topo da vitrine."
              />
            </div>

            {/* PP5 — kicker + cor pra card colorido na home (handoff 2026-05-25). */}
            <div>
              <label className="text-ink-2 mb-1 block text-[12px] font-medium">
                Kicker no card
              </label>
              <input
                value={kicker}
                onChange={(e) => setKicker(e.target.value)}
                placeholder="Ex: Top semana · Promo junho"
                className="b3-input w-full"
                maxLength={30}
              />
              {errors.kicker ? (
                <p className="mt-1 text-[10.5px] text-red-600">{errors.kicker}</p>
              ) : (
                <p className="text-ink-4 mt-1 text-[10.5px]">
                  Texto pequeno em cima do título no card da home. Opcional.
                </p>
              )}
            </div>

            <div>
              <label className="text-ink-2 mb-1 block text-[12px] font-medium">
                Cor do card na home
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  placeholder="#174D44"
                  className="b3-input flex-1 font-mono"
                  maxLength={7}
                />
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(bgColor) ? bgColor : "#174D44"}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border border-line"
                  aria-label="Escolher cor"
                />
              </div>
              {errors.bgColor ? (
                <p className="mt-1 text-[10.5px] text-red-600">{errors.bgColor}</p>
              ) : (
                <p className="text-ink-4 mt-1 text-[10.5px]">
                  Hex (ex: #174D44). Vazio = card cinza neutro.
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Vitrine ativa (visível na loja)</span>
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={showInHome}
                onChange={(e) => setShowInHome(e.target.checked)}
                disabled={!isActive}
              />
              <span>Mostrar como seção na home</span>
            </label>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="text-ink-2 mb-1 text-[12px] font-medium">
              Produtos · {selectedIds.length} selecionado(s)
            </div>
            <div className="relative mb-2">
              <SearchIcon
                size={14}
                className="text-ink-4 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Buscar produto"
                className="border-line bg-surface focus:border-brand h-9 w-full rounded-[8px] border pl-9 pr-3 text-[13px] outline-none"
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="mb-3">
                <div className="text-ink-4 mb-1 text-[10px] font-bold uppercase tracking-wider">
                  Ordem da vitrine
                </div>
                <ol className="bg-bg-app divide-line divide-y rounded-[8px]">
                  {selectedIds.map((pid, idx) => {
                    const p = availableProducts.find((x) => x.id === pid);
                    return (
                      <li
                        key={pid}
                        className="flex items-center gap-2 px-2 py-1.5 text-[12px]"
                      >
                        <span className="text-ink-4 w-5 text-right tabular-nums">
                          {idx + 1}.
                        </span>
                        <span className="flex-1 truncate">
                          {p?.name ?? "Produto removido"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            idx > 0 && moveProduct(idx, idx - 1)
                          }
                          disabled={idx === 0}
                          className="text-ink-4 hover:text-ink-1 disabled:opacity-30"
                          aria-label="Mover acima"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            idx < selectedIds.length - 1 &&
                            moveProduct(idx, idx + 1)
                          }
                          disabled={idx === selectedIds.length - 1}
                          className="text-ink-4 hover:text-ink-1 disabled:opacity-30"
                          aria-label="Mover abaixo"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleProduct(pid)}
                          className="text-ink-4 hover:text-danger"
                          aria-label="Remover"
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <div className="border-line min-h-0 flex-1 overflow-y-auto rounded-[8px] border">
              {filteredProducts.length === 0 ? (
                <p className="text-ink-4 p-3 text-[12px]">
                  Nenhum produto encontrado.
                </p>
              ) : (
                <ul>
                  {filteredProducts.map((p) => {
                    const checked = selectedIds.includes(p.id);
                    return (
                      <li
                        key={p.id}
                        className="border-line hover:bg-bg-app border-b last:border-b-0"
                      >
                        <label className="flex w-full cursor-pointer items-center gap-3 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleProduct(p.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-ink-1 truncate text-[13px]">
                              {p.name}
                            </div>
                            <div className="text-ink-4 text-[10.5px]">
                              {formatBRL(p.basePriceInCents)}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="border-line mt-4 flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="b3-btn"
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !name.trim()}
            className="b3-btn b3-btn--cta"
          >
            {busy ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar vitrine"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function slugifyClient(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
