# Runbooks

Procedimentos operacionais. Cada arquivo descreve **como** fazer algo em produção.

## Índice (a popular)

- `deploy-vercel.md` — como fazer deploy, rollback, environment variables.
- `onboarding-novo-tenant.md` — como criar uma loja nova manualmente (antes do self-service).
- `troubleshooting-rls.md` — como debugar vazamento ou bloqueio indevido entre tenants.
- `restore-supabase.md` — como restaurar backup do Supabase.
- `rotacao-secrets.md` — como rodar credenciais Better Auth / Resend / Supabase.

## Padrão de arquivo

Cada runbook deve ter:
1. **Quando usar** — gatilho do procedimento.
2. **Pré-requisitos** — credenciais, acessos.
3. **Passos** — numerados, idempotentes onde possível.
4. **Verificação** — como confirmar que deu certo.
5. **Rollback** — como reverter se der errado.
