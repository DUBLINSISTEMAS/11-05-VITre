// One-shot — identifica lojas no DB. Read-only.
import { Client } from "pg";
const c = new Client({ connectionString: process.env.DIRECT_URL });
await c.connect();
const r = await c.query(`
  SELECT id, slug, name, owner_id, primary_color, logo_url, document, niche
    FROM store
   ORDER BY created_at DESC
   LIMIT 10;
`);
console.log(`${r.rows.length} loja(s):\n`);
for (const row of r.rows) {
  console.log(`  ${row.slug}  ${row.name}`);
  console.log(`    id=${row.id}`);
  console.log(`    nicho=${row.niche ?? "—"} · doc=${row.document ?? "—"}`);
  console.log(`    logo=${row.logo_url ? "✓" : "✗"}`);
  console.log();
}
await c.end();
