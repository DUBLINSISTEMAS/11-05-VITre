"use client";

/**
 * Bloco I.8 (2026-05-29) — dialog de import de clientes via CSV.
 *
 * Fluxo:
 *   1. Lojista clica "Importar CSV" → abre dialog.
 *   2. Seleciona arquivo .csv (ou cola conteúdo no textarea fallback).
 *   3. Componente parseia client-side, mapeia header (nome/telefone/email/
 *      documento/cidade/uf/obs) e mostra preview com contagem + alerts pra
 *      headers faltantes obrigatórios.
 *   4. Botão Importar chama `importCustomersCSV` (server action) que valida,
 *      dedup intra-batch + contra DB, insere em transação.
 *   5. Mostra relatório: criados / pulados duplicados / linhas com erro.
 *
 * Decisões:
 *   - Sem Papa Parse — parser inline em `@/lib/parse-csv` (≤500 rows é
 *     trivial, mantém bundle leve).
 *   - Anti-perda: dialog não fecha por Esc/click-fora enquanto importando.
 *   - Limita preview a 50 rows pra não travar a UI com CSV grande.
 */

import { ImportIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { importCustomersCSV, type ImportRowError } from "@/actions/customer/import-csv";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { mapHeaderToSchema, parseCSV } from "@/lib/parse-csv";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 50;
const MAX_BATCH = 500;

interface MappedRow {
  rowIndex: number;
  raw: Record<string, string>;
  /** Payload pronto pra mandar pro server (mesmo shape de createCustomerSchema input). */
  payload: Record<string, unknown>;
  /** Falta nome ou telefone? Marcamos vermelho na preview e descartamos antes do envio. */
  missingRequired: boolean;
}

export function CustomerImportButton() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mapped, setMapped] = useState<MappedRow[]>([]);
  const [headerWarning, setHeaderWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { created: number; skippedDuplicates: number; errors: ImportRowError[] }
    | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isImporting = isPending;

  function reset() {
    setFile(null);
    setMapped([]);
    setHeaderWarning(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setHeaderWarning(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { header, rows } = parseCSV(text);
      if (header.length === 0) {
        setMapped([]);
        setHeaderWarning("Arquivo vazio ou sem cabeçalho reconhecível.");
        return;
      }
      const headerMap = mapHeaderToSchema(header);
      const missing: string[] = [];
      if (headerMap.name === undefined) missing.push("nome");
      if (headerMap.phone === undefined) missing.push("telefone");
      if (missing.length > 0) {
        setMapped([]);
        setHeaderWarning(
          `Cabeçalho não tem coluna(s): ${missing.join(", ")}. ` +
            "Garanta colunas 'nome' e 'telefone' no CSV.",
        );
        return;
      }

      const mappedRows: MappedRow[] = rows.slice(0, MAX_BATCH).map((r, i) => {
        const raw: Record<string, string> = {};
        const payload: Record<string, unknown> = {};
        for (const [key, idx] of Object.entries(headerMap)) {
          if (idx === undefined) continue;
          const v = (r[idx] ?? "").trim();
          raw[key] = v;
          if (v) payload[key] = v;
        }
        const name = String(payload.name ?? "").trim();
        const phone = String(payload.phone ?? "").trim();
        return {
          rowIndex: i,
          raw,
          payload,
          missingRequired: name === "" || phone === "",
        };
      });

      setMapped(mappedRows);
      if (rows.length > MAX_BATCH) {
        setHeaderWarning(
          `Arquivo tem ${rows.length} linhas — só as primeiras ${MAX_BATCH} serão importadas nesta leva. Importe o restante em um segundo arquivo.`,
        );
      }
    };
    reader.onerror = () => {
      setHeaderWarning("Não consegui ler o arquivo. Tente de novo.");
    };
    reader.readAsText(f, "utf-8");
  }

  function handleImport() {
    const validPayloads = mapped
      .filter((r) => !r.missingRequired)
      .map((r) => r.payload);
    if (validPayloads.length === 0) {
      toast.error("Nenhuma linha válida pra importar.");
      return;
    }
    startTransition(async () => {
      const res = await importCustomersCSV({ rows: validPayloads });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult({
        created: res.created,
        skippedDuplicates: res.skippedDuplicates,
        errors: res.errors,
      });
      toast.success(
        `${res.created} ${res.created === 1 ? "cliente importado" : "clientes importados"}` +
          (res.skippedDuplicates > 0
            ? ` · ${res.skippedDuplicates} pulado(s) por duplicidade`
            : "") +
          (res.errors.length > 0
            ? ` · ${res.errors.length} com erro`
            : ""),
      );
      router.refresh();
    });
  }

  const validCount = mapped.filter((r) => !r.missingRequired).length;
  const invalidCount = mapped.length - validCount;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isImporting) return; // anti-perda
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5 h-8">
          <ImportIcon size={14} aria-hidden />
          <span className="hidden sm:inline">Importar CSV</span>
          <span className="sm:hidden">CSV</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => isImporting && e.preventDefault()}
        onEscapeKeyDown={(e) => isImporting && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Importar clientes do CSV</DialogTitle>
          <DialogDescription>
            Arquivo precisa de cabeçalho com colunas <strong>nome</strong> e{" "}
            <strong>telefone</strong> (obrigatórias). Opcionais: email,
            documento, cidade, uf, obs. Aceita separador <code>,</code> ou{" "}
            <code>;</code>. Limite: {MAX_BATCH} linhas por arquivo.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="border-line rounded-md border border-dashed p-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                id="csv-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <label
                htmlFor="csv-file"
                className="b3-btn b3-btn--sm inline-flex cursor-pointer items-center gap-1.5"
              >
                <UploadIcon size={14} aria-hidden />
                {file ? file.name : "Escolher arquivo .csv"}
              </label>
              <p className="text-ink-4 mt-2 text-[11px]">
                Excel: "Salvar como… CSV (separado por vírgula)".
              </p>
            </div>

            {headerWarning ? (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-[12.5px]">
                {headerWarning}
              </div>
            ) : null}

            {mapped.length > 0 ? (
              <>
                <div className="text-ink-3 flex flex-wrap items-baseline gap-2 text-[12.5px]">
                  <span className="text-ink-1 font-semibold">
                    {validCount} válida(s)
                  </span>
                  {invalidCount > 0 ? (
                    <span className="text-destructive">
                      · {invalidCount} inválida(s) (sem nome/telefone)
                    </span>
                  ) : null}
                </div>
                <div className="border-line max-h-[280px] overflow-auto rounded-md border">
                  <table className="b3-tbl w-full text-[12px]">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Nome</th>
                        <th>Telefone</th>
                        <th>Email</th>
                        <th>Doc.</th>
                        <th>Cidade/UF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapped.slice(0, PREVIEW_LIMIT).map((r) => (
                        <tr
                          key={r.rowIndex}
                          className={cn(
                            r.missingRequired && "bg-destructive/5",
                          )}
                        >
                          <td className="text-ink-4 mono">{r.rowIndex + 1}</td>
                          <td>{r.raw.name ?? ""}</td>
                          <td className="mono">{r.raw.phone ?? ""}</td>
                          <td className="text-ink-3">{r.raw.email ?? ""}</td>
                          <td className="mono">{r.raw.document ?? ""}</td>
                          <td className="text-ink-3">
                            {[r.raw.addressCity, r.raw.addressState]
                              .filter(Boolean)
                              .join("/")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mapped.length > PREVIEW_LIMIT ? (
                    <div className="text-ink-4 border-line border-t p-2 text-center text-[11px]">
                      … +{mapped.length - PREVIEW_LIMIT} linhas. Importação
                      processa todas.
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isImporting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={isImporting || validCount === 0}
              >
                {isImporting ? (
                  <Loader2Icon size={14} className="animate-spin" />
                ) : (
                  <ImportIcon size={14} />
                )}
                Importar {validCount > 0 ? `${validCount}` : ""}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[14px]">
                <strong className="text-ink-1">{result.created}</strong>{" "}
                {result.created === 1 ? "cliente criado" : "clientes criados"}
                {result.skippedDuplicates > 0 ? (
                  <>
                    {" "}· <strong>{result.skippedDuplicates}</strong> pulado(s)
                    (telefone já cadastrado)
                  </>
                ) : null}
              </p>
              {result.errors.length > 0 ? (
                <div className="border-line max-h-[200px] overflow-auto rounded-md border p-2">
                  <p className="text-destructive mb-1 text-[12px] font-semibold">
                    {result.errors.length}{" "}
                    {result.errors.length === 1 ? "erro" : "erros"}:
                  </p>
                  <ul className="space-y-1 text-[12px]">
                    {result.errors.map((e) => (
                      <li key={e.rowIndex} className="text-ink-3">
                        <span className="text-ink-1 font-medium">
                          {e.rowName}
                        </span>{" "}
                        — {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
