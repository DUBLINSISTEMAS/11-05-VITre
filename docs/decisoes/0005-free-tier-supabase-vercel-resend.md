# ADR-0005: Estratégia de tier free (Supabase + Vercel + Resend)

- **Data**: 2026-05-07
- **Status**: aceito

## Contexto

Anderson decidiu rodar o MVP no Supabase **plano Free**. Isso é uma decisão financeira correta para validar com Sandra Brito, mas impõe limites operacionais que precisam ser respeitados pelo design do app — não descobertos em produção.

## Limites do Supabase Free relevantes

| Recurso | Limite | Como impacta o Vitrê |
|---|---|---|
| Database size | 500 MB | Ok pra ~100 lojas Sandra-tamanho |
| Storage size | **1 GB** | **Restrição crítica** — força compressão agressiva |
| Storage egress | 5 GB/mês | Mitigado servindo via Vercel Image Optimization |
| Auto-pause | **após 7 dias inativos** | **Restrição crítica** — quebra o catálogo |
| Auth users | 50.000 MAU | Suficiente para anos |
| Realtime conns | 200 simultâneas | Não usamos Realtime no MVP |
| File upload max | 50 MB | Já limitamos a 4 MB no app |
| Connection pooling | Sim (PgBouncer) | Obrigatório com Vercel serverless |

## Limites do Vercel Hobby

| Recurso | Limite | Como impacta |
|---|---|---|
| Bandwidth | 100 GB/mês | Folga grande |
| Function invocations | 100k/mês | Suficiente pro MVP |
| Cron jobs | 2 grátis | **Usamos 1 pro keep-alive Supabase** |
| Build time | 6.000 min/mês | Folga |
| **Uso comercial** | **Proibido nos ToS** | **Migrar pra Pro ($20/mês) antes da Fase 3 (cobrança)** |

## Limites do Resend Free

| Recurso | Limite | Como impacta |
|---|---|---|
| Emails/dia | 100 | Suficiente (recuperação senha + confirmação signup) |
| Emails/mês | 3.000 | Suficiente até ~1k lojistas ativos |
| Domínios | 1 | Configurar `vitre.app` ou subdomínio Vercel |

## Decisões operacionais derivadas

### 1. Compressão agressiva de imagens (substitui ADR-0003)

- **Original**: 1600×1600, 85% qualidade, max 30 imagens por produto.
- **Free tier**: 800×800, 75% qualidade, **max 5 imagens por produto**, formato WebP.
- Estimativa: ~150 KB por imagem. Sandra com 50 produtos × 5 imagens = ~37 MB. Cabem ~25 lojas Sandra-tamanho em 1 GB.

### 2. Vercel Image Optimization na frente do Supabase Storage

- `<Image src={supabaseStorageUrl} />` do `next/image` serve via Vercel CDN.
- Egress do Supabase só pago no primeiro acesso (até cache); revisitas saem do Vercel CDN.
- Reduz egress do Supabase ~10x.

### 3. Vercel Cron diário pingando o banco (keep-alive)

- `app/api/cron/keep-alive/route.ts` faz `SELECT 1 FROM store LIMIT 1`.
- `vercel.json`: `{ "crons": [{ "path": "/api/cron/keep-alive", "schedule": "0 9 * * *" }] }`.
- Roda 9h da manhã todo dia. Toca o banco e impede auto-pause.

### 4. Connection pooling obrigatório

- Drizzle conecta via `DATABASE_URL` apontando para o **pooler** do Supabase (porta 6543), não a porta direta (5432).
- Connection string termina com `?pgbouncer=true&connection_limit=1`.
- Migrations Drizzle usam `DIRECT_URL` (porta 5432) — não passa pelo pooler.

### 5. Triggers de migração (quando NÃO é mais sustentável free)

| Gatilho | Ação |
|---|---|
| Storage > 80% (800 MB) | Migrar Supabase para Pro ($25/mês) |
| DB size > 80% (400 MB) | Migrar Supabase para Pro |
| 5+ lojistas pagando ou cobrança ativa | Migrar Vercel Hobby → Pro ($20/mês) |
| > 2.500 emails/mês | Migrar Resend free → paid ($20/mês a 50k emails) |
| Auto-pause causou downtime visível | Imediato: migrar Supabase para Pro |

### 6. Monitoramento mínimo no MVP

- Dashboard Supabase: storage usage + DB size (verificar semanalmente).
- Vercel Analytics (incluído no Hobby): page views, performance.
- Email simples ao Anderson quando algum gatilho de migração atingir 70% (alerta cedo).

## Consequências

- ✅ Custo zero ou ~zero no MVP (só domínio se comprar `.site` ~R$ 25/ano).
- ✅ Restrições do free tier viraram constraints de design — nada a "consertar depois".
- ⚠️ Vercel Hobby ToS: tecnicamente não pode cobrar mensalidade da Sandra rodando lá. Como Sandra é piloto gratuito, Anderson não está cobrando. **Antes da Fase 3 (cobrança real), migrar Vercel para Pro.**
- ⚠️ Auto-pause é mitigável mas não eliminável — se Cron Vercel falhar 7 dias seguidos, banco pausa. Backup: alerta por email se Cron falhar.
- 🔧 Dívida: monitoramento manual semanal. Automatizar quando passar de 3 lojistas.

## Quem decidiu

Anderson Felipe (founder) — escolha de tier free explícita. Conselho-5-agentes calibrou as constraints derivadas.
