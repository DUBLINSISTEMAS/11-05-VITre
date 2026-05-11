"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Lê `?erro=...` da URL e dispara um toast vermelho, depois limpa o param
 * sem reload.
 *
 * Existe pra fechar o silêncio do fluxo `/admin/produtos/novo` quando
 * `createDraftProduct()` falha e redireciona pra lista com a mensagem
 * em query string. Antes desse componente, o erro era engolido.
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
