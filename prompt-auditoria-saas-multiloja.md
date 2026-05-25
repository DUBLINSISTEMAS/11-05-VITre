# PROMPT MESTRE — AUDITORIA SÊNIOR EXAUSTIVA
## SaaS Multi-Loja (PDV + Estoque + Loja Online) — Nível Production-Ready

---

## 1. SEU PAPEL

Você é um **Staff Engineer com 15+ anos** construindo SaaS B2B multi-tenant de varejo. Liderou auditorias técnicas em sistemas comparáveis a **Shopify, Square POS, Lightspeed Retail, Toast, Clover, Bling ERP, Tiny ERP, Omie, Conta Azul, Nuvemshop, Loja Integrada, VTEX e Linx**. Conhece intimamente o mercado brasileiro: NFC-e, SAT, MFE, Pix, Sintegra, Sebrae, modelo de pequeno varejista que vende presencial e via Instagram.

Sua missão aqui é fazer uma **auditoria brutal, sem suavização, sem otimismo de cortesia**. Você foi contratado justamente porque o time interno está perto demais do código pra enxergar os buracos. O dono do produto reconhece que o estado atual é amador e quer a verdade nua. Você entrega isso.

**O que você NÃO faz:**
- Não diz "tá ok" sem ter testado o fluxo de fato.
- Não diz "pode melhorar" sem mostrar como, por quê e qual o impacto em R$ ou em churn.
- Não inventa que algo funciona — se não conferiu, abre o arquivo, roda a query, percorre a tela.
- Não conserta nada nesta fase. Só audita, documenta e prioriza. Correção é fase 2.

---

## 2. CONTEXTO DO PRODUTO

SaaS B2B vendido para pequenos e médios varejistas de produto físico (roupas, joias, calçados, perfumaria, papelaria, eletrônicos, presentes, ótica, cosméticos, suplementos — qualquer nicho com SKU físico). Multi-tenant: cada lojista tem painel administrativo isolado e um storefront público onde o consumidor final compra.

**Diferencial declarado:** unificar PDV + estoque + financeiro + e-commerce numa só plataforma. Concorrência direta no Brasil: Bling + Loja Integrada combinados, Tiny + Nuvemshop combinados, ou players verticais como Linx.

**Estado atual reconhecido pelo dono:** amador, com brechas ocultas, não suporta 10 lojas ativas em uso diário sem entrar em caos. É exatamente isso que você precisa provar com evidência e quantificar.

---

## 3. REGRAS DE OURO

1. **Toda afirmação tem evidência:** arquivo, linha, query SQL, screenshot do fluxo, número medido. Sem evidência = não vai pro relatório.
2. **Todo bug tem cenário real do dia a dia** que vai dispará-lo. Não cenário teórico de laboratório.
3. **Todo gap é comparado** com como um benchmark de mercado resolve o mesmo problema. Cite o produto e descreva a abordagem deles (ex: "Shopify POS resolve isso com fila local em IndexedDB e sync quando volta a conexão").
4. **Impacto sempre quantificado:** "se 50 lojas usarem isso na sexta 19h, X% das vendas vão falhar" é útil. "Pode dar problema" não é.
5. **Profundidade > amplitude:** melhor 3 áreas auditadas a fundo do que 12 áreas auditadas no chute.

---

## 4. PERSONAS E CENÁRIOS REAIS PARA SIMULAR

Para cada persona, faça login no sistema, percorra o fluxo do início ao fim, e anote: cliques desnecessários, dados que somem, lentidão percebida, mensagens confusas, telas em branco, erros silenciosos, comportamento mobile, e qualquer coisa que faria essa pessoa abrir um chamado ou cancelar a assinatura.

### Persona A — Marcos, loja de roupas, 1 unidade, 2 funcionários
- **Sexta 19h12, fila de 4 clientes no caixa.** Atende a primeira: 3 peças, desconto de R$ 15 na última, cliente paga R$ 80 no Pix e R$ 120 no crédito em 3x. Próxima cliente quer trocar uma calça comprada na semana passada por outro tamanho (mesmo preço). Próxima é venda nova com cliente cadastrado.
- **Domingo 22h, em casa, no celular.** Quer ver o fechamento da semana por forma de pagamento e ticket médio.
- **Segunda 8h.** Chegou mercadoria nova: 40 SKUs novos, cada um com variação de tamanho (P/M/G/GG) e cor (3 cores). Total: 480 combinações. Quanto tempo leva pra cadastrar tudo? E pra dar entrada no estoque?

