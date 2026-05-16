/**
 * Gera ícones PWA a partir de public/brand/logo-principal.webp.
 * Saída: public/icons/icon-{192,512}{,-maskable}.png
 *
 * `any`: fundo branco, padding 12%
 * `maskable`: fundo brand #1E3FE6, padding 20% (safe area Android)
 *
 * Uso: pnpm exec tsx scripts/generate-pwa-icons.mjs
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const ROOT = resolve(process.cwd());
const SRC = resolve(ROOT, "public/brand/logo-principal.webp");
const OUT_DIR = resolve(ROOT, "public/icons");

async function ensureDir() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function generateIcon({
  size,
  bg,
  paddingRatio,
  outPath,
}) {
  const innerSize = Math.round(size * (1 - paddingRatio * 2));
  const offset = Math.round((size - innerSize) / 2);

  // Resize logo + composita sobre canvas colorido
  const logo = await sharp(SRC)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(outPath);

  console.log(`✅ ${outPath}`);
}

async function main() {
  await ensureDir();

  // Brand color #1E3FE6 = rgb(30, 63, 230)
  const brand = { r: 30, g: 63, b: 230, alpha: 1 };
  const white = { r: 255, g: 255, b: 255, alpha: 1 };

  await Promise.all([
    // any (transparente OK, mas fundo branco fica melhor cross-platform)
    generateIcon({
      size: 192,
      bg: white,
      paddingRatio: 0.12,
      outPath: resolve(OUT_DIR, "icon-192.png"),
    }),
    generateIcon({
      size: 512,
      bg: white,
      paddingRatio: 0.12,
      outPath: resolve(OUT_DIR, "icon-512.png"),
    }),
    // maskable (Android adaptativo — safe zone 80% central)
    generateIcon({
      size: 192,
      bg: brand,
      paddingRatio: 0.2,
      outPath: resolve(OUT_DIR, "icon-192-maskable.png"),
    }),
    generateIcon({
      size: 512,
      bg: brand,
      paddingRatio: 0.2,
      outPath: resolve(OUT_DIR, "icon-512-maskable.png"),
    }),
    // apple-touch-icon (180x180, fundo branco, sem padding extra)
    generateIcon({
      size: 180,
      bg: white,
      paddingRatio: 0.12,
      outPath: resolve(OUT_DIR, "apple-touch-icon.png"),
    }),
  ]);
}

main().catch((e) => {
  console.error("Falha:", e);
  process.exit(1);
});
