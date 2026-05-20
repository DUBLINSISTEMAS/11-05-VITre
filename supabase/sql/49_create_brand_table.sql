-- Tabela `brand` — Sprint 2 ativará CRUD em /admin/marcas (substitui texto
-- livre do form de produto). Preparada agora (Sprint 0, Prompt 6) para
-- desbloquear o schema Drizzle. NÃO aplicar até a Sprint 2.
--
-- Decisões:
-- - RLS-first, store_id obrigatório (princípio CLAUDE.md #1)
-- - slug per-store unique (mesma marca pode existir em lojas diferentes)
-- - CHECK simples: nome e slug não vazios
-- - sem deleted_at — Sprint 2 decide se vira soft delete ou cascata
-- - sem updated_at trigger automático — Sprint 2 adiciona se necessário
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS "brand" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES store(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT brand_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT brand_slug_not_empty CHECK (length(trim(slug)) > 0)
);

-- Slug único por loja (mesmo slug pode existir em lojas diferentes).
CREATE UNIQUE INDEX IF NOT EXISTS brand_store_slug_unique
  ON "brand" (store_id, slug);

-- Index pra listagem rápida por loja.
CREATE INDEX IF NOT EXISTS brand_store_idx ON "brand" (store_id);

-- RLS — mesmo pattern do supplier/customer (NULLIF defesa contra string vazia).
ALTER TABLE "brand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brand" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_tenant_isolation ON "brand";
CREATE POLICY brand_tenant_isolation ON "brand"
  FOR ALL
  USING (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.current_store_id', true), '')::uuid);
