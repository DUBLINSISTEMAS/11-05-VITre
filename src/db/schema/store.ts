/**
 * Tabela `store` — o tenant. Cada lojista tem 1 ou mais lojas.
 * Slug é único globalmente. Demais entidades de domínio referenciam store por FK.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { userTable } from "./auth";

export const nicheEnum = pgEnum("niche", [
  "roupa_feminina",
  "joia",
  "semijoia",
  "perfumaria",
  "outro",
]);

/**
 * Base de cálculo da parcela exibida no PDP.
 *   - "base":      divide pelo preço cheio (preserva percepção de valor,
 *                  defensável quando há promoção ativa).
 *   - "effective": divide pelo preço atual (promo se ativa, senão base).
 * Default "base" — comportamento que NÃO induz o cliente a esperar
 * "Nx da promo" automaticamente. Ver ADR-0013.
 */
export const installmentBasePriceEnum = pgEnum("installment_base_price", [
  "base",
  "effective",
]);

export const storeTable = pgTable(
  "store",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      // ON DELETE RESTRICT: deletar usuário NÃO apaga a loja em silêncio.
      // Operação destrutiva precisa ser explícita (limpeza prévia ou cascade
      // manual). Ver supabase/sql/06_fk_safety.sql.
      .references(() => userTable.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    niche: nicheEnum("niche").notNull().default("outro"),

    /**
     * Onda 2.7 (2026-05-22) — CNPJ ou CPF do lojista (11 ou 14 dígitos,
     * sem máscara). Aparece nos documentos impressos (recibo, A4 venda,
     * fechamento Z) — não tem efeito fiscal (ADR-0033 veto). Opcional;
     * cadastro de loja não exige.
     * CHECK length BETWEEN 11 AND 14 em SQL 63.
     */
    document: text("document"),

    /**
     * Sprint 3.5 (2026-05-22) — quando true, PDV bloqueia registro de
     * venda balcão se não houver `cash_session` ativa pra loja. Default
     * false preserva comportamento atual (Onda 2.6 mostra banner amarelo
     * mas não bloqueia).
     *
     * Lojista ativa em /admin/configuracoes quando quer disciplina fiscal
     * (toda venda balcão sempre vinculada a um caixa aberto = fechamento
     * Z sem vendas órfãs).
     */
    requireOpenCashSession: boolean("require_open_cash_session")
      .notNull()
      .default(false),

    // WhatsApp
    whatsappNumber: text("whatsapp_number").notNull(), // E.164: +5599981757512
    whatsappDisplay: text("whatsapp_display").notNull(), // (99) 98175-7512
    // Template customizado de mensagem WhatsApp. Quando NULL, usamos o
    // default do sistema (`DEFAULT_WHATSAPP_TEMPLATE` em lib/whatsapp-
    // message.ts). Placeholders renderizados: {cliente}, {loja}, {itens},
    // {total}, {codigo}, {link}, {observacoes}. Limite 2000 chars.
    whatsappTemplate: text("whatsapp_template"),

    // Identidade visual
    logoUrl: text("logo_url"),
    iconUrl: text("icon_url"),
    primaryColor: text("primary_color").notNull().default("#1E3FE6"),
    // Variant da bottom-nav do storefront (canvas-v1).
    // Valores válidos: "pill" (default) | "rule" | "glass".
    // Tipo `text` em vez de pgEnum pra evitar migration de enum quando
    // adicionarmos novas variants. Aplicação valida em BottomNavVariant.
    bottomNavStyle: text("bottom_nav_style").notNull().default("pill"),

    // Intervalo (em segundos) de rotação automática do carrossel de
    // banners no storefront. 0 = rotação desligada (mostra só o primeiro).
    // Range válido (validado em Zod): 0 ou 3-60s. Default 5s.
    bannerRotationSec: integer("banner_rotation_sec").notNull().default(5),

    // Eixos de tema (Onda C / Themes v1). Valores válidos:
    //   categoryShape: "rounded" (default) | "square" | "circle"
    //   productCardStyle: "standard" (default) | "minimal" | "bold"
    //   heroStyle: "cover" (default) | "split" | "minimal"
    // CHECK constraints aplicados em supabase/sql/16_theme_check_constraints.sql.
    // Defaults batem com canvas-v1 = preset "mangos-clean" (zero regressão pós-deploy).
    categoryShape: text("category_shape").notNull().default("rounded"),
    productCardStyle: text("product_card_style").notNull().default("standard"),
    heroStyle: text("hero_style").notNull().default("cover"),

    // =================================================================
    // Pagamento (Fase 2 — ADR-0013)
    // Bloco inline (segue padrão item 10 do CLAUDE.md — promoção também
    // é inline em productTable). Defaults conservadores: lojista que não
    // configurar nada NÃO mostra parcela no PDP.
    //
    // CHECK constraints em supabase/sql/17_payment_check_constraints.sql.
    // =================================================================

    // Aceita cartão de crédito. Quando false, toda label de parcelamento
    // some do storefront — independente das outras configs. Freio mestre.
    acceptsCard: boolean("accepts_card").notNull().default(false),

    // Máximo de parcelas exibido no PDP. Range 1..12 (CHECK no SQL 17).
    // Quando 1, label não é renderizada (parcela única = preço cheio, ruído).
    cardMaxInstallments: integer("card_max_installments").notNull().default(1),

    // Sprint 3 (audit 2026-05-26): ATIVADO no PDV. Juros do cartão em
    // basis points por mês (1bps = 0.01%; 299 = 2.99% a.m.). 0 = sem juros.
    // PDV aplica via Sistema PRICE quando installments > cardInterestFreeUpTo.
    // CHECK 0..9999 no SQL 17.
    cardInterestRateBps: integer("card_interest_rate_bps")
      .notNull()
      .default(0),

    // Sprint 3 (SQL 72) — parcelas sem juros antes de aplicar
    // cardInterestRateBps. Default 1 = só 1x à vista sem juros (juros
    // começa de 2x se rate>0). Lojista que oferece "3x sem juros" coloca 3.
    // 12 ou mais = "absorvo a taxa em tudo" (juros nunca aplica).
    // CHECK 1..24 no SQL 72.
    cardInterestFreeUpTo: integer("card_interest_free_up_to")
      .notNull()
      .default(1),

    // Base de cálculo da parcela. Ver doc do enum installmentBasePriceEnum.
    installmentBasePrice: installmentBasePriceEnum("installment_base_price")
      .notNull()
      .default("base"),

    // Gate explícito pra renderizar label no PDP. Mesmo com acceptsCard=true
    // e cardMaxInstallments>1, se isto for false, a label não aparece.
    // Default false: ainda mais conservador. Lojista pode preferir não
    // poluir o PDP e deixar a parcela ser combinada no WhatsApp.
    showInstallmentsOnPDP: boolean("show_installments_on_pdp")
      .notNull()
      .default(false),

    // Desconto à vista em basis points. 0..9999. 0 = sem desconto.
    // Renderiza linha auxiliar "à vista R$ X (10% off)" no PDP.
    // NÃO assume método (PIX/dinheiro) — Mangos Pay não processa transação;
    // método é combinado no WhatsApp. CHECK 0..9999 no SQL 17.
    cashDiscountBps: integer("cash_discount_bps").notNull().default(0),

    // Texto livre opcional descrevendo formas de pagamento aceitas.
    // Até 280 chars. Renderiza num bloco "Como pagar" no PDP, abaixo do
    // trust block. Ex: "Aceitamos PIX, dinheiro e cartão (parcelado em até
    // 10x). Combine pelo WhatsApp."
    // CHECK length <= 280 no SQL 17.
    paymentMethodsNote: text("payment_methods_note"),

    // =================================================================
    // Quotas (S1.3 do Plano de Endurecimento, 2026-05-26)
    // =================================================================
    // Limites hard por loja. Default conservador (Free). Plano Pago futuro
    // sobe via UPDATE. CHECK range no SQL 73.
    // Enforcement em src/actions/product/create.ts + product-image/upload.ts.
    maxProductsCount: integer("max_products_count").notNull().default(1000),
    maxImageMb: integer("max_image_mb").notNull().default(2),

    // =================================================================
    // Horários de funcionamento (ADR-0023)
    // jsonb 7 dias × até 2 turnos. NULL = não configurado.
    // Validação estrutural via CHECK no SQL 30; semântica via Zod.
    // =================================================================
    businessHours: jsonb("business_hours").$type<BusinessHoursJson | null>(),

    // Endereço
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressNeighborhood: text("address_neighborhood"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    googleMapsUrl: text("google_maps_url"),

    // Redes
    instagramHandle: text("instagram_handle"),

    // Estado
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("store_owner_idx").on(t.ownerId),
    ownerUnique: unique("store_owner_id_unique").on(t.ownerId),
  }),
);

