# ADR-0006: Rate limit com Upstash Redis desde a fundação

- **Data**: 2026-05-07
- **Status**: aceito

## Contexto

Endpoints públicos do Vitrê expõem operações sensíveis: criação de pedido (anônima), upload de imagem (autenticada mas custosa), auth (login/signup/reset). Sem rate limit:

- Bot pode inundar `/api/orders` → estoura DB do Supabase Free → catálogo cai.
- Spam em `/api/auth/sign-up` → Resend bloqueia conta por padrão antiabuse.
- Upload em loop → estoura 1 GB de storage rapidamente.

Conselho-5-agentes (sessão 2026-05-07): **rate limit é Fase 0, não Fase 2**. Custo de adicionar depois > custo de adicionar agora.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Upstash Redis + `@upstash/ratelimit` | Free 10k cmd/dia, serverless-friendly, Vercel official partner | Mais um vendor |
| Postgres-based (count + delete) | Sem novo vendor | Custo de write em todo request, complica RLS |
| Vercel Edge KV | Mesmo vendor da hospedagem | KV grátis baixo (30 MB), latência maior |
| In-memory (lru-cache) | Zero infra | Inviável em serverless multi-region |

## Decisão

**Upstash Redis (free tier) + `@upstash/ratelimit`**.

### Configuração base

```ts
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const rateLimits = {
  // Cliente final criando pedido (anônimo, por IP)
  createOrder: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),  // 5 pedidos/min/IP
    prefix: "rl:order",
  }),
  // Login / signup
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 m"), // 10 tentativas/10min/IP
    prefix: "rl:auth",
  }),
  // Upload de imagem (autenticado, por user)
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 uploads/min/user
    prefix: "rl:upload",
  }),
  // API pública genérica
  publicApi: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"), // 60 req/min/IP
    prefix: "rl:api",
  }),
};

export const checkRateLimit = async (
  limiter: Ratelimit,
  identifier: string
) => {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  if (!success) {
    throw new RateLimitError(`Muitas tentativas. Tente novamente em alguns minutos.`, { reset });
  }
  return { limit, remaining, reset };
};
```

### Onde aplicar (Fase 1)

- `actions/order/create-from-cart.ts` → `rateLimits.createOrder` por IP
- `actions/auth/*` → `rateLimits.auth` por IP
- `actions/product/upload-image.ts` → `rateLimits.upload` por userId
- Todas as route handlers públicas → `rateLimits.publicApi` por IP

### Identificadores

- IP: `request.headers.get("x-forwarded-for")?.split(",")[0]` (Vercel injeta).
- userId: `session.user.id` (Better Auth).
- Para anônimos com persistência mais forte: hash do `customerPhone` no checkout — evita um IP usar 5 telefones diferentes pra fazer 25 pedidos/min.

## Consequências

- ✅ Proteção desde a Fase 0. Bot/spam = 401 ou erro amigável.
- ✅ Free tier Upstash (10k commands/dia) cobre folgadamente o MVP.
- ✅ Latência adicional: ~30-50ms por request — aceitável.
- ✅ UX: erro de rate limit retorna mensagem amigável em PT-BR ("Muitas tentativas. Aguarde 1 minuto.").
- ⚠️ Dependência adicional. Se Upstash cair, fail-open em endpoints não críticos (loga e segue), fail-closed em endpoints críticos (auth).
- ⚠️ Free tier Upstash limita 10k commands/dia. Cada request faz 1 comando (limiter.limit). MVP com Sandra: < 1k req/dia. Folga grande.
- 🔧 Dívida: monitorar console Upstash. Migrar para Pay-as-you-go quando passar de 8k commands/dia.

## Variáveis de ambiente

```bash
UPSTASH_REDIS_REST_URL=https://<region>-<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

## Quem decidiu

Anderson Felipe (founder) — pediu Upstash explicitamente. Conselho-5-agentes calibrou onde aplicar e os limites.
