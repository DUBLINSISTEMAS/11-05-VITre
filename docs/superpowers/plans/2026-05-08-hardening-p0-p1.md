# Hardening P0/P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todos os bloqueadores P0/P1 da auditoria sênior: privacidade de pedidos públicos, RLS perigosa, estoque atômico no checkout, rotas quebradas e invariantes de tenant.

**Architecture:** Manter o desenho atual Next 15 + Server Actions + Drizzle, adicionando fronteiras pequenas e testáveis. `shortCode` segue humano; `publicToken` vira identificador público opaco. Estoque é reservado/decrementado na transação de criação de pedido; a página pública usa apenas payload sanitizado.

**Tech Stack:** Next 15, React 19, TypeScript, Drizzle ORM, Supabase Postgres, Zod, Node built-in test runner via `tsx --test`.

---

## File Structure

- Create `tests/public-order.test.ts`: testes de token e mensagem pública sem PII.
- Create `tests/sql-policies.test.ts`: testes contratuais contra SQL perigoso.
- Create `tests/storefront-routes.test.ts`: testes estáticos de rotas `/destaques` e `/novidades`.
- Create `src/lib/public-order.ts`: helpers puros para token, URL pública e mensagem sanitizada.
- Modify `src/db/schema/order.ts`: adicionar `publicToken` unique/notNull.
- Create `drizzle/0004_public_order_token_stock_hardening.sql`: migration para token público e unique owner.
- Modify `supabase/sql/01_rls_setup.sql`: remover `USING (true)` de pedidos e corrigir anonymous.
- Modify `src/actions/order/create-from-cart.ts`: gerar token, checar idempotência antes, decrementar estoque condicionalmente.
- Modify `src/lib/storefront/order-loader.ts`: carregar pedido por public token.
- Modify `src/app/p/[shortCode]/page.tsx`: tratar param como public token e não embutir PII.
- Modify `src/app/(storefront)/[storeSlug]/sucesso/page.tsx`: usar helper público e manter compatibilidade com shortCode no query param.
- Create `src/app/(storefront)/[storeSlug]/destaques/page.tsx`: lista produtos em destaque.
- Create `src/app/(storefront)/[storeSlug]/novidades/page.tsx`: lista novidades.
- Modify `src/app/(auth)/criar-loja/identidade/page.tsx`: remover import não usado.
- Modify `package.json`: adicionar script `test` com `tsx --test tests/**/*.test.ts`.

## Task 1: Test Harness and Public Order Helpers

**Files:**
- Modify: `package.json`
- Create: `tests/public-order.test.ts`
- Create: `src/lib/public-order.ts`

- [ ] **Step 1: Add failing tests**
  - Test `generatePublicOrderToken()` returns a long URL-safe token.
  - Test `buildPublicOrderPath(token)` returns `/p/${token}`.
  - Test `buildPublicOrderWhatsAppMessage()` excludes customer name/phone/notes.

- [ ] **Step 2: Run RED**
  - Run: `npx tsx --test tests/public-order.test.ts`
  - Expected: FAIL because `src/lib/public-order.ts` does not exist.

- [ ] **Step 3: Implement helper**
  - Use `nanoid` custom alphabet with URL-safe uppercase/lowercase/digits, length >= 16.
  - Export `PUBLIC_ORDER_TOKEN_LENGTH`, `generatePublicOrderToken`, `buildPublicOrderPath`, `buildPublicOrderWhatsAppMessage`.

