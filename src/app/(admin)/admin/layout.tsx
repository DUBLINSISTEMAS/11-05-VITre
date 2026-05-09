import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/shell/admin-shell";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

/**
 * Layout do painel admin.
 * - Guarda de auth: `requireSession()` redireciona para /entrar se sem login.
 * - Guarda de loja: redireciona para /criar-loja/identidade se logado mas sem loja.
 * - Aplica AdminShell (header + bottom nav + ornamento de fundo) em todas as páginas.
 *
 * `getCurrentStore` usa `cache()` para evitar query duplicada quando páginas
 * filhas precisam da loja.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) redirect("/criar-loja/identidade");

  return (
    <AdminShell
      ownerName={session.user.name}
      ownerEmail={session.user.email}
      storeName={store.name}
      storeSlug={store.slug}
    >
      {children}
    </AdminShell>
  );
}