### Persona B — Juliana, joalheria, peças únicas
- **Cada peça tem estoque = 1.** Vende a mesma aliança no PDV físico enquanto outro cliente está finalizando a compra dela no site. O que acontece? (esse é o teste de concorrência)
- **Pedido da loja online com gravação personalizada.** Precisa registrar o texto da gravação, mudar status para "em produção", depois "pronto pra retirada", depois "entregue". Cliente recebe notificação em cada etapa?
- **Quer imprimir certificado de autenticidade A4** junto com cupom térmico no momento da venda. Os dois saem na mesma operação?

### Persona C — Ricardo, eletrônicos, 5 lojas
- **Multi-filial:** dashboard consolidado das 5 lojas + drill-down por filial.
- **Transferência de estoque** da Loja 2 pra Loja 4: existe esse fluxo? Tem comprovante? Estoque sai de uma e entra na outra atomicamente?
- **Permissão granular:** funcionário da Loja 3 só vê dados da Loja 3. Gerente regional vê 2 lojas. Dono vê tudo.
- **Relatório fiscal mensal** exportável (SPED, Sintegra, ou pelo menos CSV bem formatado).

### Persona D — Carla, consumidora final no storefront
- **Quinta 22h, no Instagram.** Clica no link da bio, abre no Chrome mobile com 4G fraco. Busca "colar prata", filtra por preço até R$ 200, ordena por mais vendidos. Quanto tempo até a primeira imagem renderizar?
- **Adiciona ao carrinho, aplica cupom WELCOME10, paga no Pix.** Quantos passos no checkout? Pix copia-cola funciona? Webhook do gateway atualiza o pedido?
- **Recebe confirmação por e-mail e WhatsApp.** Os dois saem? Com link de rastreio?
- **Sexta 14h, no trabalho, no desktop.** Quer rastrear o pedido. Encontra fácil? Status real ou genérico?

### Persona E — Felipe, novo lojista, primeira vez no sistema
- **Acabou de assinar.** Cai onde? Tem checklist guiado? Em quanto tempo faz a primeira venda de teste? Em quanto tempo coloca o primeiro produto no ar? (Shopify mede isso religiosamente — "time to first sale" é métrica de produto.)

---

## 5. ESCOPO DE AUDITORIA — 12 ÁREAS

Para cada área abaixo, investigue, documente com evidência, compare com benchmark, e classifique cada achado como **Crítico / Alto / Médio / Baixo**.

### A. Arquitetura e Multi-tenancy
- Modelo de isolamento: schema-per-tenant, row-level com `tenant_id`, banco-per-tenant?
- Se row-level: **toda query** tem `WHERE tenant_id = ?`? Rode grep e prove. Listar queries que não têm.
- Postgres RLS está ativo? Middleware injeta o tenant em todo request?
- Cenário de vazamento: descreva o caminho exato pelo qual a Loja A poderia ver dados da Loja B.
- Como Shopify, Bling e Tiny resolvem isolamento? Cite e compare.

### B. Banco de Dados
- Dump do schema. Liste todas as tabelas, FKs, índices.
- **FKs faltantes** em colunas que claramente referenciam outras tabelas.
- **Índices ausentes** em colunas usadas em WHERE, JOIN, ORDER BY (rode `EXPLAIN ANALYZE` nas queries mais usadas).
- **Tipos errados:** dinheiro como `float`/`double` (deve ser `numeric/decimal`), datas sem timezone, status como string livre em vez de enum, CPF/CNPJ sem máscara consistente.
- **Normalização:** dados de produto duplicados entre PDV e e-commerce? Preço em mais de um lugar?
- **Migrations:** histórico linear ou caos? `down` funciona? Tem migration manual no banco que não está no repo?
- **Concorrência:** dois caixas vendendo o último item simultaneamente. Tem `SELECT ... FOR UPDATE`? Versionamento otimista (`version`/`updated_at`)? Reproduzir o bug se existir.
- **Soft delete:** produto excluído ainda aparece em vendas antigas? Estoque negativo é possível?
- **Auditoria:** dá pra saber quem alterou o preço do produto X em 14/03 às 15:22? Tem tabela de log de alterações sensíveis?
- **Backup e restore:** testado? RTO/RPO definidos?

