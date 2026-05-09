/**
 * Pipeline de processamento de imagem com sharp.
 *
 * Pipeline (na ordem):
 *  1. Auto-rotate via EXIF — fotos do iPhone vêm rotacionadas; sem isso saem deitadas.
 *  2. Resize para max 800x800 (fit:inside, sem enlarge) — alvo do free tier.
 *  3. Convert para WebP 75% — bom balanço qualidade/tamanho. Resultado ~80-180 KB.
 *  4. Strip EXIF/metadata — privacidade. Fotos de iPhone vêm com GPS!
 *
 * Aceita HEIC do iPhone (libvips embutido em sharp suporta).
 *
 * Decisões em ADR-0003 e ADR-0005 (limites do free tier).
 */
import sharp from "sharp";

/**
 * Limite ANTES do sharp. Output é sempre WebP comprimido ~100-200 KB
 * (bem abaixo do limite do bucket 4MB no Supabase).
 */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB input bruto

/**
 * MIME types aceitos no upload bruto. sharp converte tudo para WebP no output.
 *
 * HEIC/HEIF NÃO está aqui propositalmente:
 * - sharp distribuído via npm para linux-x64 (Vercel) não suporta HEIC out-of-the-box
 *   (limitação de licença HEVC). Subir foto de iPhone resultaria em erro misterioso.
 * - Quando suportarmos: instalar `@img/sharp-libvips-linux-x64` ou usar `heic-convert`
 *   antes do sharp. TODO documentado em ADR-0003 (Fase 2).
 *
 * Mensagem amigável para usuário iOS está em `validateImageInput`.
 */
export const ALLOWED_INPUT_MIMES: ReadonlyArray<string> = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
];

export const COMPRESSED_TARGET_SIZE = 800;
export const COMPRESSED_QUALITY = 75;

export interface CompressedImage {
  buffer: Buffer;
  contentType: "image/webp";
  byteLength: number;
}

/**
 * Comprime e normaliza uma imagem para WebP 800x800.
 * Throw se sharp falhar (formato corrompido / não suportado).
 */
export async function compressImage(input: Buffer): Promise<CompressedImage> {
  const compressed = await sharp(input, { failOn: "error" })
    .rotate() // auto-orient pelo EXIF antes de strip
    .resize(COMPRESSED_TARGET_SIZE, COMPRESSED_TARGET_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: COMPRESSED_QUALITY, effort: 4 })
    .withMetadata({}) // strip EXIF (incluindo GPS); mantém apenas DPI
    .toBuffer();

  return {
    buffer: compressed,
    contentType: "image/webp",
    byteLength: compressed.byteLength,
  };
}

/**
 * Validação rápida do upload bruto antes de mandar para sharp.
 * Retorna mensagem de erro PT-BR ou null se OK.
 */
export function validateImageInput(file: File): string | null {
  if (file.size === 0) return "Arquivo vazio.";
  if (file.size > MAX_INPUT_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `Imagem muito grande (${mb}MB). Máximo 10MB.`;
  }
  // Mensagem específica para HEIC/HEIF (foto padrão do iPhone)
  if (file.type === "image/heic" || file.type === "image/heif") {
    return "Formato HEIC do iPhone ainda não é suportado. Em Ajustes do iPhone → Câmera → Formatos, escolha 'Mais Compatível' (JPEG).";
  }
  if (!ALLOWED_INPUT_MIMES.includes(file.type)) {
    return "Formato não suportado. Envie JPG, PNG, WebP ou AVIF.";
  }
  return null;
}
