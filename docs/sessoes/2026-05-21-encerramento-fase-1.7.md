# Encerramento Fase 1.7 — Deploy Vercel

**Data**: 2026-05-21
**Decisão do founder**: descartar Sandra da jogada, terminar o sistema (Fase 2+) antes de expor a lojista real. Quando primeiro lojista entrar, entra via signup self-service da Fase 2, não via seed manual.

## Estado do deploy técnico

- `vercel link` + import GitHub ✅
- 13 envs configuradas em scope `production` ✅
- Deploy em produção ✅
- `DATABASE_URL` aponta pro pooler 6543 (transaction), `DIRECT_URL` pro 5432 ✅
- `.env.example` ↔ `.env.local` sincronizados (example é superset; `HEALTH_SECRET` e `NEXT_PUBLIC_SENTRY_ENVIRONMENT` opcionais, não bloqueiam) ✅
- 2 crons declarados em `vercel.json`: `keep-alive` (09h UTC), `expire-orders` (06h UTC) ✅

## Pendências carregadas pra revisitar antes do primeiro lojista real

Itens que NÃO bloqueiam Fase 2 mas precisam fechar antes do primeiro signup público:

1. **`vercel.json` sem `regions: ["gru1"]`** — se Anderson não setou a região no painel Vercel, prod tá em iad1 (Washington), latência ~150ms maior pra usuário BR. Conferir no painel; se vazio, adicionar `"regions": ["gru1"]` em `vercel.json`.
2. **HMAC sigs dos crons são placeholders** — `vercel.json` tem `?sig=REPLACE_WITH_HMAC_FROM_SIGN_CRON_URLS`. Rodar `scripts/sign-cron-urls.ts` e substituir antes do primeiro tráfego real, senão crons disparam mas endpoint rejeita 401.
3. **Smoke test real deferido**: storefront público / carrinho → WhatsApp / câmera mobile upload / PDV abrir-vender-fechar Z. Tudo isso depende de loja real com dado real — fica pra Fase 5.
4. **Lighthouse mobile ≥ 90** deferido pelo mesmo motivo.

## Por que descartar Sandra agora foi a chamada certa

- Sandra como primeira loja entraria via seed manual (script de Anderson). Isso vira dívida: o sistema teria um caso especial "Sandra entrou pelo seed" e qualquer próximo lojista precisaria do mesmo tratamento manual.
- Fase 2 entrega exatamente o que falta pra Sandra (ou qualquer outro) entrar sem seed: signup self-service + email verification + roteamento multi-tenant.
- Construir Fase 2 primeiro garante que **o primeiro cliente do produto também é o primeiro usuário do fluxo de cadastro**, sem caminho privilegiado.

## Tradeoff conhecido (registrado pra não esquecer)

Sem usuário real em prod até Fase 5, perdemos o loop de feedback de uso real durante Fase 2/3/4. Mitigação:
- Auditoria de fim-de-bloco com testes verdes + tsc limpo
- Smoke local rigoroso ao fim de cada bloco da Fase 2 (criar conta dev, validar isolamento, etc.)
- Logging Sentry já está ligado em prod — qualquer erro de build/runtime aparece mesmo sem usuário

## Próxima Sprint

**Fase 2 — Multi-tenant pleno** (5 blocos sequenciais):
1. Isolamento real: FORCE RLS + role `vitre_app`
2. Validação automatizada: suite `tests/isolation/`
3. Signup self-service: tela `/cadastro` + wizard
4. Hardening de auth: email verification + Resend domain + rate limit
5. Roteamento multi-tenant: subdomínio ou CNAME

Bloco 1 e 2 são bloqueantes — sem eles, não tem multi-tenant.
