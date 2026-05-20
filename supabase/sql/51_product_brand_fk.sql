-- Sprint 2A — referência opcional product.brand_id pra tabela `brand`.
--
-- Estratégia de coexistência:
--   - product.brand (text) PRESERVADO — vira snapshot do nome no momento do save
--   - product.brand_id (uuid, nullable) — FK opcional pra brand.id
--
-- Comportamento esperado no app-layer (não-DB):
--   - Quando lojista escolhe marca do select: brand_id = X, brand = <nome snapshot>
--   - Quando lojista digita texto livre (sem select): brand_id = null, brand = texto
--   - Renome de marca NÃO atualiza produtos antigos (snapshot histórico)
--   - DELETE de marca seta brand_id = null nos produtos (ON DELETE SET NULL)
--
-- Idempotente.

ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES "brand"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS product_brand_idx ON "product" (store_id, brand_id);

COMMENT ON COLUMN "product".brand_id IS
  'Referência opcional para tabela brand (Sprint 2A). NULL quando lojista digitou texto livre em product.brand. product.brand mantém SEMPRE o snapshot do nome no momento do save (sobrevive a renames/deletes da marca).';