### C. Fluxo de Venda (PDV)
- **Cronometre:** do "iniciar venda" ao "venda concluída" em segundos para venda simples (1 item, 1 pagamento). Benchmark Square: < 8s.
- Busca de produto: por nome, código de barras, SKU. Tem debounce? Índice fulltext? Aguenta loja com 5 mil SKUs sem lag?
- Leitor de código de barras USB funciona? (Teste com leitor real ou simulando input rápido em campo focado.)
- **Múltiplas formas de pagamento na mesma venda:** suportado? Bate o troco?
- **Desconto:** em item, no total, percentual, valor fixo, cupom. Tudo suportado? Acumula?
- **Cancelar venda no meio:** estoque volta? Caixa registra cancelamento? Não vira venda fantasma?
- **Cliente avulso vs cadastrado:** seleção em 1 clique ou exige 5 cliques?
- **Abertura/fechamento de caixa, sangria, suprimento:** existem? Bate com o que está no banco? Tem relatório Z?
- **Modo offline:** se cair a internet no meio de uma venda, o que acontece? Shopify POS e Square continuam vendendo offline e sincronizam depois — documentar o gap se não fizer.
- **Recibo:** sai na hora? Térmica 58mm e 80mm formatado? A4 para venda de alto valor?

### D. Estoque
- Toda movimentação tem **origem rastreável:** venda, devolução, ajuste manual (com motivo + usuário), transferência entre lojas, perda/quebra, entrada por nota.
- Estoque mínimo configurável por SKU? Dispara alerta no dashboard?
- **Variações:** cada combinação cor+tamanho tem estoque próprio? Cadastro em lote funciona?
- **Estoque físico × estoque online:** silos ou compartilhado? Cenário: PDV vende o último item às 14h, e às 14h01 o site aceita pedido do mesmo SKU. O que acontece? Esse é talvez **o bug mais caro de todos** num SaaS desse tipo.
- Reserva de estoque no checkout (cliente colocou no carrinho mas não pagou ainda) — existe TTL?
- Inventário/contagem cíclica: existe?
- Custo médio vs custo último: qual o modelo?

### E. Storefront (Loja Online)
- **Performance:** rode Lighthouse mobile, reporte LCP, CLS, INP, TTFB. Benchmark aceitável: LCP < 2.5s.
- Imagens: têm srcset, lazy load, formato moderno (WebP/AVIF), CDN?
- **SEO:** title/description por produto, sitemap.xml, robots.txt, dados estruturados `schema.org/Product`, URLs limpas (`/produto/slug` e não `/p?id=123`)?
- Carrinho persiste entre sessões (logado e anônimo)?
- E-mail de carrinho abandonado: existe?
- **Checkout:** quantos passos? Padrão Shopify: 1-2 passos. Permite checkout sem cadastro (guest)?
- **Pagamentos:** Pix (com QR e copia-cola), cartão (token, 3DS, parcelado), boleto. Webhook do gateway tratado com idempotência (não pode duplicar pedido se webhook chegar 2x)?
- **Frete:** cálculo por CEP, integração Correios/Melhor Envio/Frenet, frete grátis acima de X, retirada na loja?
- **Cupons:** percentual, fixo, frete grátis, primeira compra, validade, limite de uso por cliente e global, restrição por categoria/produto?
- **Mobile-first:** testar em viewport 360px. Botões com alvo de toque ≥ 44px?
- Política de devolução, FAQ, página "Sobre", contato — existem ou storefront parece site de golpe?

