/**
 * Compressão de imagem CLIENT-SIDE — primeira camada do pipeline de upload.
 *
 * Por quê:
 *   - Next 15 limita body de server action (`bodySizeLimit` em next.config
 *     é ignorado em algumas versões — bug #64680/#59277). Foto crua de
 *     iPhone (5-8 MB) estoura e retorna 413 antes da action ser invocada.
 *   - Sandra (e qualquer lojista) está em 4G de cidade pequena — subir
 *     5 MB é caro. Comprimir pra ~200 KB no celular dela é 25× menos banda.
 *   - Suporta fotos > 10 MB (input via desktop/fotógrafo profissional)
 *     sem precisar mexer em config server-side.
 *
 * Defesa em profundidade:
 *   - Esta compressão é OTIMIZAÇÃO de transporte, NÃO substitui a do server.
 *   - O server (`src/lib/image.ts:compressImage`) continua re-validando MIME,
 *     re-comprimindo, normalizando orientação EXIF, e principalmente
 *     STRIPANDO o EXIF (GPS da loja!).
 *   - Se essa compressão falhar (Safari iOS OOM, browser sem suporte a
 *     Web Worker, etc.), o caller faz fallback pro arquivo original.
 *     O server-side ainda processa, e se for >MAX_INPUT_BYTES, rejeita
 *     com mensagem clara.
 *
 * Decisões de parâmetros:
 *   - `maxSizeMB: 2` — folga sobre o limite de 4MB do bucket Supabase Storage
 *     e bem dentro do `bodySizeLimit` que vier a ser respeitado.
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
  maxSizeMB: 2,
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

/**
 * Comprime `file` no client. Em caso de erro (browser sem suporte,
 * memória estourada, formato exótico), retorna o arquivo original
 * com `compressed: false` — caller decide se manda assim mesmo ou
 * mostra erro.
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
    // Falha graceful: caller manda original e o server lida.
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