- [ ] **Step 4: Run GREEN**
  - Run: `npx tsx --test tests/public-order.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Add package script**
  - Add `"test": "tsx --test \"tests/**/*.test.ts\""`.
  - Run: `npm test`.

## Task 2: Schema and SQL Hardening

**Files:**
- Modify: `src/db/schema/order.ts`
- Create: `drizzle/0004_public_order_token_stock_hardening.sql`
- Modify: `supabase/sql/01_rls_setup.sql`
- Create: `tests/sql-policies.test.ts`

- [ ] **Step 1: Add failing SQL policy tests**
  - Assert `supabase/sql/01_rls_setup.sql` does not contain `order_public_read_by_code` with `USING (true)`.
  - Assert `order_item_public_read` does not contain `USING (true)`.
  - Assert `store_owner_access` does not allow `anonymous` in a `FOR ALL` policy.

- [ ] **Step 2: Run RED**
  - Run: `npx tsx --test tests/sql-policies.test.ts`
  - Expected: FAIL on current dangerous policies.

- [ ] **Step 3: Implement DB schema/migration**
  - Add `publicToken: text("public_token").notNull().unique()` to `orderTable`.
  - Migration: add nullable column, backfill existing with random token, set not null, add unique constraint/index.
  - Migration: add unique constraint/index for `store.owner_id`.

- [ ] **Step 4: Harden RLS SQL**
  - `store_owner_access`: remove anonymous from `FOR ALL`.
  - Keep `store_public_read_active FOR SELECT`.
  - Remove public `USING (true)` for order/order_item or restrict to impossible/no public direct select.

- [ ] **Step 5: Run GREEN**
  - Run: `npx tsx --test tests/sql-policies.test.ts`.

## Task 3: Checkout Public Token and Atomic Stock

**Files:**
- Modify: `src/actions/order/create-from-cart.ts`
- Modify: `src/lib/storefront/order-loader.ts`
- Test: `tests/public-order.test.ts` plus build/typecheck.

- [ ] **Step 1: Add failing tests for public URL composition**
  - Extend helper tests to prove created public path uses token, not shortcode.

- [ ] **Step 2: Run RED**
  - Run: `npx tsx --test tests/public-order.test.ts`.

- [ ] **Step 3: Update order creation**
  - Check idempotency before stock decrement.
  - Generate `publicToken` on insert.
  - `publicUrl` uses `/p/${publicToken}`.
  - On idempotency hit, rebuild using existing `publicToken`.
  - For tracked variant: decrement `product_variant.stock_quantity` with `WHERE id AND store_id AND stock_quantity >= quantity`.
  - For tracked product without tracked variant: decrement `product.stock_quantity` similarly.
  - If decrement row count is 0, return `OUT_OF_STOCK`.

- [ ] **Step 4: Update loader**
  - Replace `getOrderByShortCode` with `getOrderByPublicToken` or add new function while keeping internal shortCode helper if needed.
  - Public loader must resolve by `publicToken`.

- [ ] **Step 5: Run checks**
  - Run: `npm test`.
  - Run: `npm run build`.

## Task 4: Public Order Page Without PII

**Files:**
- Modify: `src/app/p/[shortCode]/page.tsx`
- Modify: `src/app/(storefront)/[storeSlug]/sucesso/page.tsx`
- Test: `tests/public-order.test.ts`

- [ ] **Step 1: Add failing test for sanitized message**
  - Given customer name and notes, public message must not include them.

- [ ] **Step 2: Run RED**
  - Run: `npx tsx --test tests/public-order.test.ts`.

- [ ] **Step 3: Update pages**
  - Treat route param as token; variable names should say `publicToken`.
  - `/p/[token]` uses sanitized public WhatsApp message.
  - `/sucesso?code=shortCode` may still use shortCode lookup if needed but public link displayed must use token.

- [ ] **Step 4: Run GREEN**
  - Run: `npm test`.
  - Run: `npm run build`.

## Task 5: Storefront Missing Routes

**Files:**
- Create: `src/app/(storefront)/[storeSlug]/destaques/page.tsx`
- Create: `src/app/(storefront)/[storeSlug]/novidades/page.tsx`
- Create: `tests/storefront-routes.test.ts`

- [ ] **Step 1: Add failing route existence tests**
  - Assert both page files exist.

- [ ] **Step 2: Run RED**
  - Run: `npx tsx --test tests/storefront-routes.test.ts`.

- [ ] **Step 3: Implement pages**
  - `destaques`: resolve store; call `getFeaturedProducts`; render `ProductGrid` and empty state.
  - `novidades`: resolve store; call `getRecentProducts`; render `ProductGrid` and empty state.
  - Metadata titles: “Destaques” and “Novidades”.

- [ ] **Step 4: Run GREEN**
  - Run: `npm test`.
  - Run: `npm run build`.

## Task 6: Lint Warning and Final Verification

**Files:**
- Modify: `src/app/(auth)/criar-loja/identidade/page.tsx`

- [ ] **Step 1: Remove unused import**
  - Remove unused `cn` import.

- [ ] **Step 2: Run full verification**
  - Run: `npm test`.
  - Run: `npm run lint`.
  - Run: `npm run build`.

- [ ] **Step 3: Review changed files**
  - Confirm no P2/P3 scope creep.
  - Confirm all P0/P1 items are addressed.
