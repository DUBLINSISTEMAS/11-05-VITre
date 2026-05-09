/**
 * Helpers de tratamento de erros de auth.
 * - `translateAuthError`: traduz código/mensagem do Better Auth para PT-BR.
 * - `extractAuthErrorCode`: extrai código de erro de uma exceção qualquer.
 */
const TRANSLATIONS: Record<string, string> = {
  // Better Auth error codes
  INVALID_EMAIL_OR_PASSWORD: "Email ou senha incorretos.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este email.",
  USER_NOT_FOUND: "Não encontramos uma conta com este email.",
  INVALID_TOKEN: "Link inválido ou expirado. Solicite um novo.",
  EMAIL_NOT_VERIFIED: "Confirme seu email antes de entrar.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  WEAK_PASSWORD: "Senha muito fraca. Use letras e números.",
  EMAIL_AND_PASSWORD_REQUIRED: "Preencha email e senha.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Não encontramos uma conta com este email.",
  RESET_PASSWORD_TOKEN_INVALID: "Link inválido ou expirado. Solicite um novo.",
  RESET_PASSWORD_TOKEN_EXPIRED: "O link expirou. Solicite um novo.",
  // Message-based fallbacks
  "Invalid email or password": "Email ou senha incorretos.",
  "User already exists": "Já existe uma conta com este email.",
  "User not found": "Não encontramos uma conta com este email.",
  "Invalid token": "Link inválido ou expirado.",
};

export function translateAuthError(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) {
    return "Algo deu errado. Tente novamente em instantes.";
  }
  return TRANSLATIONS[input] ?? "Não foi possível concluir. Tente novamente.";
}

/**
 * Extrai código de erro de uma exceção do Better Auth.
 * Better Auth lança `APIError` com `body.code` e `body.message`.
 */
export function extractAuthErrorCode(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const anyE = e as { body?: { code?: string; message?: string }; message?: string };
  return anyE.body?.code ?? anyE.body?.message ?? anyE.message;
}
