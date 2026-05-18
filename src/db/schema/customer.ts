/**
 * Tabela `customer` — clientes cadastrados pelo lojista no admin (Fase 3,
 * ADR-0014). NÃO é exposta no storefront, NÃO tem login. CRUD interno do
 * tenant, mesma natureza de `product` ou `category`.
 *
 * Distinção formal vs ADR-0008 (storefront sem login):
 *   - Consumidor anônimo do storefront = pessoa que entra em
 *     vitre.site/<loja> pra comprar. Sem perfil. ADR-0008.
 *   - Cliente cadastrado = registro do admin, criado pelo lojista pra
 *     histórico/follow-up/PDV (Fase 5). ADR-0014.
 *
 * `order.customer_id` (FK opcional) liga pedidos a clientes cadastrados.
 * `order.customer_name`/`customer_phone` continuam como snapshot histórico
 * da época do pedido — dois caminhos intencionais (auditoria + vínculo).
 *
 * CHECK constraints em supabase/sql/20_customer_check_constraints.sql.
 * RLS em supabase/sql/21_customer_rls.sql.
 */
import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { storeTable } from "./store";

/**
 * ADR-0021 — PF (pessoa física) ou PJ (pessoa jurídica).
 * Binário intencional — empresa estrangeira sem CNPJ vira `individual`
 * com `document NULL`. Manter binário simplifica UI (toggle) + relatórios.
 */
export const customerTypeEnum = pgEnum("customer_type", [
  "individual",
  "company",
]);

export const customerTable = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storeTable.id, { onDelete: "cascade" }),

    // Identidade — name + phone obrigatórios. Telefone é a chave do
    // varejo brasileiro; nome é como o lojista identifica (PF "Nome",
    // PJ "Razão social").
    name: text("name").notNull(),
    phone: text("phone").notNull(), // E.164: +5511999999999

    /**
     * ADR-0021 — tipo do cadastro. Default 'individual' (95% do varejo
     * SMB BR). Migration 0020 backfilla existentes com este default.
     */
    type: customerTypeEnum("type").notNull().default("individual"),

    /**
     * ADR-0021 — CPF (11 dígitos) ou CNPJ (14), SEM máscara, só dígitos.
     * Opcional — cliente pode existir sem documento. Length + digits
     * validados em DB (SQL 28 CHECK); dígito verificador em Zod via
     * src/lib/document.ts. UNIQUE parcial em (store_id, document) WHERE
     * document IS NOT NULL — múltiplos NULL permitidos, doc não-NULL único.
     */
    document: text("document"),

    // Contato opcional
    email: text("email"),

    // Endereço — opcional, tudo nullable. Usado pra delivery e PDV (Fase 5).
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressNeighborhood: text("address_neighborhood"),
    addressCity: text("address_city"),
    addressState: text("address_state"), // UF 2 letras maiúsculas
    addressZip: text("address_zip"), // 8 dígitos, sem máscara

    // Notas livres do lojista. Até 1000 chars (CHECK no SQL 20).
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    // Dedup por telefone DENTRO da loja. Dois lojistas diferentes podem
    // ter mesmo phone (não é violação). Duplicar phone na MESMA loja é
    // erro de cadastro — UNIQUE força o lojista a editar/mesclar.
    storePhoneUnique: unique("customer_store_phone_unique").on(t.storeId, t.phone),
    // Busca por nome no /admin/clientes (ilike substring + ordenação).
    storeNameIdx: index("customer_store_name_idx").on(t.storeId, t.name),
    // Listing default ordena por createdAt desc — index composto evita
    // sort full em listas grandes.
    storeCreatedIdx: index("customer_store_created_idx").on(
      t.storeId,
      t.createdAt,
    ),
  }),
);

export const customerRelations = relations(customerTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [customerTable.storeId],
    references: [storeTable.id],
  }),
}));

export type Customer = typeof customerTable.$inferSelect;
export type NewCustomer = typeof customerTable.$inferInsert;
export type CustomerType = (typeof customerTypeEnum.enumValues)[number];
