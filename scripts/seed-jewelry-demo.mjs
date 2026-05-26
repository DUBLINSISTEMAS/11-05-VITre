/**
 * Demo seed — Mangos Pay jewelry store. Idempotent.
 *
 * O QUE FAZ:
 *  1. Limpa categorias, produtos, banners, vitrines da loja-alvo (slug).
 *  2. Atualiza store: nicho="joia", cor primária dourada, descrição demo.
 *  3. Sobe imagens reais (Unsplash CC0) pro Supabase Storage via service role
 *     usando o MESMO pipeline do upload do lojista (sharp 800×800 WebP 75%).
 *  4. Insere 4 categorias de joia + 10 produtos + 3 banners.
 *
 * USAGE: node --env-file=.env.local scripts/seed-jewelry-demo.mjs [storeSlug]
 *        (default storeSlug = "dublin-sistemas")
 *
 * Idempotente — pode rodar várias vezes, sempre zera e refaz tudo na loja-alvo.
 * Scoped por store_id — não toca outras lojas.
 *
 * NOTA SaaS: este script é APENAS pra demo de apresentação. Em produção
 * lojista cadastra produtos via UI (drawer + upload). Não usar em loja real.
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import sharp from "sharp";

// --- Config ---------------------------------------------------------------
const STORE_SLUG = process.argv[2] || "dublin-sistemas";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DIRECT_URL = process.env.DIRECT_URL;

if (!SUPABASE_URL || !SERVICE_KEY || !DIRECT_URL) {
  console.error(
    "❌ ENV missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DIRECT_URL",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const pg = new Client({ connectionString: DIRECT_URL });

// --- Data -----------------------------------------------------------------
// Imagens: Unsplash CC0. Resolução 1200px (sharp depois reduz pra 800).

const CATEGORIES = [
  {
    slug: "aneis",
    name: "Anéis",
    description: "Anéis de ouro 18k, solitários, alianças e meias alianças.",
    imageUrl:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1200&q=80",
  },
  {
    slug: "brincos",
    name: "Brincos",
    description: "Argolas, pérolas, brincos de pressão e modelos clássicos.",
    imageUrl:
      "https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=1200&q=80",
  },
  {
    slug: "colares",
    name: "Colares",
    description: "Correntes, gargantilhas e pingentes em ouro e prata 925.",
    imageUrl:
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=1200&q=80",
  },
  {
    slug: "pulseiras",
    name: "Pulseiras",
    description: "Pulseiras, braceletes e bracelete com pingentes (charm).",
    imageUrl:
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1200&q=80",
  },
];

const PRODUCTS = [
  // Anéis
  {
    name: "Anel Solitário Ouro 18k 50pt",
    slug: "anel-solitario-ouro-50pt",
    categorySlug: "aneis",
    basePriceInCents: 489000,
    promoPriceInCents: 449000,
    costPriceInCents: 290000,
    stockQuantity: 4,
    minStockQuantity: 2,
    description:
      "Anel solitário em ouro 18k com diamante natural de 50 pontos (0.50 ct). Lapidação brilhante, cravação 4 garras clássica. Acompanha certificado de autenticidade e estojo de veludo.",
    isFeatured: true,
    images: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1200&q=80",
    ],
  },
  {
    name: "Aliança de Compromisso Ouro 18k 4mm",
    slug: "alianca-compromisso-ouro-4mm",
    categorySlug: "aneis",
    basePriceInCents: 298000,
    costPriceInCents: 175000,
    stockQuantity: 8,
    minStockQuantity: 3,
    description:
      "Par de alianças em ouro 18k, polidas, 4mm de largura, anatômica (confortável). Peso médio 8g cada. Pode ser gravada com nomes e data sem custo adicional.",
    isFeatured: true,
    images: [
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=1200&q=80",
    ],
  },
  {
    name: "Anel Meia Aliança Cravejada Ouro 18k",
    slug: "anel-meia-alianca-cravejada",
    categorySlug: "aneis",
    basePriceInCents: 1290000,
    costPriceInCents: 780000,
    stockQuantity: 2,
    minStockQuantity: 1,
    description:
      "Meia aliança em ouro 18k com 11 diamantes de 5 pontos cada (0.55 ct total). Peso 4.2g. Acabamento polido brilhante. Acompanha laudo gemológico.",
    isFeatured: false,
    images: [
      "https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=1200&q=80",
    ],
  },

  // Brincos
  {
    name: "Brinco Argola Ouro 18k Polida 20mm",
    slug: "brinco-argola-ouro-20mm",
    categorySlug: "brincos",
    basePriceInCents: 159000,
    promoPriceInCents: 139000,
    costPriceInCents: 89000,
    stockQuantity: 12,
    minStockQuantity: 4,
    description:
      "Par de argolas em ouro 18k polido, diâmetro 20mm, peso 3.2g o par. Fecho click discreto. Modelo atemporal — usa no dia a dia e em ocasiões formais.",
    isFeatured: true,
    images: [
      "https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=1200&q=80",
    ],
  },
  {
    name: "Brinco Pérola Cultivada 8mm Ouro 18k",
    slug: "brinco-perola-cultivada-8mm",
    categorySlug: "brincos",
    basePriceInCents: 219000,
    costPriceInCents: 135000,
    stockQuantity: 6,
    minStockQuantity: 2,
    description:
      "Brinco com pérola branca cultivada 8mm, montagem em ouro 18k. Fecho tarraxa. Pérola água doce, brilho lustroso uniforme. Tradicional — herança que passa de mãe pra filha.",
    isFeatured: true,
    images: [
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=1200&q=80",
    ],
  },
  {
    name: "Brinco Coração Ouro 18k Vazado",
    slug: "brinco-coracao-vazado",
    categorySlug: "brincos",
    basePriceInCents: 89000,
    costPriceInCents: 52000,
    stockQuantity: 18,
    minStockQuantity: 6,
    description:
      "Par de brincos coração vazado em ouro 18k, 10mm de altura, peso 1.4g o par. Fecho tarraxa. Delicado, ideal pra presente.",
    isFeatured: false,
    images: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1200&q=80",
    ],
  },

  // Colares
  {
    name: "Gargantilha Ouro 18k Corrente Veneziana 45cm",
    slug: "gargantilha-veneziana-45cm",
    categorySlug: "colares",
    basePriceInCents: 189000,
    costPriceInCents: 115000,
    stockQuantity: 10,
    minStockQuantity: 3,
    description:
      "Gargantilha em ouro 18k, malha veneziana fina, 45cm de comprimento, peso 2.3g. Fecho mosquetão reforçado. Use sozinha ou com pingente.",
    isFeatured: true,
    images: [
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=1200&q=80",
    ],
  },
  {
    name: "Colar Ouro 18k com Pingente Coração",
    slug: "colar-pingente-coracao",
    categorySlug: "colares",
    basePriceInCents: 259000,
    promoPriceInCents: 229000,
    costPriceInCents: 155000,
    stockQuantity: 5,
    minStockQuantity: 2,
    description:
      "Colar ouro 18k 50cm + pingente coração 12mm vazado. Conjunto pronto pra presente. Peso total 3.1g. Acompanha caixinha presente.",
    isFeatured: true,
    images: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1200&q=80",
    ],
  },

  // Pulseiras
  {
    name: "Pulseira Ouro 18k Cordão Baiano 18cm",
    slug: "pulseira-cordao-baiano",
    categorySlug: "pulseiras",
    basePriceInCents: 168000,
    costPriceInCents: 99000,
    stockQuantity: 7,
    minStockQuantity: 2,
    description:
      "Pulseira em ouro 18k, malha cordão baiano, 18cm de comprimento, peso 2.6g. Fecho mosquetão. Modelo brasileiro tradicional.",
    isFeatured: false,
    images: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1200&q=80",
    ],
  },
  {
    name: "Bracelete Ouro 18k Liso Polido",
    slug: "bracelete-liso-polido",
    categorySlug: "pulseiras",
    basePriceInCents: 549000,
    costPriceInCents: 320000,
    stockQuantity: 3,
    minStockQuantity: 1,
    description:
      "Bracelete em ouro 18k, modelo liso polido brilhante, largura 8mm, peso 7.8g. Abertura com mola interna pra ajuste no pulso. Peça de assinatura.",
    isFeatured: true,
    images: [
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=1200&q=80",
    ],
  },
];

const BANNERS = [
  {
    kicker: "NOVA COLEÇÃO · OURO 18K",
    title: "Solitários e alianças",
    subtitle: "Promoção do mês — descontos especiais em peças selecionadas.",
    ctaLabel: "Ver coleção",
    imageUrl:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1920&q=70",
  },
  {
    kicker: "ENXOVAL · NOIVAS",
    title: "O sim que dura",
    subtitle: "Coleção noivas — alianças cravejadas e solitários únicos.",
    ctaLabel: "Conhecer agora",
    imageUrl:
      "https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=1920&q=70",
  },
  {
    kicker: "PRESENTE · DIA DAS MÃES",
    title: "Pra quem nunca esquece de você",
    subtitle: "Colares, brincos e pulseiras com brinde especial.",
    ctaLabel: "Comprar agora",
    imageUrl:
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=1920&q=70",
  },
];

// --- Helpers --------------------------------------------------------------
function nanoId(len = 16) {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < len; i++)
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

// URL fallback — Unsplash CC0 joia genérica, testada e estável.
const IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1200&q=80";

/**
 * Baixa imagem da URL, comprime via sharp (800×800 WebP 75%), sobe pro
 * Supabase Storage e retorna a public URL. Replica o pipeline da action
 * `uploadProductImage` (lib/image.ts). Se a URL falhar, cai pro fallback —
 * garante que o seed completa mesmo se algum link do Unsplash der 404.
 */
