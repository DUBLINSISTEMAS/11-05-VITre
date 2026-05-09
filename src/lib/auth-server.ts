/**
 * Helpers de auth para Server Components e route handlers.
 *
 * `getSessionOrNull` é envolvido em `cache()` do React: múltiplas chamadas
 * no MESMO request (ex: layout + page do admin) executam a query do Better
 * Auth uma única vez. Evita roundtrip duplicado ao DB.
 *
 * Padrão de uso:
 *   const session = await requireSession();   // throw redirect se não logado
 *   const session = await getSessionOrNull(); // null se não logado
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth, type Session } from "@/lib/auth";

export const getSessionOrNull = cache(async (): Promise<Session | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session ?? null;
});

export async function requireSession(): Promise<Session> {
  const session = await getSessionOrNull();
  if (!session) redirect("/entrar");
  return session;
}
