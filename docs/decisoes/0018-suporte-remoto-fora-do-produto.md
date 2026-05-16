# ADR-0018: Suporte remoto fora do produto — playbook AnyDesk/RustDesk

- **Data**: 2026-05-16
- **Status**: aceito
- **Deriva de**: princípio "construir o mínimo, comprar o resto" do [ADR-0012](0012-pivot-vitre-gestao.md)
- **Convive com**: [ADR-0017](0017-empacotamento-pwa-tauri.md) (mesma lógica de "Tauri vetado até dor concreta")

## Contexto

Sandra Brito (e qualquer lojista 50+ que venha a usar Vitrê) vai precisar
de ajuda síncrona pelo menos no primeiro mês de uso. Cenários típicos:

- "Não consigo subir foto" → screenshare resolve em 2min, voz no telefone leva 20min
- "Sumiu o produto X" → preciso ver o ângulo dela (filtro ativo? produto em rascunho?)
- "Cliente diz que o link não abre" → testar o link no dispositivo dela
- "Como conecto a impressora?" → guiar setup local

Existe a tentação de construir isso DENTRO do Vitrê:

- WebRTC screenshare embutido ("Pedir ajuda" no header)
- Captura de tela automática anexada a tickets
- Sessões de "controle remoto" com OAuth de devolução
- Co-browse session passando estado entre instâncias

**Custo real disso, em ordem decrescente:** 100-300h de engenharia,
TURN/STUN servers pagos (TURN ≈ R$ 300/mês por banda), LGPD/consentimento
explícito antes de cada captura, áudio/eco, fallback quando NAT/firewall
bloqueia WebRTC, descoberta automática de versão entre Vitrê e cliente,
SDK de suporte a manter eternamente.

Ferramentas dedicadas (AnyDesk, RustDesk, TeamViewer) resolvem 100% disso
gratuitamente para uso pessoal/SMB, com áudio, gravação, transferência
de arquivos, atalhos, multi-plataforma, e sem manutenção da nossa parte.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Construir suporte remoto in-app (WebRTC screenshare + co-browse)** | "Marca" se sente premium; suporte dentro do contexto do bug | 100-300h de eng, TURN pago, LGPD complica, fallback NAT/firewall, manutenção eterna, não temos dor pra justificar |
| **B. AnyDesk/RustDesk como ferramenta externa + runbook formalizado** | R$ 0/mês, áudio nativo, multi-plataforma, sem código nosso pra manter, founder já usa pra outras coisas | "Pede pra instalar AnyDesk" é mais fricção que botão in-app; depende de cliente confiar e instalar |
| **C. Capturas + ticket assíncrono (Linear/Notion form)** | Sem instalação no cliente; preserva contexto | Não cobre dor síncrona ("não consigo agora"); ciclo de feedback longo demais pra SMB |

## Decisão

**Adotar B: AnyDesk como padrão, RustDesk como fallback (FOSS / quem
não quer baixar binário fechado). Documentar como runbook operacional,
não como feature do produto.**

Vitrê NÃO terá UI/SDK de suporte remoto. Se um dia houver dor concreta de
≥3 clientes pagantes pedindo "botão Ajuda dentro do app", reabrir esta
decisão — mas mesmo assim, o caminho mais provável é integrar um link
direto pro session do AnyDesk (não construir do zero).

## Runbook — quando Sandra (ou qualquer cliente) pedir ajuda

### Setup inicial (uma vez, no onboarding)

1. Enviar pra cliente o link: `https://anydesk.com/pt/downloads/windows`
   (ou Android via Play Store: "AnyDesk Remote Control").
2. Pedir pra abrir o app e ler o "Seu endereço" (9 dígitos, ex: `123 456 789`).
3. Guardar esse ID em [`docs/clientes/<nome>.md`](../clientes/) com permissão
   por escrito ("posso te ajudar via AnyDesk usando o ID X — confirma?").

### Suporte síncrono (cada vez)

1. **Cliente liga/manda áudio** descrevendo o problema.
2. Anderson abre AnyDesk no PC, digita o ID dela, conecta.
3. Cliente vê popup "Aceitar?" e clica **Aceitar** (sempre confirmação
   explícita do lado dela — política não-negociável).
4. Voz: usar o telefone (WhatsApp call) em paralelo. AnyDesk tem áudio
   nativo mas atrasa em conexões SMB.
5. Resolver o problema. **NÃO usar a sessão pra mexer em outras coisas
   além do que foi pedido** — princípio "scope of action ≤ scope of consent".
6. Antes de fechar: confirma com a cliente que pode encerrar. Não deixa
   a sessão "aberta pra usar depois".

### Itens em código que dependem disso (manter em mente)

- Tela de erro 500 / Sentry → mostrar `eventId` legível ("código RX9TZ4")
  para a cliente ler no telefone, em vez de o suporte precisar pedir
  screenshare só pra ver o erro. **Já existe** (instrumentation.ts);
  manter visível na UI.
- Logs estruturados (`logger.error` com `storeId`/`userId`/`requestId`)
  permitem reconstruir o problema sem screenshare em 70% dos casos.
- Telas críticas (PDV finalizar, criação de produto) devem mostrar erro
  com texto humano + `eventId` — sem isso o suporte cai em 100% screenshare.

## Consequências

- ✅ Zero código nosso pra suporte remoto. Zero custo de TURN. Zero LGPD
  específico do produto (a responsabilidade é da AnyDesk).
- ✅ Founder usa a mesma ferramenta que vai usar pra qualquer cliente
  futuro — escala linearmente.
- ⚠️ Fricção de instalação. Cliente que recusa instalar AnyDesk fica
  com canal degradado (telefone + screenshot via WhatsApp). Aceito —
  ferramenta paga (TeamViewer) não muda fricção; co-browse próprio
  custaria muito mais.
- ⚠️ Documentar a permissão por escrito é obrigatório por LGPD
  (controle remoto é tratamento de dados pessoais quando há tela de
  cliente). Modelo de consentimento vive em
  [`docs/clientes/sandra-brito-collection.md`](../clientes/sandra-brito-collection.md)
  como template.
- 🔧 Dívida zero. Esta ADR só fixa o que já estava implícito.

## Quem decidiu

Anderson Felipe (founder) — princípio "construir o mínimo, comprar o
resto". Formalizado em 2026-05-16 após Fase 5 estabilizar e o tema
voltar à tona ("e o suporte? construo do zero?"). Resposta: não.