async function fetchUploadImage(sourceUrl, bucket, pathInBucket) {
  let res = await fetch(sourceUrl);
  if (!res.ok) {
    console.warn(`  ⚠️  ${sourceUrl} → ${res.status}, usando fallback`);
    res = await fetch(IMAGE_FALLBACK);
    if (!res.ok) {
      throw new Error(`Fetch fallback também falhou → ${res.status}`);
    }
  }
  const arrayBuffer = await res.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);

  const processed = await sharp(rawBuffer)
    .rotate()
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(pathInBucket, processed, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "31536000, immutable",
    });
  if (uploadError) {
    throw new Error(`Upload ${bucket}/${pathInBucket}: ${uploadError.message}`);
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(pathInBucket);
  return data.publicUrl;
}

// --- Main -----------------------------------------------------------------
async function main() {
  console.log(`\n🪙 Seed jewelry demo → loja "${STORE_SLUG}"\n`);
  await pg.connect();

  // 1. Resolve store
  const storeRes = await pg.query(`SELECT id, slug FROM store WHERE slug = $1`, [
    STORE_SLUG,
  ]);
  if (storeRes.rowCount === 0) {
    console.error(`❌ Loja "${STORE_SLUG}" não encontrada.`);
    process.exit(1);
  }
  const store = storeRes.rows[0];
  console.log(`✓ Loja id=${store.id}`);

  // 2. Update store metadata (nicho + cor + descrição)
  await pg.query(
    `UPDATE store
        SET niche = 'joia',
            primary_color = '#9A7B4F',
            description = 'Joias autênticas em ouro 18k e prata 925.',
            updated_at = NOW()
      WHERE id = $1`,
    [store.id],
  );
  console.log(`✓ Store metadata atualizado (nicho=joia, cor=#9A7B4F)`);

  // 3. Delete existing data (scoped to this store)
  console.log(`\n🧹 Limpando dados existentes da loja...`);
  // Order matters — FKs ON DELETE CASCADE/SET NULL, mas explicito por segurança
  await pg.query(
    `DELETE FROM product_image WHERE store_id = $1`,
    [store.id],
  );
  await pg.query(
    `DELETE FROM product_variant WHERE store_id = $1`,
    [store.id],
  );
  // storefront_collection ref product/category via collection_item — limpa primeiro
  await pg.query(
    `DELETE FROM storefront_collection_item
       WHERE collection_id IN (
         SELECT id FROM storefront_collection WHERE store_id = $1
       )`,
    [store.id],
  );
  await pg.query(
    `DELETE FROM storefront_collection WHERE store_id = $1`,
    [store.id],
  );
  await pg.query(`DELETE FROM product WHERE store_id = $1`, [store.id]);
  await pg.query(`DELETE FROM category WHERE store_id = $1`, [store.id]);
  await pg.query(`DELETE FROM banner WHERE store_id = $1`, [store.id]);
  console.log(`✓ Limpeza concluída`);

  // 4. Insert categories with images
  console.log(`\n📁 Inserindo categorias...`);
  const categoryIds = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const path = `${store.id}/${nanoId()}.webp`;
    const imageUrl = await fetchUploadImage(
      cat.imageUrl,
      "category-images",
      path,
    );
    const r = await pg.query(
      `INSERT INTO category
         (store_id, slug, name, image_url, position, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [store.id, cat.slug, cat.name, imageUrl, i],
    );
    categoryIds[cat.slug] = r.rows[0].id;
    console.log(`  ✓ ${cat.name}`);
  }

  // 5. Insert products + 1 image each
  console.log(`\n💎 Inserindo produtos...`);
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const categoryId = categoryIds[p.categorySlug];
    if (!categoryId) {
      throw new Error(`Categoria não encontrada: ${p.categorySlug}`);
    }
    const productInsert = await pg.query(
      `INSERT INTO product
         (store_id, category_id, slug, name, description,
          base_price_in_cents, promo_price_in_cents, cost_price_in_cents,
          track_stock, stock_quantity, min_stock_quantity,
          unit, is_active, is_published_to_storefront, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, 'un', true, true, $11)
       RETURNING id`,
      [
        store.id,
        categoryId,
        p.slug,
        p.name,
        p.description,
        p.basePriceInCents,
        p.promoPriceInCents ?? null,
        p.costPriceInCents,
        p.stockQuantity,
        p.minStockQuantity,
        p.isFeatured,
      ],
    );
    const productId = productInsert.rows[0].id;

    // Upload + insert image(s)
    for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
      const path = `${store.id}/${productId}/${nanoId()}.webp`;
      const publicUrl = await fetchUploadImage(
        p.images[imgIdx],
        "product-images",
        path,
      );
      await pg.query(
        `INSERT INTO product_image (store_id, product_id, url, position)
         VALUES ($1, $2, $3, $4)`,
        [store.id, productId, publicUrl, imgIdx],
      );
    }
    console.log(
      `  ✓ ${p.name} — R$ ${(p.basePriceInCents / 100).toFixed(2).replace(".", ",")}`,
    );
  }

  // 6. Insert banners
  console.log(`\n🎨 Inserindo banners...`);
  for (let i = 0; i < BANNERS.length; i++) {
    const b = BANNERS[i];
    const path = `${store.id}/${nanoId()}.webp`;
    const publicUrl = await fetchUploadImage(
      b.imageUrl,
      "store-banners",
      path,
    );
    await pg.query(
      `INSERT INTO banner
         (store_id, image_url, link, kicker, title, subtitle, cta_label,
          position, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      [
        store.id,
        publicUrl,
        "/",
        b.kicker,
        b.title,
        b.subtitle,
        b.ctaLabel,
        i,
      ],
    );
    console.log(`  ✓ ${b.title}`);
  }

  console.log(`\n🎉 Seed concluído!`);
  console.log(`   Loja: ${STORE_SLUG} (id=${store.id})`);
  console.log(`   ${CATEGORIES.length} categorias · ${PRODUCTS.length} produtos · ${BANNERS.length} banners`);
  console.log(`   Acesse: https://vitre.site/${STORE_SLUG}\n`);
  await pg.end();
}

main().catch((e) => {
  console.error("\n❌ Seed falhou:", e.message);
  console.error(e.stack);
  pg.end().catch(() => {});
  process.exit(1);
});
