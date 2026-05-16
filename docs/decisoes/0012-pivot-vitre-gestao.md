\# ADR-0012: Pivô do Vitrê para sistema de gestão da loja



\- \*\*Data\*\*: 2026-05-15

\- \*\*Status\*\*: aceito

\- \*\*Substitui\*\*: parcialmente `docs/produto/visao.md` (tese central)

\- \*\*Convive com\*\*: ADR-0008 (storefront sem login continua) — ver seção "Não conflita com ADR-0008" abaixo



\## Contexto



Anderson apresentou o Vitrê a dois prospects em maio/2026. Dois apontamentos relevantes vieram dessas conversas:



1\. \*\*Cliente A (catálogo)\*\*: hoje o PDP do storefront mostra automaticamente "ou 3× de R$ X,XX sem juros" usando o preço promocional, sem que a lojista tenha configurado nada. O código está em `src/lib/pricing.ts:80` (`formatInstallments` com `installments = 3` hardcoded) e renderizado em `src/components/storefront/product-purchase-panel.tsx:146`. Não existe coluna alguma de configuração de pagamento em `storeTable` ou `productTable`. É bug genuíno de feature que nunca foi modelada.



2\. \*\*Cliente B (escopo)\*\*: apontou que o Vitrê hoje resolve para o cliente final (catálogo) mas resolve pouco para a lojista no dia-a-dia. Não há venda balcão, não há cadastro de cliente do lojista, não há gestão de movimentações de estoque, não há relatório de fechamento. O sistema é uma vitrine, não uma operação.



A leitura do founder é que o escopo original ("catálogo digital + checkout WhatsApp", `docs/produto/visao.md`) é insuficiente para a proposta de valor que ele quer entregar e cobrar. O Vitrê deve se tornar \*\*um sistema de gestão da loja\*\*, com o catálogo digital sendo um dos canais de venda, não o produto inteiro.



\## Decisão



O Vitrê deixa de se posicionar como "SaaS de catálogo digital com checkout WhatsApp" e passa a se posicionar como \*\*"sistema de gestão para lojas de pequeno e médio porte: catálogo digital, venda balcão, clientes, estoque e relatórios, com WhatsApp como um dos canais de checkout"\*\*.



A mudança de tese implica adicionar seis módulos novos, mantendo intactos os três módulos atuais:



| Módulo | Status hoje | Status alvo |

|---|---|---|

| Storefront público | ✅ existe | mantido sem alteração estrutural |

| Painel admin (CRUD básico) | ✅ existe | mantido, ampliado com novas seções |

| Checkout WhatsApp | ✅ existe | mantido sem alteração estrutural |

| Pagamento configurável por loja | ❌ ausente | \*\*novo\*\* (ADR-0013) |

| Cadastro de clientes | ❌ ausente | \*\*novo\*\* (ADR-0014) |

| Estoque event-sourced (movimentações) | ❌ ausente (só campo agregado) | \*\*novo\*\* (ADR-0015) |

| Balcão / PDV | ❌ ausente | \*\*novo\*\* (ADR-0016) |

| Relatórios | ❌ ausente | \*\*novo\*\* (parte de ADR-0015 e ADR-0016) |

| Empacotamento desktop (PWA → Tauri) | ❌ ausente | \*\*novo\*\* (ADR-0017) |



Cada módulo novo terá ADR próprio detalhando schema, fluxo, RLS e impacto. Este ADR é o guarda-chuva.



\## Não conflita com ADR-0008



ADR-0008 ("UX do catálogo público / storefront") rejeitou explicitamente cadastro/login/perfil/favoritos/histórico/foto/endereço de \*\*cliente final\*\* no storefront público. Essa decisão \*\*continua vigente e não está sendo revisitada\*\* por este ADR.



A distinção crítica:



\- \*\*Consumidor anônimo do storefront\*\* = pessoa que entra em `loja.vitre.app/sandra-brito` para comprar. Sem login, carrinho em localStorage, sem perfil. Decisão protegida por ADR-0008.

\- \*\*Cliente cadastrado pelo admin\*\* = registro que a lojista cria no painel para registrar quem comprou no balcão ou para ter base de relacionamento. É entidade interna do tenant, não consumida pelo storefront.



