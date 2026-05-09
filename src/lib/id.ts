/**
 * Gera um id temporário client-side.
 *
 * `crypto.randomUUID()` exige secure context — funciona em HTTPS e em
 * `localhost`, mas falha quando o admin é acessado por IP da rede local
 * (ex: `http://192.168.x.x:3000` no celular pra testar). O fallback evita
 * o crash silencioso do componente nesse cenário.
 */
export function tempId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
