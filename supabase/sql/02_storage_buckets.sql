-- =====================================================================
-- Vitrê — Setup de Supabase Storage buckets
-- =====================================================================
-- Como aplicar:
--   1. Abra Supabase Dashboard → SQL Editor → cole este arquivo → Run.
--   2. Confirme criação rodando query no final.
--
-- Buckets criados (todos public para read; escrita só via service_role):
--   - store-logos     → logos das lojas
--   - store-banners   → banners da home da loja
--   - product-images  → fotos de produto (galeria)
--   - category-images → ícones circulares de categoria (Fase 1.5)
--
-- Limite de 4MB por upload (sharp comprime para ~150KB antes — limite é
-- safety-net do servidor). Apenas WebP é aceito (sharp converte tudo).
--
-- Documentação: docs/decisoes/0003-supabase-storage-imagens.md
-- =====================================================================

-- ============================================================
-- Criar buckets (idempotente)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('store-logos',     'store-logos',     true, 4194304, ARRAY['image/webp']::text[]),
  ('store-banners',   'store-banners',   true, 4194304, ARRAY['image/webp']::text[]),
  ('product-images',  'product-images',  true, 4194304, ARRAY['image/webp']::text[]),
  ('category-images', 'category-images', true, 4194304, ARRAY['image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- Policies de leitura pública (anon pode SELECT)
-- ============================================================
-- O Supabase já cria policy automática 'Allow public read' quando bucket
-- é criado como public, mas garantimos explicitamente:

DO $$
BEGIN
  -- store-logos: leitura pública
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'public_read_store_logos'
  ) THEN
    CREATE POLICY public_read_store_logos ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'store-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'public_read_store_banners'
  ) THEN
    CREATE POLICY public_read_store_banners ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'store-banners');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'public_read_product_images'
  ) THEN
    CREATE POLICY public_read_product_images ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'public_read_category_images'
  ) THEN
    CREATE POLICY public_read_category_images ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'category-images');
  END IF;
END $$;

-- ============================================================
-- IMPORTANTE: a escrita (INSERT/UPDATE/DELETE) é feita APENAS pelo
-- service_role do Vitrê em server actions. Sem policy de write para
-- anon/authenticated → ataques diretos via supabase-js anon são bloqueados.
-- ============================================================

-- ============================================================
-- Verificação — execute para confirmar
-- ============================================================
SELECT id, name, public, file_size_limit, allowed_mime_types
  FROM storage.buckets
 WHERE id IN ('store-logos', 'store-banners', 'product-images', 'category-images')
 ORDER BY id;
