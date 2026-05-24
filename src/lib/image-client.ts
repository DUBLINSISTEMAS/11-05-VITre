/**
 * Compressão de imagem CLIENT-SIDE — primeira camada do pipeline de upload.
 *
 * Por quê:
 *   - Next 15 limita body de server action (`bodySizeLimit` em next.config
 *     é ignorado em algumas versões — bug #64680/#59277). Foto crua de
 *     iPhone (5-8 MB) estoura e retorna 413 antes da action ser invocada.
 *   - Lojista (típico Mangos Pay) está em 4G de cidade pequena — subir
 *     5 MB é caro. Comprimir pra ~200 KB no celular dela é 25× menos banda.
 *   - Suporta fotos grandes de celular (até 25 MB) sem precisar mexer em
 *     config server-side.
 *
 * Política de limites (pesquisada: Shopify 20 MB, Nuvemshop 10 MB):
 *   - Aceita arquivo original ATÉ 25 MB. Acima, rejeita explicitamente
 *     no client (sem nem tentar comprimir, evita OOM).
 *   - Comprime alvo: 2 MB / 2400px max (produto). Banner: 1 MB / 2000px.
 *   - Output sempre WebP (formato final do pipeline).
 *
 * Defesa em profundidade:
 *   - Esta compressão é OTIMIZAÇÃO de transporte, NÃO substitui a do server.
 *   - O server (`src/lib/image.ts:compressImage`) continua re-validando MIME,
 *     re-comprimindo, normalizando orientação EXIF, e principalmente
 *     STRIPANDO o EXIF (GPS da loja!).
 *   - Se essa compressão falhar (Safari iOS OOM, browser sem suporte a
 *     Web Worker, etc.), o caller mostra erro claro. Não enviamos o original
 *     porque ele pode estourar o bodySizeLimit antes da action executar.
 *
 * @see ADR-0010 (decisões pré-deploy de imagem) — quando criar.
 */
import imageCompression, {
  type Options as ImageCompressionOptions,
} from "browser-image-compression";

import { clientEnv } from "@/lib/env-client";
import { logger } from "@/lib/logger";

/**
 * Teto absoluto pro arquivo bruto entrando no pipeline client.
 * Acima disso rejeitamos sem tentar comprimir (OOM risk no celular).
 */
export const MAX_RAW_UPLOAD_BYTES = 25 * 1024 * 1024;

const DEFAULT_OPTIONS: ImageCompressionOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2400,
  useWebWorker: true,
  fileType: "image/webp",
  initialQuality: 0.82,
};

export interface CompressClientResult {
  /** Arquivo final que vai pro FormData. */
  file: File;
  /** Foi comprimido com sucesso (false = fallback pro original). */
  compressed: boolean;
  /** Tamanho original em bytes (pra log/UI). */
  originalSize: number;
  /** Tamanho final em bytes. */
  finalSize: number;
}

/** Mensagem de fallback quando a compressão falha (browser sem suporte etc). */
export const IMAGE_COMPRESSION_FAILED_MESSAGE =
  "Não conseguimos preparar essa imagem. Tente uma foto diferente.";

/** Arquivo bruto acima do teto absoluto. */
export const IMAGE_TOO_LARGE_MESSAGE =
  "Imagem muito grande (máximo 25 MB). Tente uma foto menor ou comprima antes de enviar.";

/**
 * Erro síncrono: arquivo acima de MAX_RAW_UPLOAD_BYTES. Caller trata e
 * mostra `IMAGE_TOO_LARGE_MESSAGE` sem rodar a compressão.
 */
export class ImageTooLargeError extends Error {
  readonly originalSize: number;
  constructor(originalSize: number) {
    super(IMAGE_TOO_LARGE_MESSAGE);
    this.name = "ImageTooLargeError";
    this.originalSize = originalSize;
  }
}

/**
 * Comprime `file` no client. Em caso de erro genérico (browser sem suporte,
 * memória estourada, formato exótico), retorna o arquivo original com
 * `compressed: false` — caller aborta com toast claro, sem mandar o original
 * pra rede (pode estourar bodySizeLimit antes da action executar).
 *
 * Lança `ImageTooLargeError` SE o arquivo bruto for maior que 25 MB
 * (caller mostra mensagem clara antes de tentar comprimir).
 */
export async function compressImageClient(
  file: File,
  options?: Partial<ImageCompressionOptions>,
): Promise<CompressClientResult> {
  const originalSize = file.size;

  if (originalSize > MAX_RAW_UPLOAD_BYTES) {
    throw new ImageTooLargeError(originalSize);
  }

  try {
    const compressed = await imageCompression(file, {
      ...DEFAULT_OPTIONS,
      ...options,
    });

    // A lib retorna `File` (não `Blob`) — type declaration confirma.
    // Renomeamos pra .webp pra manter coerência com fileType final.
    const finalFile =
      compressed.name.endsWith(".webp") || compressed.name.endsWith(".WEBP")
        ? compressed
        : new File([compressed], renameToWebp(file.name), {
            type: compressed.type || "image/webp",
            lastModified: Date.now(),
          });

    return {
      file: finalFile,
      compressed: true,
      originalSize,
      finalSize: finalFile.size,
    };
  } catch (e) {
    // Falha graceful: caller aborta com toast claro, sem mandar original.
    if (clientEnv.isDev) {
      logger.warn("image.client_compression_failed", { err: e });
    }
    return {
      file,
      compressed: false,
      originalSize,
      finalSize: originalSize,
    };
  }
}

function renameToWebp(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.webp`;
}
