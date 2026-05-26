/**
 * Filtra mensagens de erro que podem vazar pro cliente.
 *
 * Princípio (S1.4 do PLANO-ENDURECIMENTO): nunca retornar `e.message` cru
 * pra UI. Postgres expõe nomes de constraints/colunas, FK violations e estado
 * de transação em texto que (a) confunde lojista, (b) vaza schema pra atacante.
 *
 * Mas alguns erros são intencionais no fluxo da aplicação (`throw new Error
 * ("Pagamento já estornado")`) e DEVEM aparecer pra UI — senão lojista clica
 * em "Estornar" duas vezes e não sabe por que falhou.
 *
 * Convenção: prefixos PT-BR conhecidos passam; todo o resto vira fallback.
 */

const SAFE_PREFIXES = [
  "Falha ao ", // throws defensivos do próprio app
  "Não foi possível ",
  "Valor inválido",
  "Quantidade inválida",
  "Pagamento ", // "Pagamento já estornado", "Pagamento não encontrado"
  "Fiado ",
  "Estoque ",
  "Caixa ",
  "Cliente ",
  "Produto ",
  "Venda ",
];

export function safeUserMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) {
    const msg = e.message.trim();
    if (SAFE_PREFIXES.some((p) => msg.startsWith(p))) {
      return msg;
    }
  }
  return fallback;
}
