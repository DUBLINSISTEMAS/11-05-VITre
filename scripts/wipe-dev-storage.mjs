/**
 * Limpa arquivos nos buckets de Storage que pertencem à loja "dublin-sistemas".
 *
 * O Postgres tem ON DELETE CASCADE nos rows, mas o Storage vive separado —
 * arquivos viram lixo se não forem deletados aqui.
 *
 * Estratégia: para cada bucket, lista todos os objetos e deleta os que
 * estão no caminho da loja. A convenção do app é prefixar com storeId/...
 * (ver src/lib/supabase/storage.ts), então usamos o storeId pra filtrar.
 *
 * Modo dry-run: passar --dry. Sem --dry, deleta de verdade.
 *
 * IMPORTANTE: rode DEPOIS do wipe-dev-store.sql (COMMIT) — depois do delete,
 * pegamos o storeId via cache, então é melhor pegar AGORA (antes do delete).
 * Por isso o script aceita STORE_ID via env: STORE_ID=<uuid> node ...
 * Sem env, ele tenta resolver via slug — só funciona se a store ainda existir.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const DRY = process.argv.includes("--dry");
const BUCKETS = ["product-images", "store-logos", "store-banners", "category-images"];

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supaUrl || !serviceRole) {
  console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios em .env.local");
  process.exit(1);
}

const sb = createClient(supaUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveStoreId() {
  if (process.env.STORE_ID) return process.env.STORE_ID;
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });
  try {
    const r = await pool.query(`SELECT id FROM store WHERE slug = 'dublin-sistemas'`);
    return r.rows[0]?.id ?? null;
  } finally {
    await pool.end();
  }
}

async function listAllInBucket(bucket, prefix = "") {
  // listFiles é paginado e não recursivo — fazemos walk manual.
  const out = [];
  const queue = [prefix];
  while (queue.length) {
    const p = queue.shift();
    let offset = 0;
     
    while (true) {
      const { data, error } = await sb.storage
        .from(bucket)
        .list(p, { limit: 1000, offset });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const item of data) {
        const full = p ? `${p}/${item.name}` : item.name;
        if (item.id === null && item.metadata === null) {
          // é "pasta" — adicionar à queue
          queue.push(full);
        } else {
          out.push(full);
        }
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  return out;
}

async function main() {
  const storeId = await resolveStoreId();
  if (!storeId) {
    console.log("(loja dublin-sistemas não encontrada — talvez já tenha sido deletada do banco)");
    console.log("Listando TUDO em cada bucket pra você decidir manualmente:");
  } else {
    console.log(`Store ID: ${storeId}`);
    console.log(`Modo: ${DRY ? "DRY-RUN (nada será apagado)" : "REAL (vai apagar de verdade)"}`);
  }
  console.log();

  for (const bucket of BUCKETS) {
    const all = await listAllInBucket(bucket);
    const owned = storeId ? all.filter((p) => p.startsWith(`${storeId}/`)) : all;

    console.log(`📦 ${bucket}: ${all.length} arquivos totais, ${owned.length} pertencem à loja`);

    if (owned.length === 0) {
      console.log(`   (nada a apagar)`);
      continue;
    }

    for (const p of owned.slice(0, 5)) console.log(`   - ${p}`);
    if (owned.length > 5) console.log(`   ... e mais ${owned.length - 5}`);

    if (!DRY) {
      const { error } = await sb.storage.from(bucket).remove(owned);
      if (error) {
        console.error(`   ❌ Falha: ${error.message}`);
      } else {
        console.log(`   ✓ Apagados`);
      }
    }
    console.log();
  }

  if (DRY) console.log("✓ Dry-run completo. Nenhum arquivo foi apagado.");
}

main().catch((e) => {
  console.error("Falha:", e.message);
  process.exit(1);
});
