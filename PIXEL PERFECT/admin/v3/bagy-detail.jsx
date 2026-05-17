// =========================================================
// DUBLIN V3 — Telas faltantes (Pedido Detalhe, Produto Detalhe,
// Recibo, Mobile expandido, Onboarding)
// =========================================================

// ───────── PEDIDO DETALHE ─────────
function B3PedidoDetalheScreen() {
  return (
    <B3Shell active="vendas" sub="pedidos">
      <div className="b3-page">
        <div className="b3-back-row">
          <button onClick={() => location.hash = "/vendas/pedidos"}><IcChevL size={15} /></button>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <h1 className="mono" style={{ color: "var(--brand)" }}>VTR-8042</h1>
              <span className="b3-pill b3-pill--warn">Aguardando</span>
              <span className="b3-pill" style={{ color: "var(--ok)" }}><IcWhatsApp size={11} /> WhatsApp</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>Recebido 17 mai · 14:08 · há 2 min</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="b3-btn"><IcPrint size={14} /> Imprimir</button>
            <button className="b3-btn"><IcWhatsApp size={14} /> WhatsApp</button>
            <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Confirmar pedido</button>
          </div>
        </div>

        <div className="b3-form-grid">
          <div>
            <div className="b3-card" style={{ overflow: "hidden", marginBottom: 16 }}>
              <div className="b3-card-hd"><h3>Itens · 3 produtos</h3></div>
              <table className="b3-tbl">
                <thead><tr><th style={{ paddingLeft: 20 }}>PRODUTO</th><th>SKU</th><th style={{ textAlign: "right" }}>QTD</th><th style={{ textAlign: "right" }}>PREÇO</th><th style={{ textAlign: "right", paddingRight: 20 }}>SUBTOTAL</th></tr></thead>
                <tbody>
                  {[
                    { n: "Vestido midi azul royal · M", s: "VST-AZ-M", q: 1, p: 18900 },
                    { n: "Blazer verde sálvia · G", s: "BL-VRD-G", q: 1, p: 24900 },
                    { n: "Brinco gota dourado · Único", s: "BRC-DR-U", q: 1, p: 4000 },
                  ].map((it, i) => (
                    <tr key={i}>
                      <td style={{ paddingLeft: 20, fontWeight: 600 }}>{it.n}</td>
                      <td className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>{it.s}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{it.q}</td>
                      <td className="mono" style={{ textAlign: "right" }}>R$ {(it.p/100).toFixed(2).replace(".", ",")}</td>
                      <td className="mono" style={{ textAlign: "right", fontWeight: 700, paddingRight: 20 }}>R$ {(it.q*it.p/100).toFixed(2).replace(".", ",")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan="4" style={{ textAlign: "right", color: "var(--ink-4)", padding: "12px 0" }}>Subtotal</td><td className="mono" style={{ textAlign: "right", paddingRight: 20 }}>R$ 478,00</td></tr>
                  <tr><td colSpan="4" style={{ textAlign: "right", fontSize: 15, fontWeight: 700, padding: "12px 0" }}>Total</td><td className="mono" style={{ textAlign: "right", fontSize: 18, fontWeight: 700, paddingRight: 20 }}>R$ 478,00</td></tr>
                </tfoot>
              </table>
            </div>
            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Linha do tempo</h3>
              {[
                { dot: "brand", t: "Pedido recebido", s: "Maria preencheu checkout", time: "14:08" },
                { dot: "ink-2", t: "WhatsApp aberto", s: "Mensagem enviada", time: "14:08" },
                { dot: "warn", t: "Aguardando confirmação", s: "22h pra confirmar", time: "agora" },
              ].map((it, i) => (
                <div key={i} style={{ display: "flex", gap: 14, padding: "8px 0" }}>
                  <div style={{ width: 14, marginTop: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 50, display: "block", background: it.dot === "brand" ? "var(--brand)" : it.dot === "warn" ? "var(--warn)" : "var(--ink-3)" }}></span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{it.t}</span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{it.time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>{it.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="b3-card b3-card-pad" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 10 }}>Cliente</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <span className="b3-avatar" style={{ width: 40, height: 40 }}>ME</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Maria Eduarda Silva</div>
                  <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-4)" }}>+55 99 99182-4001</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="b3-btn b3-btn--sm" style={{ flex: 1 }}><IcPhone size={12} /> Ligar</button>
                <button className="b3-btn b3-btn--sm" style={{ flex: 1 }}><IcWhatsApp size={12} /> Msg</button>
              </div>
            </div>
            <div className="b3-card b3-card-pad" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 10 }}>Pagamento</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}>
                <span style={{ color: "var(--ink-4)" }}>Método</span><span>Combinar no WhatsApp</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: "var(--ink-4)", fontSize: 12.5 }}>Total</span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 16 }}>R$ 478,00</span>
              </div>
            </div>
            <div className="b3-card b3-card-pad">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 10 }}>Notas internas</div>
              <textarea className="b3-input" style={{ height: 80, padding: 10, fontFamily: "var(--font)" }} placeholder="Anote algo (só você vê)…"></textarea>
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── PRODUTO DETALHE ─────────
function B3ProdutoDetalheScreen() {
  return (
    <B3Shell active="produtos" sub="lista">
      <div className="b3-page">
        <div className="b3-back-row">
          <button onClick={() => location.hash = "/produtos"}><IcChevL size={15} /></button>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <h1>Vestido midi azul royal</h1>
              <span className="b3-pill b3-pill--ok">Publicado</span>
              <span className="b3-pill b3-pill--brand">Promoção ativa</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>SKU · <span className="mono">VST-AZ</span> · criado 12 mar · 18 vendas · R$ 3.402 receita</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="b3-btn"><IcEye size={14} /> Ver na loja</button>
            <button className="b3-btn"><IcCopy size={14} /> Duplicar</button>
            <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Salvar</button>
          </div>
        </div>

        <div className="b3-form-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Imagens · 4 de 5</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ width: 96, height: 96, background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, position: "relative" }}>
                    VS{i}
                    {i === 1 && <span className="b3-pill b3-pill--brand" style={{ position: "absolute", top: 4, left: 4, fontSize: 9, padding: "0 5px", height: 16 }}>CAPA</span>}
                  </div>
                ))}
                <button style={{ width: 96, height: 96, background: "var(--bg-app)", border: "1.5px dashed var(--line-2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--ink-4)", cursor: "pointer" }}>
                  <IcPlus size={18} />
                  <span style={{ fontSize: 11, marginTop: 4 }}>Adicionar</span>
                </button>
              </div>
            </div>

            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Informações</h3>
              <div className="b3-field"><label className="b3-field-label">Nome</label><input className="b3-input" defaultValue="Vestido midi azul royal" /></div>
              <div className="b3-row2">
                <div className="b3-field"><label className="b3-field-label">Categoria</label><select className="b3-input b3-select"><option>Vestidos</option></select></div>
                <div className="b3-field"><label className="b3-field-label">SKU</label><input className="b3-input mono" defaultValue="VST-AZ" /></div>
              </div>
              <div className="b3-field"><label className="b3-field-label">Descrição</label>
                <textarea className="b3-input" style={{ height: 80, padding: 10, fontFamily: "var(--font)" }} defaultValue="Vestido midi em tecido leve com caimento fluido."></textarea>
              </div>
            </div>

            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Preço & Promoção</h3>
              <div className="b3-row2">
                <div className="b3-field"><label className="b3-field-label">Preço base</label><input className="b3-input mono" defaultValue="R$ 189,00" /></div>
                <div className="b3-field"><label className="b3-field-label">Preço promo</label><input className="b3-input mono" defaultValue="R$ 149,00" /></div>
              </div>
              <div style={{ padding: 12, background: "var(--bg-app)", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "var(--ink-4)" }}>Margem (com promo)</span><span className="mono" style={{ fontWeight: 700 }}>R$ 84,00 <span className="b3-pill b3-pill--ok">56,4%</span></span></div>
              </div>
            </div>

            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Variantes · 3</h3>
              <table className="b3-tbl">
                <thead><tr><th style={{ paddingLeft: 16 }}>TAM</th><th>SKU</th><th style={{ textAlign: "right" }}>ESTOQUE</th><th style={{ textAlign: "right" }}>PREÇO</th></tr></thead>
                <tbody>
                  {[
                    { s: "P", k: "VST-AZ-P", e: 0, p: "R$ 189,00" },
                    { s: "M", k: "VST-AZ-M", e: 4, p: "R$ 189,00" },
                    { s: "G", k: "VST-AZ-G", e: 2, p: "R$ 189,00" },
                  ].map((v, i) => (
                    <tr key={i}>
                      <td style={{ paddingLeft: 16, fontWeight: 700 }}>{v.s}</td>
                      <td className="mono">{v.k}</td>
                      <td className="mono" style={{ textAlign: "right" }}><span className={`b3-pill b3-pill--${v.e === 0 ? "danger" : v.e < 3 ? "warn" : "ok"}`} style={{ fontFamily: "var(--mono)" }}>{v.e}</span></td>
                      <td className="mono" style={{ textAlign: "right" }}>{v.p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="b3-card b3-card-pad">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 10 }}>Desempenho · 30 dias</div>
              <div style={{ display: "flex", gap: 16 }}>
                <div><div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>18</div><div style={{ fontSize: 11, color: "var(--ink-4)" }}>vendas</div></div>
                <div><div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>R$ 3.402</div><div style={{ fontSize: 11, color: "var(--ink-4)" }}>receita</div></div>
              </div>
            </div>
            <div className="b3-card b3-card-pad">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 10 }}>Resumo</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}><span style={{ color: "var(--ink-4)" }}>Visualizações 30d</span><span className="mono">412</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}><span style={{ color: "var(--ink-4)" }}>Conversão</span><span className="mono">4,4%</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}><span style={{ color: "var(--ink-4)" }}>Última venda</span><span>há 14 min</span></div>
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── MOBILE PEDIDOS ─────────
function B3MobPedidosScreen() {
  return (
    <B3MobileFrame title="Pedidos" sub="4 pendentes · 28 hoje" nav="vendas">
      <div style={{ display: "flex", gap: 6, overflow: "auto", marginBottom: 12 }}>
        <span className="b3-pill b3-pill--brand">Pendentes 4</span>
        <span className="b3-pill">Confirmados 12</span>
        <span className="b3-pill">Entregues 280</span>
      </div>
      {[
        { id: "VTR-8042", n: "Maria Eduarda S.", t: 47800, s: "warn", l: "Aguardando" },
        { id: "VTR-8041", n: "Júlio César", t: 12900, s: "warn", l: "Aguardando" },
        { id: "BLC-219", n: "Anônimo", t: 34800, s: "ok", l: "Entregue" },
      ].map(o => (
        <div key={o.id} style={{ padding: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 700 }}>{o.id}</span>
            <span className={`b3-pill b3-pill--${o.s}`}>{o.l}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="b3-avatar">{o.n.slice(0,2)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{o.n}</div>
            </div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>R$ {(o.t/100).toFixed(2).replace(".", ",")}</div>
          </div>
        </div>
      ))}
    </B3MobileFrame>
  );
}

// ───────── MOBILE CADASTRO PRODUTO ─────────
function B3MobCadastroProdutoScreen() {
  return (
    <B3MobileFrame title="Novo produto" sub="< 30s · publica direto" nav="catalogo">
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button style={{ width: 88, height: 88, background: "var(--ink-1)", color: "white", border: "none", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="4"/><path d="M3 7h3l1.5-2h9L18 7h3v12H3z"/></svg>
          <span style={{ fontSize: 10 }}>Câmera</span>
        </button>
        <div style={{ width: 68, height: 88, background: "var(--brand-wash)", color: "var(--brand)", border: "1px solid var(--brand-line)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, position: "relative" }}>
          VS
          <span style={{ position: "absolute", top: 4, left: 4, padding: "1px 5px", background: "var(--brand)", color: "white", fontSize: 8, fontWeight: 700, borderRadius: 3 }}>CAPA</span>
        </div>
        <button style={{ width: 68, height: 88, background: "var(--bg-app)", border: "1.5px dashed var(--line-2)", borderRadius: 12, color: "var(--ink-4)", cursor: "pointer" }}><IcPlus size={18} /></button>
      </div>
      <div className="b3-field"><label className="b3-field-label">Nome</label><input className="b3-input" defaultValue="Vestido midi azul royal" style={{ height: 48 }} /></div>
      <div className="b3-row2">
        <div className="b3-field"><label className="b3-field-label">Preço</label><input className="b3-input mono" defaultValue="R$ 189" style={{ height: 48 }} /></div>
        <div className="b3-field"><label className="b3-field-label">Estoque</label><input className="b3-input mono" defaultValue="6" style={{ height: 48 }} /></div>
      </div>
      <div className="b3-field"><label className="b3-field-label">Tamanhos</label>
        <div style={{ display: "flex", gap: 6 }}>
          {[{s:"PP"},{s:"P"},{s:"M",on:true},{s:"G",on:true},{s:"GG"}].map(t => (
            <button key={t.s} style={{ flex: 1, height: 44, background: t.on ? "var(--brand-wash)" : "white", border: `1.5px solid ${t.on ? "var(--brand)" : "var(--line-2)"}`, color: t.on ? "var(--brand)" : "var(--ink-1)", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>{t.s}</button>
          ))}
        </div>
      </div>
    </B3MobileFrame>
  );
}

// ───────── MOBILE CADASTRO CLIENTE ─────────
function B3MobCadastroClienteScreen() {
  return (
    <B3MobileFrame title="Novo cliente" sub="Dados básicos" nav="mais">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <div style={{ width: 88, height: 88, background: "var(--bg-app)", border: "1.5px dashed var(--line-2)", borderRadius: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--ink-4)" }}>
          <IcUser size={26} />
          <span style={{ fontSize: 10 }}>Foto</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>Anexar foto</span>
      </div>
      <div className="b3-field"><label className="b3-field-label">Nome completo</label><input className="b3-input" placeholder="Maria Eduarda Silva" style={{ height: 48 }} /></div>
      <div className="b3-field"><label className="b3-field-label">WhatsApp</label><input className="b3-input mono" placeholder="+55 99 99182-4001" style={{ height: 48 }} /></div>
      <div className="b3-row2">
        <div className="b3-field"><label className="b3-field-label">CPF</label><input className="b3-input mono" placeholder="000.000.000-00" style={{ height: 48 }} /></div>
        <div className="b3-field"><label className="b3-field-label">Aniversário</label><input className="b3-input mono" placeholder="DD/MM" style={{ height: 48 }} /></div>
      </div>
    </B3MobileFrame>
  );
}

// ───────── MOBILE CAIXA ─────────
function B3MobCaixaScreen() {
  return (
    <B3MobileFrame title="Caixa" sub="aberto às 08:02" nav="vendas">
      <div style={{ padding: 18, background: "var(--ink-1)", color: "white", borderRadius: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Total do dia</div>
        <div className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 4 }}>R$ 12.262</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>29 vendas · ticket médio R$ 422</div>
      </div>
      {[
        { l: "PIX", v: "R$ 4.842", c: "var(--brand)" },
        { l: "Dinheiro", v: "R$ 2.864", c: "var(--ok)" },
        { l: "Débito", v: "R$ 1.980", c: "var(--warn)" },
      ].map(m => (
        <div key={m.l} style={{ padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: m.c }}></span>
            <span style={{ fontWeight: 600 }}>{m.l}</span>
          </span>
          <span className="mono" style={{ fontWeight: 700 }}>{m.v}</span>
        </div>
      ))}
    </B3MobileFrame>
  );
}

// ───────── ONBOARDING / SIGNUP ─────────
function B3SignupScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
      <div style={{ background: "linear-gradient(135deg, var(--brand), #2A4FA8)", padding: 48, color: "white", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ width: 56, height: 56, background: "rgba(255,255,255,0.15)", borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 28, marginBottom: 32, alignSelf: "flex-start" }}>D</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.1, textTransform: "uppercase", opacity: 0.65, marginBottom: 16 }}>★ A SUA LOJA, DO JEITO QUE VOCÊ OPERA</div>
        <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>Gestão completa<br/>+ catálogo direto<br/>no WhatsApp.</h1>
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
          {["Catálogo público com checkout via WhatsApp", "PDV de balcão com controle de caixa", "Estoque com movimentação event-sourced", "Relatórios Excel · cupons · perfis de pagamento"].map(t => (
            <div key={t} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 22, height: 22, background: "rgba(255,255,255,0.1)", color: "#86EFAC", borderRadius: 50, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IcCheck size={11} /></span>
              <span style={{ fontSize: 13.5 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Crie sua loja em 30 segundos</h2>
        <p style={{ fontSize: 13, color: "var(--ink-4)", margin: "8px 0 28px" }}>14 dias de Pro grátis · sem cartão · cancela quando quiser</p>
        <div className="b3-field"><label className="b3-field-label">Seu nome</label><input className="b3-input" placeholder="Como devo te chamar?" /></div>
        <div className="b3-field"><label className="b3-field-label">E-mail</label><input className="b3-input mono" placeholder="seu@email.com" /></div>
        <div className="b3-field"><label className="b3-field-label">WhatsApp</label><input className="b3-input mono" placeholder="+55 99 99182-4001" /></div>
        <div className="b3-field"><label className="b3-field-label">Senha</label><input className="b3-input mono" type="password" placeholder="••••••••" /></div>
        <button className="b3-btn b3-btn--cta" style={{ height: 48, fontSize: 14 }}>Criar minha conta <IcChevR size={14} /></button>
        <div style={{ fontSize: 11.5, color: "var(--ink-4)", textAlign: "center", marginTop: 12 }}>Ao continuar você concorda com os <a style={{ color: "var(--brand)" }}>Termos</a></div>
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line)", textAlign: "center" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Já tem conta? <a style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }} onClick={() => location.hash = "/dashboard"}>Entrar</a></span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  B3PedidoDetalheScreen, B3ProdutoDetalheScreen,
  B3MobPedidosScreen, B3MobCadastroProdutoScreen, B3MobCadastroClienteScreen, B3MobCaixaScreen,
  B3SignupScreen,
});
