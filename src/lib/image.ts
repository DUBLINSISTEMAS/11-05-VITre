/**
 * Pipeline de processamento de imagem com sharp.
 *
 * Pipeline (na ordem):
 *  1. Auto-rotate via EXIF — fotos do iPhone vêm rotacionadas; sem isso saem deitadas.
 *  2. Resize para max 1600x1600 (fit:inside, sem enlarge).
 *  3. Convert para WebP 82% — qualidade premium pra retina/desktop sem
 *     explodir bytes. Resultado ~250-500 KB.
 *  4. Strip EXIF/metadata — privacidade. Fotos de iPhone vêm com GPS!
 *
 * Aceita HEIC do iPhone (libvips embutido em sharp suporta).
 *
 * Decisões em ADR-0003 e ADR-0005 (limites do free tier).
 *
 * Mudança 2026-05-26 (Onda 3.2 redesign storefront):
 *   - 800×800 q75 → 1600×1600 q82. Justificativa: storefront em telas
 *     retina/desktop 4K mostrava produtos perceptivelmente borrados;
 *     800px ficava upscaled pelo browser. 1600px cobre DPR=2 em telas
 *     até ~800px de largura efetiva (galeria PDP desktop) sem upscale.
 *     Next.js loader gera variants intermediárias do srcset
 *     automaticamente — não há custo extra de banda em mobile.
 *   - Imagens antigas (800px) continuam funcionando — migration
 *     silenciosa, re-upload é opt-in pelo lojista.
 */
import sharp from "sharp";

/**
 * Limite ANTES do sharp. Alinhado com `next.config.ts:bodySizeLimit` ('4mb').
 *
 * Pipeline em duas camadas:
 *   1. browser-image-compression no client comprime arquivo bruto (até 25 MB)
 *      pra WebP ~2 MB antes do FormData (otimização de transporte).
 *   2. sharp 1600x1600 WebP 82% no server (gate de qualidade + EXIF strip).
 *
 * Server recebe sempre ≤4 MB — se algo subir maior, o body limit do Next
 * rejeita com 413 antes da action executar. Output do sharp é sempre
 * WebP ~250-500 KB.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

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

export const COMPRESSED_TARGET_SIZE = 1600;
export const COMPRESSED_QUALITY = 82;

export interface CompressedImage {
  buffer: Buffer;
  contentType: "image/webp";
  byteLength: number;
}

/**
 * Comprime e normaliza uma imagem para WebP 1600x1600.
 * Throw se sharp falhar (formato corrompido / não suportado).
 *
 * `failOn: "truncated"` (não `"error"`): libvips dispara warnings em fotos
 * de iPhone perfeitamente válidas (ICC profile estranho, marcador EXIF
 * inesperado, JFIF/Adobe segments inconsistentes). Com `"error"` esses
 * warnings viram rejeição fatal e o usuário vê "Não conseguimos processar
 * essa imagem" em fotos que abrem normalmente em qualquer outro app.
 * `"truncated"` mantém a rejeição pra arquivos genuinamente corrompidos.
 */
export async function compressImage(input: Buffer): Promise<CompressedImage> {
  const compressed = await sharp(input, { failOn: "truncated" })
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
  if (file.size > MAX_UPLOAD_BYTES) {
    // Em condições normais o client comprime pra <2 MB antes do FormData.
    // Cair aqui = compressão client falhou ou foi burlada. Mensagem
    // genérica porque o usuário não tem como acionar diretamente esse path.
    return "Imagem muito grande após otimização. Tente uma foto diferente.";
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

// =====================================================================
// Sprint 6C — Magic bytes (validação do conteúdo real do arquivo).
//
// Por quê: validateImageInput confia no `file.type` declarado pelo
// browser. Atacante pode renomear .exe pra .png e enviar — Next aceita
// (MIME passa), sharp depois falha com mensagem genérica. Pior: certos
// binários "começam parecido com imagem" e enganam sharp por mais
// alguns bytes antes de falhar.
//
// Validar magic bytes ANTES do sharp:
//   1. Rejeição imediata com mensagem clara
//   2. Sharp não é chamado pra binário malicioso (reduz superfície)
//   3. Defesa em profundidade contra futura vulnerabilidade do libvips
//
// Tipos suportados (alinhados com ALLOWED_INPUT_MIMES):
//   - JPEG:  FF D8 FF
//   - PNG:   89 50 4E 47 0D 0A 1A 0A
//   - WebP:  RIFF....WEBP (bytes 0-3 "RIFF", bytes 8-11 "WEBP")
//   - AVIF:  bytes 4-11 = "ftypavif" / "ftypavis" / "ftypmif1"
// =====================================================================

export type DetectedImageType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | null;

/**
 * Detecta o formato real do arquivo lendo os primeiros 12 bytes.
 * Retorna o MIME detectado ou `null` se não bater com nenhum formato
 * suportado.
 */
export function detectImageMagic(buffer: Buffer): DetectedImageType {
  if (buffer.byteLength < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" no início + "WEBP" nos bytes 8-11
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "image/webp";
  }

  // AVIF (ISO BMFF): bytes 4-7 = "ftyp", bytes 8-11 com brand AVIF.
  // "avif" (image), "avis" (image sequence), "mif1" (HEIF mas
  // alguns AVIFs usam). Cobertura ampla pra não rejeitar arquivo
  // legítimo só porque a brand é variante.
  if (
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70 // p
  ) {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis" || brand === "mif1") {
      return "image/avif";
    }
  }

  return null;
}

/**
 * Valida que os magic bytes do buffer correspondem ao MIME declarado
 * (`declaredMime` vindo de `file.type`). Retorna mensagem de erro
 * PT-BR ou `null` se OK.
 *
 * Chamado ANTES de `compressImage` em todos os upload actions
 * (product, category, store) — protege sharp de input adversário.
 */
export function validateImageMagicBytes(
  buffer: Buffer,
  declaredMime: string,
): string | null {
  const detected = detectImageMagic(buffer);
  if (detected === null) {
    return "Arquivo não é uma imagem válida (assinatura desconhecida).";
  }
  // Aceita JPEG declarado como image/jpg (alias comum). Senão,
  // detected DEVE bater com declarado — diferença = arquivo falsificado.
  const normalizedDeclared =
    declaredMime === "image/jpg" ? "image/jpeg" : declaredMime;
  if (detected !== normalizedDeclared) {
    return `Tipo de arquivo declarado (${declaredMime}) não bate com o conteúdo (${detected}).`;
  }
  return null;
}
