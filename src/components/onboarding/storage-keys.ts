// Chaves de sessionStorage compartilhadas entre as telas do onboarding.
// Isolado num módulo próprio porque page.tsx do Next 15 não pode
// re-exportar valores arbitrários (build falha em type-check).
export const SIGNUP_WHATSAPP_KEY = "vitre_signup_whatsapp";

// ONBOARDING_IDENTITY_KEY armazena o snapshot do passo 2 (identidade)
// enquanto a usuária escolhe o tipo de negócio no passo 3 (Onda 3 do
// port Dublin v3, ADR-0019). createStore só é chamado no fim do passo 3
// com identity + niche + opt-in mesclados.
export const ONBOARDING_IDENTITY_KEY = "vitre_onboarding_identity";
