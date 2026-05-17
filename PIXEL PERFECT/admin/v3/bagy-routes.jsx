// =========================================================
// DUBLIN V3 — Routes faltantes (PDV, Caixa, Estoque, Banners, etc.)
// =========================================================

// ───────── PDV ─────────
function B3PDVScreen() {
  return (
    <B3Shell active="vendas">
      <div className="b3-pdv">
        <div style={{ padding: 24, overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.025em" }}>PDV · Balcão</h1>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>Caixa #03 · aberto às 08:02</span>
          </div>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <IcSearch size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
            <input style={{ width: "100%", height: 56, padding: "0 56px 0 48px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 15, background: "var(--surface)" }} placeholder="Buscar produto · nome, SKU, código de barras…" autoFocus />
            <span className="mono" style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", padding: "2px 8px", background: "var(--bg-app)", borderRadius: 4, fontSize: 11, color: "var(--ink-4)" }}>F2</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <span className="b3-pill b3-pill--brand">★ Mais vendidos</span>
            <span className="b3-pill">Recentes</span>
            <span className="b3-pill">Vestidos</span>
            <span className="b3-pill">Acessórios</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {B3_PRODUTOS.slice(0, 8).map(p => (
              <button key={p.id} style={{ padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 80, background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{p.img}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.2 }}>{p.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>R$ {(p.price/100).toFixed(2).replace(".", ",")}</span>
                  <span className="b3-pill b3-pill--ok" style={{ fontFamily: "var(--mono)" }}>{p.stock}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 18, borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 8 }}>Cliente</div>
            <button style={{ width: "100%", padding: 12, background: "var(--bg-app)", border: "1px dashed var(--line-2)", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)", fontSize: 13 }}>
              <IcCustomers size={14} /> Adicionar cliente · opcional
            </button>
          </div>
          <div style={{ flex: 1, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--ink-4)" }}>
            <span style={{ width: 60, height: 60, borderRadius: 50, background: "var(--bg-app)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><IcCart size={26} /></span>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)" }}>Carrinho vazio</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Busque um produto pra começar</div>
          </div>
          <div style={{ padding: 18, background: "var(--bg-app)", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
              <span className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink-4)" }}>R$ 0,00</span>
            </div>
            <button className="b3-btn b3-btn--cta" disabled style={{ width: "100%", opacity: 0.5, cursor: "not-allowed", height: 44 }}>
              <IcCheckCir size={14} /> Adicione produtos pra finalizar
            </button>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── CAIXA ─────────
function B3CaixaScreen() {
  return (
    <B3Shell active="caixa">
      <div className="b3-page">
        <div className="b3-page-hd">
          <div>
            <h1>Caixa do dia</h1>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>sex 16 mai · 29 vendas balcão · aberto às 08:02</div>
          </div>
          <button className="b3-btn b3-btn--cta"><IcPrint size={14} /> Imprimir fechamento</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            { l: "PIX", v: "R$ 4.842", n: 12, c: "var(--brand)" },
            { l: "Dinheiro", v: "R$ 2.864", n: 8, c: "var(--ok)" },
            { l: "Débito", v: "R$ 1.980", n: 5, c: "var(--warn)" },
            { l: "Crédito", v: "R$ 1.248", n: 3, c: "#6B2A8C" },
            { l: "Outros", v: "R$ 328", n: 1, c: "var(--ink-4)" },
          ].map(m => (
            <div key={m.l} className="b3-card b3-card-pad">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: m.c, marginBottom: 6 }}>{m.l}</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>{m.v}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}>{m.n} venda(s)</div>
              <div style={{ height: 4, background: m.c + "26", borderRadius: 2, marginTop: 12, overflow: "hidden" }}>
                <div style={{ width: m.l === "PIX" ? "100%" : m.l === "Dinheiro" ? "60%" : "35%", height: "100%", background: m.c }} />
              </div>
            </div>
          ))}
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <div className="b3-card-hd"><h3>Vendas do dia · 29</h3></div>
          <table className="b3-tbl">
            <thead>
              <tr><th style={{ paddingLeft: 20 }}>HORA</th><th>RECIBO</th><th>CLIENTE</th><th>PAGAMENTO</th><th style={{ textAlign: "right" }}>TOTAL</th></tr>
            </thead>
            <tbody>
              {[
                { h: "13:42", c: "BLC-219", cli: "Anônimo", p: "PIX", t: 34800 },
                { h: "12:48", c: "BLC-218", cli: "Patrícia Mendes", p: "Crédito", t: 18900 },
                { h: "10:42", c: "BLC-217", cli: "Cliente avulso", p: "Dinheiro", t: 41200 },
                { h: "09:18", c: "BLC-216", cli: "Renata V.", p: "PIX", t: 8900 },
              ].map((s, i) => (
                <tr key={i}>
                  <td className="mono" style={{ paddingLeft: 20, color: "var(--ink-4)", fontSize: 12 }}>{s.h}</td>
                  <td className="mono" style={{ color: "var(--brand)", fontWeight: 600 }}>{s.c}</td>
                  <td>{s.cli}</td>
                  <td><span className="b3-pill">{s.p}</span></td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>R$ {(s.t/100).toFixed(2).replace(".", ",")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── ESTOQUE ─────────
function B3EstoqueScreen() {
  return (
    <B3Shell active="produtos" sub="estq">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Estoque</h1>
          <button className="b3-btn b3-btn--cta"><IcPlus size={14} /> Nova movimentação</button>
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <table className="b3-tbl">
            <thead>
              <tr><th style={{ paddingLeft: 20 }}>PRODUTO</th><th>SKU</th><th style={{ textAlign: "right" }}>SALDO</th><th style={{ textAlign: "right" }}>MÍN.</th><th>STATUS</th><th>ÚLTIMA MOV.</th></tr>
            </thead>
            <tbody>
              {[
                { name: "Vestido midi azul · P", sku: "VST-AZ-P", stock: 0, min: 5, tone: "danger", label: "Sem estoque", last: "venda · 1h" },
                { name: "Saia plissada bege · M", sku: "SAI-BR-M", stock: 0, min: 4, tone: "danger", label: "Sem estoque", last: "venda · 3h" },
                { name: "Vestido midi azul · M", sku: "VST-AZ-M", stock: 1, min: 5, tone: "warn", label: "Baixo", last: "venda · 2min" },
                { name: "Blazer verde sálvia · G", sku: "BL-VRD-G", stock: 2, min: 4, tone: "warn", label: "Baixo", last: "venda · 5h" },
                { name: "Brinco gota dourado", sku: "BRC-DR-U", stock: 12, min: 5, tone: "ok", label: "OK", last: "entrada · 8 mai" },
                { name: "Camisa oversized · M", sku: "CMS-BR-M", stock: 8, min: 4, tone: "ok", label: "OK", last: "venda · 14 mai" },
              ].map((s, i) => (
                <tr key={i}>
                  <td style={{ paddingLeft: 20, fontWeight: 600 }}>{s.name}</td>
                  <td className="mono" style={{ color: "var(--ink-4)" }}>{s.sku}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>
                    <span className={`b3-pill b3-pill--${s.tone}`} style={{ fontFamily: "var(--mono)" }}>{s.stock}</span>
                  </td>
                  <td className="mono" style={{ textAlign: "right", color: "var(--ink-4)" }}>{s.min}</td>
                  <td><span className={`b3-pill b3-pill--${s.tone}`}>{s.label}</span></td>
                  <td style={{ fontSize: 12, color: "var(--ink-4)" }}>{s.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── BANNERS ─────────
function B3BannersScreen() {
  return (
    <B3Shell active="produtos" sub="ban">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Banners</h1>
          <button className="b3-btn b3-btn--cta"><IcPlus size={14} /> Novo banner</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { title: "Mid-season · 30% OFF", sub: "Vestidos midi e blazers · até 31 mai", active: true, type: "PROMOÇÃO", c1: "#1A3A8F", c2: "#3F60C2", clicks: 1842 },
            { title: "Coleção Outono 26", sub: "Tons terrosos e linho", active: true, type: "COLEÇÃO", c1: "#92580C", c2: "#C77E1A", clicks: 1102 },
            { title: "Frete grátis acima de R$ 250", sub: "Pedidos via WhatsApp", active: true, type: "INFO", c1: "#0F6E3F", c2: "#2E8C5E", clicks: 754 },
          ].map((b, i) => (
            <div key={i} className="b3-card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ color: "var(--ink-5)", cursor: "grab" }}><IcDots size={14} /></span>
              <div style={{ width: 200, height: 80, background: `linear-gradient(135deg, ${b.c1}, ${b.c2})`, borderRadius: 8, padding: 12, color: "white", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.06, opacity: 0.85 }}>{b.type}</div>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2 }}>{b.title.split(" · ")[0]}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{b.title}</span>
                  <span className="b3-pill b3-pill--ok">● Ativo</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 4 }}>{b.sub}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 4 }}>{b.clicks} cliques · 12 conversões</div>
              </div>
              <button className="b3-btn b3-btn--sm"><IcEdit size={13} /></button>
              <button className="b3-btn b3-btn--sm"><IcDotsV size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── CUPONS ─────────
function B3CuponsScreen() {
  return (
    <B3Shell active="promo">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Cupons & descontos</h1>
          <button className="b3-btn b3-btn--cta"><IcPlus size={14} /> Novo cupom</button>
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <table className="b3-tbl">
            <thead>
              <tr><th style={{ paddingLeft: 20 }}>CÓDIGO</th><th>NOME</th><th>DESCONTO</th><th>USOS</th><th>VALIDADE</th><th>STATUS</th></tr>
            </thead>
            <tbody>
              {[
                { c: "MIDSEASON30", n: "Mid-season 30%", t: "30% OFF", u: "62/200", v: "31/05/2026", s: "ok", l: "Ativo" },
                { c: "PRIMEIRA15", n: "Primeira compra", t: "15% OFF", u: "24/∞", v: "Sem fim", s: "ok", l: "Ativo" },
                { c: "FRETE10", n: "Frete grátis 250+", t: "Frete 0", u: "48/∞", v: "Sem fim", s: "ok", l: "Ativo" },
                { c: "MAES2026", n: "Dia das mães", t: "R$ 30 OFF", u: "112/150", v: "12/05/2026", s: "warn", l: "Esgotado" },
                { c: "BLACKFRI", n: "Black Friday", t: "40% OFF", u: "0/500", v: "28-30/11", s: "default", l: "Agendado" },
              ].map(c => (
                <tr key={c.c}>
                  <td className="mono" style={{ paddingLeft: 20, fontWeight: 700, color: "var(--brand)" }}>{c.c}</td>
                  <td>{c.n}</td>
                  <td><span className="b3-pill b3-pill--brand">{c.t}</span></td>
                  <td className="mono">{c.u}</td>
                  <td className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>{c.v}</td>
                  <td><span className={`b3-pill b3-pill--${c.s}`}>{c.l}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── ASSINATURA ─────────
function B3AssinaturaScreen() {
  return (
    <B3Shell active="assinatura">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Assinatura</h1>
          <button className="b3-btn"><IcArchive size={14} /> Histórico</button>
        </div>
        <div className="b3-form-grid">
          <div className="b3-card" style={{ padding: 28, background: "linear-gradient(135deg, var(--brand), #2A4FA8)", color: "white", border: "none" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.1, textTransform: "uppercase", opacity: 0.7 }}>PLANO ATUAL · TRIAL</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", margin: "6px 0 14px" }}>Dublin Pro</h2>
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 18 }}>Catálogo ilimitado · PDV · Clientes · Estoque · Relatórios · Mobile · Suporte direto.</div>
            <div className="mono" style={{ fontSize: 17 }}><b style={{ fontSize: 24 }}>R$ 89</b> / mês</div>
            <div style={{ marginTop: 18 }}>
              <button style={{ height: 44, padding: "0 22px", background: "white", color: "var(--brand)", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                <IcSparkle size={14} style={{ marginRight: 6 }} /> Assinar agora
              </button>
            </div>
          </div>
          <div className="b3-card b3-card-pad">
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Forma de pagamento</h3>
            <div style={{ padding: 16, background: "var(--bg-app)", border: "1px dashed var(--line-2)", borderRadius: 10, textAlign: "center" }}>
              <IcPayment size={22} style={{ color: "var(--ink-4)", marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Nenhum cartão cadastrado</div>
              <button className="b3-btn b3-btn--cta b3-btn--sm" style={{ marginTop: 12 }}><IcPlus size={13} /> Adicionar cartão</button>
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── NOTIFICAÇÕES ─────────
function B3NotificacoesScreen() {
  return (
    <B3Shell active="dashboard">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Notificações</h1>
          <button className="b3-btn"><IcCheck size={14} /> Marcar todas como lidas</button>
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          {[
            { ico: "IcWhatsApp", tone: "brand", t: "Pedido WhatsApp · VTR-8042", b: "Maria Eduarda quer 3 itens · R$ 478,00", time: "há 2 min", unread: true },
            { ico: "IcMoney", tone: "ok", t: "Venda balcão · BLC-219", b: "Patrícia Mendes · R$ 348,00 via PIX", time: "há 26 min", unread: true },
            { ico: "IcStock", tone: "warn", t: "Estoque crítico", b: "Saia plissada bege · M zerou", time: "há 1 h" },
            { ico: "IcXCir", tone: "danger", t: "Pedido expirado · VTR-8039", b: "Anônimo · 1h sem confirmação", time: "há 3 h" },
            { ico: "IcSparkle", tone: "brand", t: "Promoção a expirar", b: "Mid-season termina em 2 dias", time: "há 12 h" },
            { ico: "IcCustomers", tone: "ok", t: "3 clientes novos hoje", b: "Júlio, Larissa e Anônimo", time: "há 18 h" },
          ].map((n, i) => {
            const Ic = window[n.ico];
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--line)", background: n.unread ? "var(--brand-wash)" : "transparent", cursor: "pointer" }}>
                <span style={{ width: 36, height: 36, background: `var(--${n.tone === "brand" ? "brand-wash" : n.tone + "-wash"})`, color: `var(--${n.tone === "brand" ? "brand" : n.tone})`, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic size={16} /></span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{n.t}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{n.b}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{n.time}</span>
                  {n.unread && <span style={{ width: 8, height: 8, background: "var(--brand)", borderRadius: 50 }}></span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── SUPORTE ─────────
function B3SuporteScreen() {
  return (
    <B3Shell active="suporte">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Suporte</h1>
        </div>
        <div className="b3-card" style={{ padding: 28, background: "linear-gradient(135deg, var(--brand), #2A4FA8)", color: "white", border: "none", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <span style={{ width: 56, height: 56, background: "rgba(255,255,255,0.1)", borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IcSparkle size={24} style={{ color: "#FBBF24" }} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.1, textTransform: "uppercase", opacity: 0.7 }}>TUTORIAL GUIADO</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "6px 0 12px" }}>Conheça o Dublin em 2 minutos</h2>
              <button style={{ height: 40, padding: "0 18px", background: "white", color: "var(--brand)", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <IcSparkle size={13} style={{ marginRight: 6 }} /> Iniciar tour
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          {[
            { ico: "IcCustomers", t: "WhatsApp suporte", s: "Seg–Sex 9h–18h", color: "var(--ok)" },
            { ico: "IcInfo", t: "suporte@dublin.app", s: "Resposta em 24h", color: "var(--brand)" },
            { ico: "IcBolt", t: "Problema crítico", s: "Resposta em 1h", color: "var(--danger)" },
          ].map((c, i) => {
            const Ic = window[c.ico];
            return (
              <div key={i} className="b3-card b3-card-pad" style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <span style={{ width: 44, height: 44, background: c.color, color: "white", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic size={18} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{c.t}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{c.s}</div>
                </div>
                <button className="b3-btn b3-btn--sm">Abrir</button>
              </div>
            );
          })}
        </div>
      </div>
    </B3Shell>
  );
}

Object.assign(window, {
  B3PDVScreen, B3CaixaScreen, B3EstoqueScreen, B3BannersScreen,
  B3CuponsScreen, B3AssinaturaScreen, B3NotificacoesScreen, B3SuporteScreen,
});
