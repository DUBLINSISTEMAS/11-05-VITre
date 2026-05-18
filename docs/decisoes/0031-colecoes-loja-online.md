# ADR-0031: Coleções customizáveis da loja online

- **Data**: 2026-05-18
- **Status**: aceito (Frente C — admin Phase 1; storefront rendering Phase 2 backlog)

## Contexto

Lojistas usam Shopify/Nuvem Shop pra criar seções nomeadas com produtos
curados — &quot;Lançamentos&quot;, &quot;Promoções de maio&quot;, &quot;Destaques masculinos&quot;.
Cada seção vira:

1. Card/grid na home da loja
2. Rota dedicada `/colecao/[slug]`

Hoje o Vitrê tem apenas `product.isFeatured` (boolean, lista única &quot;Em
destaque&quot;) e categorias (taxonomia, não coleção curada). Não dá pra
montar campanhas pontuais sem mexer em flags por produto.

## Decisão

Duas tabelas novas:

```
storefront_collection
  id uuid PK
  store_id uuid FK (RLS)
  name text NOT NULL                    -- "Promoções de maio"
  slug text NOT NULL                    -- "promocoes-maio"
  description text                      -- texto curto da coleção
  position int default 0                -- ordem entre coleções
  show_in_home bool default true        -- aparece como seção na home?
  is_active bool default true           -- visível em geral?
  created_at, updated_at
  UNIQUE(store_id, slug)

storefront_collection_item
  collection_id uuid FK CASCADE
  product_id uuid FK CASCADE
  store_id uuid FK  -- denormalizado pra RLS sem JOIN
  position int default 0  -- ordem do produto dentro da coleção
  created_at
  PK(collection_id, product_id)
```

CHECK constraints (SQL 36):
- `position >= 0` em ambas tabelas
- `slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'` e length BETWEEN 1 AND 60

RLS FORCE com `tenant_isolation` standard em ambas tabelas.

## UI Phase 1 (admin)

`/admin/colecoes`:
- Lista com nome, /colecao/slug, contagem de produtos, visibilidade (ativa/inativa, + na home), ações
- Modal de criação/edição (2 colunas):
  - Esquerda: nome, slug (placeholder = auto-slug do nome), descrição, toggles isActive + showInHome
  - Direita: picker de produtos com busca textual + lista ordenada manualmente (↑↓ por linha) — drag-drop é melhoria futura

## Phase 2 (storefront rendering — backlog explícito)

- Home renderiza cada `storefront_collection` ativa com `show_in_home=true` como seção horizontal (grid 4 col, scroll lateral mobile)
- Rota `/colecao/[slug]` lista produtos da coleção (filtra `isPublishedToStorefront=true` AND `product.isActive=true`)
- ISR + `revalidateTag(store-${slug})` já acionados nas mutations admin

Phase 2 será uma onda separada pra não inchar essa frente. Phase 1 já garante o cadastro persistido — quando Phase 2 entrar, dados existentes já aparecem sem migration adicional.

## Não-decisões

- **Drag-drop de produtos**: ↑↓ é suficiente pra SMB com 10-30 itens por coleção. Drag-drop fica pra quando aparecer demanda.
- **Coleção dinâmica (regras)**: tipo &quot;produtos com promo ativa&quot; sem curadoria. Fora do escopo — sempre curada por agora.
- **Imagem de capa da coleção**: cobertura via primeiro produto basta no Phase 2. Imagem dedicada pode entrar depois.

## Compatibilidade

- Schema novo, zero impacto em tabelas existentes
- Migration 0029 + SQL 36 aplicados em prod 2026-05-18
- Storefront atual não muda até Phase 2 ser implementada
