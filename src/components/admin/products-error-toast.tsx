"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Lê `?erro=...` da URL e dispara um toast vermelho, depois limpa o param
 * sem reload.
 *
 * Hoje cobre erros vindos de actions que ainda redirecionam pra lista
 * com mensagem em query string (delete via menu, bulk falhando antes
 * do toast). Mantido genérico — qualquer action pode passar `?erro=...`.
 *
 * Convenção CLAUDE.md #9: deve ser embrulhado em `<Suspense>` no caller
 * (useSearchParams() força client + Suspense em Next 15).
 */
export function ProductsErrorToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const erro = searchParams.get("erro");
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!erro || shownRef.current === erro) return;
    shownRef.current = erro;
    toast.error(erro);

    // Limpa só o ?erro=, preserva o resto (filtros, paginação).
    const next = new URLSearchParams(searchParams.toString());
    next.delete("erro");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [erro, pathname, router, searchParams]);

  return null;
}
