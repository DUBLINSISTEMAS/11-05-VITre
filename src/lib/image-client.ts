/**
 * Compressão de imagem CLIENT-SIDE — primeira camada do pipeline de upload.
 *
 * Por quê:
 *   - Next 15 limita body de server action (`bodySizeLimit` em next.config
 *     é ignorado em algumas versões — bug #64680/#59277). Foto crua de
 *     iPhone (5-8 MB) estoura e retorna 413 antes da action ser invocada.
 *   - Lojista (típico Vitrê) está em 4G de cidade pequena — subir
 *     5 MB é caro. Comprimir pra ~200 KB no celular dela é 25× menos banda.
 *   - Suporta fotos grandes de celular sem precisar mexer em config
 *     server-side.
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
 * Decisões de parâmetros:
 *   - `maxSizeMB: 6` — margem abaixo do limite canonico de 8 MB.
 *   - `maxWidthOrHeight: 1600` — server-side resize pra 800px depois;
 *     1600 dá margem de qualidade pro sharp redimensionar sem artefatos.
 *   - `useWebWorker: true` — não trava UI durante compressão (~2-5s no celular).
 *   - `fileType: "image/webp"` — output já no formato final do pipeline.
 *     Servidor ainda re-comprime (defesa), mas economiza um round-trip.
 *
 * @see ADR-0010 (decisões pré-deploy de imagem) — quando criar.
 */
import imageCompression, {
  type Options as ImageCompressionOptions,
} from "browser-image-compression";

import { clientEnv } from "@/lib/env-client";

const DEFAULT_OPTIONS: ImageCompressionOptions = {
  maxSizeMB: 6,
  maxWidthOrHeight: 1600,
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

export const IMAGE_COMPRESSION_FAILED_MESSAGE =
  "Não foi possível otimizar essa imagem. Tente uma foto menor que 8 MB.";

/**
 * Comprime `file` no client. Em caso de erro (browser sem suporte,
 * memória estourada, formato exótico), retorna o arquivo original
 * com `compressed: false` para o caller abortar com mensagem clara.
 *
 * Não joga exceção. Nunca.
 */
export async function compressImageClient(
  file: File,
  options?: Partial<ImageCompressionOptions>,
): Promise<CompressClientResult> {
  const originalSize = file.size;

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
      console.warn("[image-client] compressão falhou, usando original", e);
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
