/**
 * Health check de Supabase Storage — lista buckets, policies e
 * contagem de objetos. Uso: `tsx scripts/check-storage.ts`
 *
 * Esperado (após 02_storage_buckets.sql aplicado):
 *   - 3 buckets: store-logos, store-banners, product-images (todos public)
 *   - 3 policies SELECT em storage.objects (uma por bucket, anon+authenticated)
 *   - Nenhuma policy de INSERT/UPDATE/DELETE (escrita via service_role)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const EXPECTED_BUCKETS = ["store-logos", "store-banners", "product-images"];

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL ausente em .env.local");

  const pool = new Pool({ connectionString: url });
  try {
    const buckets = await pool.query<{
      id: string;
      name: string;
      public: boolean;
      file_size_limit: number | null;
      allowed_mime_types: string[] | null;
    }>(`
      SELECT id, name, public, file_size_limit, allowed_mime_types
        FROM storage.buckets
       ORDER BY id
    `);

    const policies = await pool.query<{
      policyname: string;
      cmd: string;
      roles: string;
      qual: string | null;
      with_check: string | null;
    }>(`
      SELECT policyname, cmd, array_to_string(roles, ',') AS roles, qual, with_check
        FROM pg_policies
       WHERE schemaname = 'storage' AND tablename = 'objects'
       ORDER BY policyname
    `);

    const objCounts = await pool.query<{ bucket_id: string; count: string }>(`
      SELECT bucket_id, count(*)::text AS count
        FROM storage.objects
       GROUP BY bucket_id
       ORDER BY bucket_id
    `);

    console.log(`\n📦 Buckets (${buckets.rowCount}):`);
    if (buckets.rowCount === 0) {
      console.log(
        "  ⚠️  NENHUM bucket. Aplicar supabase/sql/02_storage_buckets.sql.",
      );
    } else {
      for (const b of buckets.rows) {
        const sizeMB = b.file_size_limit ? (b.file_size_limit / 1024 / 1024).toFixed(1) : "∞";
        const mimes = b.allowed_mime_types?.join(", ") ?? "qualquer";
        const pub = b.public ? "public" : "PRIVATE";
        console.log(`  • ${b.id} [${pub}] limit=${sizeMB}MB mimes=${mimes}`);
      }
    }

    const presentIds = new Set(buckets.rows.map((b) => b.id));
    const missing = EXPECTED_BUCKETS.filter((id) => !presentIds.has(id));
    if (missing.length > 0) {
      console.log(`\n  ❌ Faltando: ${missing.join(", ")}`);
    } else {
      console.log(`\n  ✅ Todos os 3 buckets esperados estão presentes.`);
    }

    console.log(`\n🔒 Policies em storage.objects (${policies.rowCount}):`);
    if (policies.rowCount === 0) {
      console.log("  ⚠️  Nenhuma policy. Anon não consegue ler nada.");
    } else {
      for (const p of policies.rows) {
        console.log(`  • ${p.policyname} [${p.cmd}] roles=${p.roles ?? "—"}`);
        if (p.qual) console.log(`      USING: ${p.qual}`);
        if (p.with_check) console.log(`      WITH CHECK: ${p.with_check}`);
      }
    }

    console.log(`\n📊 Objetos por bucket:`);
    if (objCounts.rowCount === 0) {
      console.log("  (vazio — nenhum upload feito ainda)");
    } else {
      for (const r of objCounts.rows) {
        console.log(`  • ${r.bucket_id}: ${r.count} arquivo(s)`);
      }
    }

    console.log("");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Falhou:", e.message);
  process.exit(1);
});