São duas coisas diferentes. A tabela `customer` que será introduzida no ADR-0014 \*\*não tem login, não é exposta no storefront, não tem foto, não tem favoritos\*\*. É um registro CRUD do admin, da mesma natureza de `product` ou `category`.



\## Não-objetivos do pivô



Para evitar ambiguidade futura, estas coisas \*\*não\*\* entram no escopo de Vitrê Gestão:



\- \*\*Gateway de pagamento próprio\*\*: checkout do storefront continua via WhatsApp. PDV registra forma de pagamento como metadado, não processa transação.

\- \*\*NF-e / emissão fiscal\*\*: integração com SEFAZ/Receita Federal exige certificado digital, homologação por UF e suporte fiscal contínuo. Fora do escopo deste pivô. Pode entrar em fase futura (>4) se houver tração.

\- \*\*Acesso remoto integrado ao sistema\*\*: o cliente mencionado por Anderson usa AnyDesk ou similar separado do produto. Vitrê não vai construir captura de tela / controle remoto. O suporte remoto vive em runbook operacional (instalar AnyDesk no cliente), não em código.

\- \*\*Sync offline-first robusto (multi-device com CRDT)\*\*: Fase 6 cobre PWA com cache de leitura ("não morre se a internet cair por 30 segundos"). Sync bidirecional real de operações offline-then-replay fica para fase futura, \*\*só se\*\* houver dor concreta de cliente pagante.

\- \*\*App nativo iOS/Android\*\*: storefront e admin permanecem responsivos no mobile via web. PWA cobre instalação. Capacitor/React Native está fora do escopo.



\## Consequências



\### Positivas

\- Proposta de valor maior, justificando ticket-alvo de R$ 50-150/mês em vez de R$ 30-100.

\- Resolve dor real apontada por prospects (venda balcão, estoque consistente).

\- Pagamento configurável fecha bug atual real (Cliente A).

\- Padrão de operação (admin → catálogo + admin → balcão) reusa schema existente — `orderTable` ganha `channel` em vez de tabela nova.



\### Negativas / riscos aceitos

\- Aumenta significativamente o escopo de desenvolvimento (estimativa: 500-800h adicionais). Decisão consciente do founder: priorizar completude do produto sobre time-to-market.

\- Amplia a superfície de competidores: Vitrê passa a sobrepor parcialmente com Bling, Tiny ERP e Conta Azul. Diferenciação fica em: simplicidade, mobile-first, checkout WhatsApp nativo, foco em micro/pequeno varejo.

\- Custo operacional sai de R$ 0/mês quando Fase 6 (PWA installable) for ao ar — Vercel Pro pode ser necessário se houver cobrança dos lojistas (ToS), Supabase Pro se DB > 400 MB.

\- N=1 cliente piloto (Sandra) ainda não pagante. Pivô é feito antes de validação financeira. Risco de construir features que nenhum cliente paga.



\### Mitigações

\- Cada fase entrega valor isolado (pagamento configurável funciona sem cliente cadastrado; cliente cadastrado funciona sem PDV; etc).

\- Sandra recebe o que existe hoje (Fase 1.7 deploy) em paralelo às novas fases. Feedback real começa imediatamente.

\- ADRs por fase permitem ajustar rumo sem refazer.



\## Roadmap de ADRs derivados



| ADR | Tema |

|---|---|

| 0013 | Pagamento configurável por loja (schema + UI + refactor de pricing) |

| 0014 | Cadastro de clientes no admin (sem login, vs ADR-0008) |

| 0015 | Estoque event-sourced (tabela `stock\_movement` + trigger SQL) |

| 0016 | PDV/Balcão (canal de pedido + UI de teclado) |

| 0017 | Empacotamento desktop (PWA primeiro, Tauri depois) |

| 0018 | Playbook de suporte remoto (AnyDesk, fora do produto) |



\## Atualização obrigatória do `CLAUDE.md`



Este ADR é vinculante a uma atualização do `CLAUDE.md` na raiz do repo. Ver bloco "Atualização do CLAUDE.md" no commit que introduz este ADR.

