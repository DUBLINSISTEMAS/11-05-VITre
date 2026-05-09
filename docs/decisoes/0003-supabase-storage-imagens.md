# ADR-0003: Supabase Storage para imagens

- **Data**: 2026-05-07
- **Status**: aceito

## Contexto

Vitrê precisa armazenar: logos das lojas, banners, fotos de produto (galeria de até 30 imagens por produto). Já estamos usando Supabase para Postgres. Adicionar S3/R2/UploadThing significa mais um vendor a gerenciar, billing separado, IAM separado.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Supabase Storage | Single vendor, RLS unificada, transformações nativas | Custo escala com storage |
| Cloudflare R2 | Egress grátis | Mais um vendor, sem transformações nativas |
| AWS S3 + CloudFront | Padrão de mercado | Complexidade IAM, billing separado |
| UploadThing | DX excelente | Lock-in, custo por upload |

## Decisão

**Supabase Storage.**

Buckets:
- `store-logos/<storeId>/logo.webp`
- `store-banners/<storeId>/<bannerId>.webp`
- `product-images/<storeId>/<productId>/<imageId>.webp`

Política (revisada por [ADR-0005](0005-free-tier-supabase-vercel-resend.md) — Supabase Free):
- Upload via signed URL gerada server-side (server action verifica `storeId` do owner via Better Auth).
- Compressão `sharp` antes do upload: **800x800, 75% qualidade, formato WebP**.
- Limite no app: **max 5 imagens por produto**, max 4MB por upload bruto, ~150 KB pós-compressão.
- Bucket público para leitura (catálogo público), escrita apenas via signed URL.
- Imagens servidas via `next/image` (Vercel Image Optimization) para reduzir egress do Supabase.

## Consequências

- ✅ Single dashboard, single billing.
- ✅ RLS unificada com o DB.
- ✅ Transformações nativas (resize on-the-fly via query param).
- ⚠️ Custo escala com storage — política dura de "max 5 fotos por produto, ~150 KB cada pós-compressão" no app.
- ⚠️ Sandra com 50 produtos × 5 imagens × ~150 KB = ~37 MB. Cabem ~25 lojas desse tamanho em 1 GB free.
- 🔧 Dívida: monitorar storage usage semanalmente. Migrar Supabase Free → Pro quando atingir 80% (800 MB). Ver [ADR-0005](0005-free-tier-supabase-vercel-resend.md).

## Quem decidiu

Anderson Felipe (founder) + Conselho-5-agentes.