// Relations declaradas em src/db/schema/relations.ts para evitar import cíclico.
export const storeUserRelations = relations(userTable, ({ many }) => ({
  stores: many(storeTable),
}));

export const storeRelations = relations(storeTable, ({ one }) => ({
  owner: one(userTable, {
    fields: [storeTable.ownerId],
    references: [userTable.id],
  }),
}));

/**
 * Formato canônico de `store.business_hours`. Validação Zod em
 * `actions/store/business-hours/schema.ts`.
 *
 * - `closed: true` → fechado naquele dia.
 * - `shifts: []` → "horário não definido" (UI mostra "consulte").
 * - Cada shift: opensAt < closesAt no formato HH:MM (24h, validado app-layer).
 */
export type BusinessHoursShift = {
  opensAt: string; // "09:00"
  closesAt: string; // "18:00"
};

export type BusinessHoursDay = {
  closed: boolean;
  shifts: BusinessHoursShift[];
};

export type BusinessHoursJson = {
  monday: BusinessHoursDay;
  tuesday: BusinessHoursDay;
  wednesday: BusinessHoursDay;
  thursday: BusinessHoursDay;
  friday: BusinessHoursDay;
  saturday: BusinessHoursDay;
  sunday: BusinessHoursDay;
};

export type Store = typeof storeTable.$inferSelect;
export type NewStore = typeof storeTable.$inferInsert;
