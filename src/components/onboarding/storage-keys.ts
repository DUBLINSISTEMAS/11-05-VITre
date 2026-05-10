// Chaves de sessionStorage compartilhadas entre as telas do onboarding.
// Isolado num módulo próprio porque page.tsx do Next 15 não pode
// re-exportar valores arbitrários (build falha em type-check).
export const SIGNUP_WHATSAPP_KEY = "vitre_signup_whatsapp";
