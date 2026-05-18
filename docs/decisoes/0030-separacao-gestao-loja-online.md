# ADR-0030: Separação Gestão × Loja Online (`isPublishedToStorefront`)

- **Data**: 2026-05-18
- **Status**: aceito (Frente B do refino pós-Bloco B)

## Contexto

Founder validou em prospects que o conceito mental do varejista é:

1. **Gestão do negócio**: cadastro de produto, estoque, PDV de balcão,
   clientes, relatórios. Existe mesmo sem loja online.
2. **Loja online**: vitrine pública (`/storefront`). O lojista escolhe
   QUAIS produtos do seu sistema aparecem ali.

Hoje o produto tem uma flag única `is_active`:

- `true` → existe + aparece na loja online + pode vender no PDV
- `false` → "pausado": invisível em tudo

Não existe estado "produto cadastrado, com estoque, vendendo no PDV, mas
**não exposto** na vitrine pública". Isso bloqueia casos comuns:

- Produtos só-balcão (revenda eventual, brinde, item exclusivo presencial)
- Produtos em curadoria (cadastrado mas ainda sem foto boa pra vitrine)
- Sazonais (despublica da loja, mas mantém o cadastro pra inventário)

## Decisão

Adicionar coluna `is_published_to_storefront BOOLEAN NOT NULL DEFAULT true`
na `product`. Storefront loaders filtram **AMBOS**:

```sql
WHERE is_active = true AND is_published_to_storefront = true
```

Admin (lista, edição, PDV, relatórios, estoque) filtra só `is_active` —
loja online é uma **camada de visibilidade extra** sobre o cadastro.

## Implementação

- **DB**: migration `0028_product_storefront_visibility.sql` — ADD COLUMN
  com default true (backfill implícito pra produtos existentes).
- **Schema Drizzle**: `productTable.isPublishedToStorefront`.
- **Zod**: `productFormFieldsSchema.isPublishedToStorefront: z.boolean().default(true)`.
- **Form**: novo toggle no card "Status" do `product-form.tsx`, abaixo do
  `isActive` em criação. Copy: "Publicado na loja online — Se desligado, o
  produto fica no estoque e pode ser vendido no PDV, mas não aparece na
  vitrine pública."
- **Lista admin**: `StatusPill` agora distingue:
  - `Pausado` (isActive false)
  - `Sem estoque` (trackStock + qty 0)
  - `Só PDV` (active + sem estoque issues + NÃO publicado online) — pill cinza
  - `Na loja online` (tudo ok)
- **Storefront**: 10 sites de `eq(productTable.isActive, true)` acrescentam
  `eq(productTable.isPublishedToStorefront, true)`:
  - `products-loader.ts` (3 lugares)
  - `home-loader.ts` (2)
  - `search-loader.ts` (1)
  - `related-products-loader.ts` (3)
  - `app/sitemap.ts` (1)

## Não-decisões / fora do escopo

- **Categoria com mesma flag**: por ora `category.is_active` continua
  servindo pra ambos. Se virar dor, replicar a coluna.
- **Dashboard "minha loja online"**: rota dedicada `/admin/loja-online`
  vai ser criada na Frente C (coleções customizáveis) — faz mais sentido
  agrupar lá.
- **Bulk action "despublicar da loja"**: backlog. Hoje precisa abrir o
  produto. A toolbar de seleção múltipla cobre pause/publish (isActive)
  — pode estender quando aparecer demanda.

## Compatibilidade

- Produtos existentes: backfill automático via `DEFAULT true` → nada muda
  visualmente pro storefront.
- API/clientes externos: nenhum (Vitrê não expõe API pública).
- Cache `revalidateTag('store-${slug}')` continua acionando em `update.ts`
  — toggle publica/despublica reflete em ISR sem patch extra.
