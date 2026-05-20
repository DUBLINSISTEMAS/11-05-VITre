"use client";

// Helpers compartilhados pelo ProductForm (Sprint 0, Prompt 6).
// Extraídos do antigo product-form.tsx monolítico (1111 linhas)
// para serem reutilizados pelas 5 abas.
import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  CategoryDialog,
  type CategoryOption,
} from "../category-dialog";

// ============================================================================
// SubCard — sub-bloco DENTRO de uma aba, com título + descrição opcional
// ============================================================================

interface SubCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SubCard({ title, description, children }: SubCardProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-bg-app/30 p-3 sm:p-4">
      <header className="space-y-0.5">
        <h3 className="text-[12.5px] font-semibold tracking-tight text-ink-1">
          {title}
        </h3>
        {description ? (
          <p className="text-ink-4 text-[11px] leading-snug">{description}</p>
        ) : null}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

// ============================================================================
// MetaField — input compacto pros campos meta canvas (composição etc).
// ============================================================================

interface MetaFieldProps extends React.ComponentProps<typeof Input> {
  id: string;
  label: string;
  error?: string;
}

export const MetaField = ({
  id,
  label,
  error,
  className,
  ...inputProps
}: MetaFieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      maxLength={120}
      autoComplete="off"
      aria-invalid={!!error}
      className={className}
      {...inputProps}
    />
    {error ? <p className="text-destructive text-xs">{error}</p> : null}
  </div>
);

// ============================================================================
// ToggleRow — linha switch + label + descrição.
// ============================================================================

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label htmlFor={id} className="text-[12.5px] font-medium">
          {label}
        </Label>
        {description ? (
          <p className="text-ink-4 text-[11px] leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

// ============================================================================
// CategoryField — Select hierárquico + botão "+ Nova categoria" inline.
// ============================================================================

export const NO_CATEGORY = "__none__";

interface CategoryFieldProps {
  value: string | null;
  onChange: (next: string | null) => void;
  categories: CategoryOption[];
  disabled?: boolean;
  onCategoryCreated: (c: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
  }) => void;
}

export function CategoryField({
  value,
  onChange,
  categories,
  disabled,
  onCategoryCreated,
}: CategoryFieldProps) {
  const { roots, childrenByParent } = useMemo(() => {
    const rootList = categories.filter((c) => c.parentId === null);
    const map = new Map<string, CategoryOption[]>();
    for (const c of categories) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return { roots: rootList, childrenByParent: map };
  }, [categories]);

  return (
    <div className="flex gap-2">
      <Select
        value={value ?? NO_CATEGORY}
        onValueChange={(v) => onChange(v === NO_CATEGORY ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Sem categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
          {roots.map((root) => {
            const children = childrenByParent.get(root.id) ?? [];
            if (children.length === 0) {
              return (
                <SelectItem key={root.id} value={root.id}>
                  {root.name}
                </SelectItem>
              );
            }
            return (
              <SelectGroup key={root.id}>
                <SelectLabel>{root.name}</SelectLabel>
                <SelectItem value={root.id}>{root.name} (geral)</SelectItem>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {root.name} › {child.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>

      <CategoryDialog
        rootCategories={roots}
        onCreated={onCategoryCreated}
        disabled={disabled}
      />
    </div>
  );
}

// ============================================================================
// Sessão de cadastro contínuo (sessionStorage). Usado no fluxo
// "Salvar e adicionar outro" do modo criação.
// ============================================================================

const SESSION_COUNTER_KEY = "vitre:product-create-session-count";
export function bumpSessionCounter(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = sessionStorage.getItem(SESSION_COUNTER_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    const next = (Number.isNaN(current) ? 0 : current) + 1;
    sessionStorage.setItem(SESSION_COUNTER_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

// ============================================================================
// Mapping aba → campos do form (pra count de erros por aba).
// ============================================================================

import type { FieldErrors } from "react-hook-form";
import type { ProductFormValues } from "@/actions/product/schema";

export type TabKey =
  | "identidade"
  | "preco-custo"
  | "estoque"
  | "variantes"
  | "loja-online";

// Lista de campos por aba. Usada pra contar erros do RHF por aba e
// mostrar badge "n" na navegação. Manter sincronizado com os tabs.
const TAB_FIELDS: Record<TabKey, Array<keyof ProductFormValues>> = {
  identidade: ["name", "description", "categoryId", "brand"],
  "preco-custo": [
    "basePriceInCents",
    "promoPriceInCents",
    "wholesalePriceInCents",
    "costPriceInCents",
    "defaultCommissionBps",
    "ncm",
  ],
  estoque: [
    "trackStock",
    "stockQuantity",
    "minStockQuantity",
    "maxStockQuantity",
    "gtin",
    "internalCode",
    "unit",
  ],
  variantes: ["variants"],
  "loja-online": [
    "isActive",
    "isPublishedToStorefront",
    "isFeatured",
    "installmentsOverride",
    "cashDiscountOverrideBps",
    "composition",
    "modeling",
    "lining",
    "washing",
  ],
};

export function getTabErrorCount(
  tab: TabKey,
  errors: FieldErrors<ProductFormValues>,
): number {
  return TAB_FIELDS[tab].reduce(
    (acc, field) => acc + (errors[field] ? 1 : 0),
    0,
  );
}
