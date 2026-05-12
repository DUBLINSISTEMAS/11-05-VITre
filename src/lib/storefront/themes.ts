/**
 * Themes v1 — Onda C.
 *
 * Sistema de "modelos prontos" estilo Shopify themes / Nuvem Shop layouts.
 * Lojista escolhe um preset em `/admin/aparencia`; a action aplica os 4
 * eixos enum em 1 UPDATE; storefront lê `store.*` direto.
 *
 * Decisões fechadas (conselho + planner):
 *  - Schema híbrido: colunas enum SEPARADAS por dimensão (NÃO jsonb).
 *    Mantém TS+Drizzle type-safe, migrations ALTER simples.
 *  - 3 presets curados (NÃO editor avançado). Lojista escolhe um todo,
 *    não combina dimensões livremente.
 *  - Defaults da migration = preset "vitre-clean" = canvas-v1 atual.
 *    Sandra (e qualquer loja pre-existente) NÃO muda visualmente até
 *    clicar "Aplicar" em outro preset.
 *  - Tematização toca FORMA/DENSIDADE/LAYOUT. Cor e tipografia continuam
 *    fora de escopo (cor já é per-store via primaryColor + ADR-0011).
 *
 * Adicionar preset novo: append no THEME_PRESETS aqui + mockup em
 * theme-preview.tsx. Não exige migration.
 */

export type CategoryShape = "rounded" | "square" | "circle";
export type ProductCardVariant = "standard" | "minimal" | "bold";
export type HeroVariant = "cover" | "split" | "minimal";
export type BottomNavVariant = "pill" | "rule" | "glass";

export interface ThemePreset {
  readonly id: ThemePresetId;
  readonly name: string;
  readonly description: string;
  readonly categoryShape: CategoryShape;
  readonly productCardStyle: ProductCardVariant;
  readonly heroStyle: HeroVariant;
  readonly bottomNavStyle: BottomNavVariant;
}

export const THEME_PRESETS = {
  "vitre-clean": {
    id: "vitre-clean",
    name: "Vitrê Clean",
    description:
      "O modelo padrão. Categorias arredondadas, cards editoriais e hero com imagem em destaque. Pegada minimalista profissional, ideal pra qualquer nicho.",
    categoryShape: "rounded",
    productCardStyle: "standard",
    heroStyle: "cover",
    bottomNavStyle: "pill",
  },
  boutique: {
    id: "boutique",
    name: "Boutique",
    description:
      "Categorias em círculo, cards minimalistas e hero em split (imagem + texto lado a lado). Pegada premium discreta, ótimo pra joia, semijoia e moda autoral.",
    categoryShape: "circle",
    productCardStyle: "minimal",
    heroStyle: "split",
    bottomNavStyle: "rule",
  },
  bazar: {
    id: "bazar",
    name: "Bazar",
    description:
      "Categorias quadradas, cards com peso visual e hero minimal (só texto). Pegada vibrante e direta, casa com perfumaria, bazar de roupa e nichos populares.",
    categoryShape: "square",
    productCardStyle: "bold",
    heroStyle: "minimal",
    bottomNavStyle: "glass",
  },
} as const satisfies Record<string, ThemePreset>;

export type ThemePresetId = "vitre-clean" | "boutique" | "bazar";

export const THEME_PRESET_IDS = Object.keys(THEME_PRESETS) as [
  ThemePresetId,
  ...ThemePresetId[],
];

/**
 * Identifica qual preset (se algum) corresponde à combinação atual dos 4
 * eixos no storeTable. Retorna null se a combinação é "customizada" (não
 * bate com nenhum dos 3 presets oficiais).
 *
 * Customizado acontece quando preset foi aplicado e DEPOIS o lojista
 * mudou alguma dimensão individual via outro fluxo — não há esse fluxo
 * hoje, mas o futuro pode abrir editor avançado. Mantém detecção
 * forward-compatible.
 */
export function detectActivePreset(store: {
  categoryShape: string;
  productCardStyle: string;
  heroStyle: string;
  bottomNavStyle: string;
}): ThemePresetId | null {
  for (const id of THEME_PRESET_IDS) {
    const p = THEME_PRESETS[id];
    if (
      p.categoryShape === store.categoryShape &&
      p.productCardStyle === store.productCardStyle &&
      p.heroStyle === store.heroStyle &&
      p.bottomNavStyle === store.bottomNavStyle
    ) {
      return id;
    }
  }
  return null;
}
