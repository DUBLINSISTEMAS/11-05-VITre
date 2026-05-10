// Atualiza banner principal da Sandra Brito com texto editorial canvas-v1.
// Roda uma vez após migration 0007.
const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

const SANDRA_BANNER_ID = "933da21b-e87a-4c24-86d0-a4353baa2e44";

(async () => {
  const c = new Client({ connectionString: process.env.DIRECT_URL });
  await c.connect();
  const r = await c.query(
    `UPDATE banner SET
       kicker = $1,
       title = $2,
       subtitle = $3,
       cta_label = $4,
       image_alt = $5
     WHERE id = $6
     RETURNING kicker, title, subtitle, cta_label, image_alt`,
    [
      "NOVA COLEÇÃO · OUTONO 26",
      "Linhas que respiram.",
      "14 peças em algodão e linho.",
      "Ver coleção",
      "Banner da Sandra Brito Collection",
      SANDRA_BANNER_ID,
    ],
  );
  console.log(JSON.stringify(r.rows[0], null, 2));
  await c.end();
})();