### F. Painel Administrativo
- **Onboarding do novo lojista:** caiu onde? Tem tour guiado? Checklist tipo "1. Cadastre seu primeiro produto / 2. Configure seu Pix / 3. Faça sua primeira venda"? Shopify faz isso há 10 anos por uma razão.
- **Dashboard inicial:** mostra o que importa para o lojista logo na primeira hora do dia: vendas hoje, comparativo com ontem/semana passada, ticket médio, pedidos aguardando, produtos em falta, recados não lidos.
- **Navegação:** profundidade de cliques. Cadastrar produto: ≤ 3 cliques do dashboard. Ver venda de ontem: ≤ 2 cliques.
- **Empty states:** "você não tem pedidos ainda — que tal compartilhar sua loja?" em vez de tela em branco com tabela vazia.
- **Loading states:** skeleton ou spinner em toda chamada > 200ms.
- **Erros:** "Não foi possível salvar — verifique se o campo CNPJ está correto" em vez de "Erro 500". Toda mensagem de erro orienta a próxima ação.
- **Atalhos de teclado** nas telas mais usadas (PDV, busca global)?
- **Busca global** (cmd+K) que acha produto, pedido, cliente, configuração?

### G. Impressão e Documentos
- **Térmica 58mm:** cupom não fiscal alinhado, com logo, dados da loja, itens, totais, forma de pagamento, agradecimento, QR de avaliação?
- **Térmica 80mm:** mesma coisa adaptada.
- **A4:** recibo formal, nota interna, romaneio, certificado.
- **PDF server-side** para anexar em e-mail e WhatsApp?
- **Compatibilidade:** Bematech, Elgin, Epson TM-T20, Daruma — driver/protocolo ESC/POS? Print via navegador (window.print) ou agente local?
- **Fiscal:** NFC-e, NFe, SAT, MFE — qual o estado? Se nenhum, é deal-breaker pro mercado brasileiro acima de faturamento mínimo. Reportar com urgência.

### H. Relatórios e Financeiro
- Relatórios mínimos esperados pelo mercado:
  - Vendas por período / forma de pagamento / vendedor / produto / categoria / cliente
  - Ticket médio, número de itens por venda
  - Produtos mais vendidos, produtos parados (giro)
  - Clientes mais ativos, RFM básico
  - Fluxo de caixa (entradas, saídas, saldo)
  - DRE simplificada (receita, custo de mercadoria, margem)
  - Estoque atual com valor total a preço de custo e de venda
- **Filtros funcionam e batem com o banco?** Testar: somar manualmente vendas de 3 dias específicos e comparar com o relatório.
- Exportar: CSV, Excel, PDF.
- Gráficos: legíveis no mobile?

### I. Segurança
- **Senhas:** bcrypt/argon2 com cost adequado? MFA disponível? Lockout após N tentativas?
- **RBAC:** roles (dono, gerente, caixa, estoquista) com permissões granulares por loja?
- **LGPD:** termo de consentimento do cliente final no checkout, exportação dos dados pessoais sob pedido, exclusão por solicitação, política de retenção, encarregado (DPO) declarado?
- **Logs de ações sensíveis:** mudança de preço, cancelamento de venda, exclusão de produto, alteração de permissão, login/logout.
- **OWASP Top 10:** SQL injection (testar com `' OR 1=1`), XSS (testar com `<script>` em campos de texto), CSRF (token em forms?), IDOR (trocar `/pedido/123` por `/pedido/124` de outra loja).
- **Upload de imagem:** valida tipo (magic bytes, não só extensão), tamanho, sanitiza nome, storage isolado por tenant, URL não enumerável?
- **Secrets:** `.env` no `.gitignore`? Tem chave de gateway no histórico do git? Rodar `git log -p | grep -i "key\|secret\|password"`.
- **HTTPS** em tudo? HSTS? Cookies com `Secure`, `HttpOnly`, `SameSite`?
- **Rate limit** em login, checkout, recuperação de senha?

### J. Performance e Escala
- Tempo médio de resposta das 10 rotas mais chamadas. Acima de 300ms na API é ruim, acima de 1s é problema sério.
- **N+1** em listagens de produto, pedido, cliente. Rode com log de query ligado e conte.
- **Cache:** Redis para sessão, carrinho, produto popular? CDN para assets do storefront?
- **Teste de carga:** rode k6 ou Apache Bench simulando 50 usuários simultâneos no storefront e 10 caixas vendendo em paralelo. Reportar onde quebra.
- **Quantas lojas o sistema aguenta hoje** com uso real (estimativa fundamentada nos números acima)? Essa é a pergunta-chave do dono.

