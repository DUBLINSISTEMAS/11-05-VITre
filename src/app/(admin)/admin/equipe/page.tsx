import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Equipe — rota DESATIVADA até store_membership estar plugada.
 *
 * Sprint flash 2026-05-24 — régua "funciona ou esconde" (CLAUDE.md):
 * `getCurrentStore` (src/lib/store-context.ts:22-30) filtra apenas
 * `ownerId = userId` e IGNORA `store_membership`. Convidar membro
 * grava row na tabela MAS o membro nunca resolve loja no login →
 * redirect-loop silencioso. Feature inteira é fachada.
 *
 * Item já saiu do menu da sidebar (nav-items.ts) na sprint flash
 * anterior; agora bloqueamos por URL também. O código de UI original
 * (cards de owner + tabela de membros + cheatsheet de roles) está
 * preservado no git history — recuperar quando Bloco 8 da master list
 * de correção plugar getCurrentStore a store_membership.
 */
export default function EquipePage() {
  notFound();
}