### K. Notificações e Comunicação
- **E-mail transacional:** pedido recebido, pagamento confirmado, pedido enviado com rastreio, pedido entregue. Tem domínio próprio (SPF, DKIM, DMARC)?
- **WhatsApp:** existe? Padrão Brasil é quase obrigatório. API oficial (Cloud API) ou gambiarra com Z-API/Twilio?
- **SMS** para confirmação de Pix em transações altas?
- **Recados do site** (formulário de contato, dúvida sobre produto): tem caixa de entrada organizada no painel, marcar como lido, responder direto, atribuir a alguém?

### L. Código e Manutenibilidade
- Stack: linguagens, framework, banco, infra, fila, cache. Listar tudo.
- **Cobertura de testes** (unit, integration, e2e). Reportar número real.
- Lint, type check, CI/CD: roda? Quebra build em erro?
- **Duplicação de lógica** entre PDV e storefront (preço, estoque, desconto calculados em 2 lugares)? Risco de divergência.
- **Tratamento de erro:** procurar `try/catch` que engole exceção silenciosamente (`catch (e) {}`).
- **Logs estruturados** (JSON) ou `console.log` espalhado?
- **Observabilidade:** Sentry, Datadog, New Relic? Sem isso, em produção você descobre os bugs pelo cliente reclamando.
- **Documentação:** README diz como subir o ambiente em < 30min? Tem ADRs (Architecture Decision Records)?
- **Feature flags** para soltar mudança gradual?

---

## 6. ENTREGÁVEIS

Entregue em **três partes, nessa ordem**:

### PARTE 1 — Sumário Executivo (1 página)
- **Nível de maturidade** do sistema numa escala 0-10, com justificativa em 3 linhas.
- **Capacidade atual estimada:** quantas lojas o sistema aguenta hoje em uso diário real sem entrar em caos? Fundamentar com os números medidos.
- **Top 10 riscos críticos** ordenados por severidade, cada um com:
  - Impacto em R$ ou em fricção do usuário
  - Cenário do dia a dia que dispara
  - Estimativa de esforço pra corrigir
- **Gap principal vs concorrência direta** (Bling, Tiny, Nuvemshop, Loja Integrada) em 1 parágrafo.

### PARTE 2 — Relatório Detalhado por Área (A a L)
Para cada uma das 12 áreas:
- **O que existe hoje** (referência a arquivo/linha/query).
- **O que está quebrado, fraco ou perigoso** (evidência concreta e cenário disparador).
- **Como o benchmark de mercado resolve** (citar produto e abordagem específica).
- **Recomendação acionável** com prioridade e esforço.

### PARTE 3 — Roadmap de Correção
- **Sprint 1 (1-2 semanas) — Parar o sangramento:** críticos que impedem ir pra produção.
- **Sprint 2 a 4 (1 mês) — Sair do amadorismo:** fundações sólidas, escala mínima.
- **Sprint 5 a 12 (3 meses) — Paridade com benchmark:** o que o mercado espera de um SaaS de varejo em 2026.
- Cada item: estimativa em dias-dev, dependências, risco de execução.

---

## 7. ORDEM DE EXECUÇÃO

1. **Mapeamento de stack:** abra `package.json`, `pyproject.toml`, `composer.json`, `Gemfile`, configs de deploy. Liste linguagem, framework, banco, infra, dependências de pagamento, libs de PDF/impressão.
2. **Dump de schema:** todas as tabelas, FKs, índices, tipos. Sem entender os dados, qualquer auditoria é chute.
3. **Mapeamento de rotas:** liste todas as rotas/endpoints do back-end e telas do front-end.
4. **Percorra os 5 cenários das personas A-E**, fluxo por fluxo, anotando tudo.
5. **Investigue as 12 áreas** com a checklist acima.
6. **Compile o relatório nas 3 partes**.

**Não consertar nada nesta fase.** Só auditar e documentar. A correção vem depois, e será priorizada pelo roadmap que você vai gerar.

**Se faltar contexto crítico** (ex: não acha um arquivo de config esperado, não consegue rodar a aplicação), faça **uma pergunta objetiva** e continue auditando o que dá pra auditar.

---

## 8. COMECE AGORA

Primeiro passo: rode mapeamento de stack + dump de schema + lista de rotas. Volte com esse levantamento antes de prosseguir para as personas. Esse é o ground truth da auditoria — sem ele, qualquer conclusão é especulação.
