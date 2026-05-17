// =========================================================
// DUBLIN V3 — Sprint B: Mobile navegável (fluxo real)
// =========================================================

const B3_MOB_ROUTES = {
  painel: "B3MobDashboardScreen",
  vendas: "B3MobPedidosScreen",
  pdv: "B3MobPDVScreen",
  catalogo: "B3MobProdutosScreen",
  produto: "B3MobCadastroProdutoScreen",
  cliente: "B3MobCadastroClienteScreen",
  caixa: "B3MobCaixaScreen",
};

function B3MobileApp() {
  const [route, setRoute] = React.useState("painel");
  const [menuOpen, setMenuOpen] = React.useState(false);
  window.__mobNav = (k) => setRoute(k);

  // Wire all "<" back buttons and FAB taps via event delegation
  React.useEffect(() => {
    function onClick(e) {
      const btn = e.target.closest("button");
      if (!btn) return;
      // FAB → PDV
      if (btn.querySelector && btn.querySelector("svg")) {
        const txt = btn.textContent.trim().toLowerCase();
        if (txt === "" && btn.style.background?.includes("DCE3F5")) {
          setRoute("pdv");
        }
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Render right screen with active nav indicator
  const ScreenName = B3_MOB_ROUTES[route];
  const Screen = window[ScreenName];

  return (
    <div style={{ background: "#ECE9E2", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, position: "relative" }}>
      {/* Drawer com sidebar completa quando menu aberto */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,20,25,0.5)", zIndex: 50, display: "flex" }} onClick={() => setMenuOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 280, background: "var(--surface)", height: "100vh", overflow: "auto", animation: "b3slidein 280ms cubic-bezier(0.22,1,0.36,1)" }}>
            <div style={{ padding: 20, borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
              <span className="b3-logo-mark">D</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>dublin</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>Sandra Brito</div>
              </div>
              <button style={{ marginLeft: "auto", width: 30, height: 30, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer" }} onClick={() => setMenuOpen(false)}><IcClose size={13} /></button>
            </div>
            {[
              { k: "painel", ico: "IcDashboard", l: "Painel" },
              { k: "vendas", ico: "IcOrders", l: "Pedidos" },
              { k: "pdv", ico: "IcPdv", l: "PDV · Lançar venda" },
              { k: "caixa", ico: "IcMoney", l: "Caixa do dia" },
              { k: "catalogo", ico: "IcCatalog", l: "Catálogo" },
              { k: "produto", ico: "IcPlus", l: "Cadastrar produto" },
              { k: "cliente", ico: "IcCustomers", l: "Cadastrar cliente" },
            ].map(it => {
              const Ic = window[it.ico];
              return (
                <div key={it.k} className="b3-side-item" data-active={route === it.k} onClick={() => { setRoute(it.k); setMenuOpen(false); }}>
                  <Ic size={17} /><span>{it.l}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <MobScreenWithNav route={route} setRoute={setRoute} setMenuOpen={setMenuOpen} />
      </div>
    </div>
  );
}

function MobScreenWithNav({ route, setRoute, setMenuOpen }) {
  // Render the mobile screen by name BUT override the bottom nav to use setRoute
  return (
    <div style={{ width: 390, height: 844, background: "var(--bg-app)", borderRadius: 38, overflow: "hidden", position: "relative", border: "1px solid var(--line-2)", boxShadow: "0 30px 80px -30px rgba(15,20,25,0.25)", fontFamily: "var(--font)" }}>
      <div style={{ height: 44, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700 }}>
        <span>9:41</span>
        <span style={{ width: 90, height: 26, background: "var(--ink-1)", borderRadius: 999 }}></span>
        <span style={{ fontSize: 11 }}>100%</span>
      </div>

      <MobHeader route={route} setMenuOpen={setMenuOpen} setRoute={setRoute} />

      <div style={{ height: "calc(100% - 44px - 62px - 80px)", overflow: "auto", padding: "12px 16px" }}>
        <MobScreenBody route={route} setRoute={setRoute} />
      </div>

      <div style={{ position: "absolute", left: 12, right: 12, bottom: 16, height: 64, background: "#0F1419", borderRadius: 22, display: "grid", gridTemplateColumns: "1fr 1fr 80px 1fr 1fr", padding: 4, alignItems: "center", boxShadow: "0 12px 30px -8px rgba(15,20,25,0.4)" }}>
        {[
          { k: "painel", ico: "IcDashboard", l: "Painel" },
          { k: "vendas", ico: "IcOrders", l: "Vendas" },
          { k: "pdv", ico: "IcPdv", l: "PDV", primary: true },
          { k: "catalogo", ico: "IcCatalog", l: "Catálogo" },
          { k: "mais", ico: "IcDots", l: "Mais" },
        ].map(it => {
          const Ic = window[it.ico];
          if (it.primary) return (
            <button key={it.k} onClick={() => setRoute("pdv")} style={{ width: 60, height: 60, margin: "0 auto", border: "4px solid var(--ink-1)", background: "linear-gradient(135deg, white, #DCE3F5)", color: "var(--ink-1)", borderRadius: 50, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic size={22} /></button>
          );
          return (
            <button key={it.k} onClick={() => { if (it.k === "mais") setMenuOpen(true); else setRoute(it.k); }} style={{ background: "transparent", border: "none", color: route === it.k ? "white" : "rgba(255,255,255,0.55)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 0", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
              <Ic size={17} /><span>{it.l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobHeader({ route, setMenuOpen, setRoute }) {
  const titles = {
    painel: { t: "Painel", s: "sex 17 mai · 14:08" },
    vendas: { t: "Pedidos", s: "4 pendentes · 28 hoje" },
    pdv: { t: "PDV", s: "Caixa #03 · aberto" },
    catalogo: { t: "Catálogo", s: "142 produtos" },
    produto: { t: "Novo produto", s: "< 30s · publica direto", back: true },
    cliente: { t: "Novo cliente", s: "Dados básicos", back: true },
    caixa: { t: "Caixa", s: "aberto às 08:02", back: true },
  };
  const h = titles[route] || titles.painel;
  return (
    <div style={{ padding: "12px 16px", background: "var(--surface)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={() => h.back ? setRoute("painel") : setMenuOpen(true)} style={{ width: 38, height: 38, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer" }}>
        {h.back ? <IcChevL size={16} /> : <IcMenu size={16} />}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{h.t}</div>
        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{h.s}</div>
      </div>
      <button style={{ width: 38, height: 38, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer" }}><IcSearch size={15} /></button>
      <button style={{ width: 38, height: 38, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer", position: "relative" }}>
        <IcBell size={15} />
        <span style={{ position: "absolute", top: 6, right: 8, width: 7, height: 7, background: "var(--danger)", borderRadius: 50, border: "2px solid white" }}></span>
      </button>
    </div>
  );
}

function MobScreenBody({ route, setRoute }) {
  // Painel
  if (route === "painel") return (
    <>
      <div style={{ padding: 16, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ok)", marginBottom: 4 }}>● Confirmada</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em" }}>R$ 18.420</div>
          </div>
          <div style={{ paddingLeft: 14, borderLeft: "1px solid var(--line)" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--warn)", marginBottom: 4 }}>● Potencial</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--warn)" }}>R$ 6.890</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        {[{l:"Pedidos",v:"84"},{l:"Pendentes",v:"4"},{l:"Ticket",v:"R$ 153"}].map(k => (
          <div key={k.l} style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)" }}>{k.l}</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Pendentes</div>
      {[{id:"VTR-8042",n:"Maria Eduarda",t:47800,age:"2 min"},{id:"VTR-8041",n:"Júlio César",t:12900,age:"14 min"}].map(o => (
        <div key={o.id} style={{ display: "flex", gap: 10, padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 8 }}>
          <span className="b3-avatar" style={{ borderRadius: 50 }}>{o.n.slice(0,2)}</span>
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700 }}>{o.id}</div>
            <div style={{ fontWeight: 600 }}>{o.n}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>há {o.age}</div>
          </div>
          <div className="mono" style={{ fontWeight: 700 }}>R$ {(o.t/100).toFixed(2)}</div>
        </div>
      ))}
      <div style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 10px" }}>Atalhos</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { ico: "IcPdv", l: "Lançar venda", to: "pdv", brand: true },
          { ico: "IcCustomers", l: "Novo cliente", to: "cliente" },
          { ico: "IcCatalog", l: "Cadastrar produto", to: "produto" },
          { ico: "IcMoney", l: "Caixa do dia", to: "caixa" },
        ].map(a => {
          const Ic = window[a.ico];
          return (
            <button key={a.l} onClick={() => setRoute(a.to)} style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, background: a.brand ? "var(--brand)" : "var(--surface)", color: a.brand ? "white" : "var(--ink-1)", border: `1px solid ${a.brand ? "var(--brand)" : "var(--line)"}`, borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
              <Ic size={16} /><span style={{ flex: 1 }}>{a.l}</span><IcChevR size={12} />
            </button>
          );
        })}
      </div>
    </>
  );

  // Vendas/Pedidos
  if (route === "vendas") return (
    <>
      <div style={{ display: "flex", gap: 6, overflow: "auto", marginBottom: 12 }}>
        <span className="b3-pill b3-pill--brand">Pendentes 4</span>
        <span className="b3-pill">Confirmados 12</span>
        <span className="b3-pill">Entregues 280</span>
      </div>
      {[{id:"VTR-8042",n:"Maria Eduarda",t:47800,s:"warn",l:"Aguardando"},{id:"VTR-8041",n:"Júlio César",t:12900,s:"warn",l:"Aguardando"},{id:"BLC-219",n:"Anônimo",t:34800,s:"ok",l:"Entregue"}].map(o => (
        <div key={o.id} style={{ padding: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 700 }}>{o.id}</span>
            <span className={`b3-pill b3-pill--${o.s}`}>{o.l}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="b3-avatar">{o.n.slice(0,2)}</span>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{o.n}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>R$ {(o.t/100).toFixed(2)}</div>
          </div>
          {o.s === "warn" && (
            <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
              <button style={{ flex: 1, height: 36, background: "var(--bg-app)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}><IcWhatsApp size={13} /> WhatsApp</button>
              <button style={{ flex: 1, height: 36, background: "var(--brand)", color: "white", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>Confirmar</button>
            </div>
          )}
        </div>
      ))}
    </>
  );

  // PDV
  if (route === "pdv") return (
    <>
      <div style={{ padding: 16, background: "linear-gradient(135deg, var(--ink-1), #1A1E40)", color: "white", borderRadius: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Carrinho · 2 itens</div>
        <div className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 4 }}>R$ 296,00</div>
        <button style={{ width: "100%", height: 44, background: "white", color: "var(--ink-1)", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13.5, marginTop: 12, cursor: "pointer" }}>
          <IcCheckCir size={14} style={{ marginRight: 6 }} /> Finalizar
        </button>
      </div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <IcSearch size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
        <input style={{ width: "100%", height: 52, padding: "0 16px 0 42px", border: "none", background: "var(--surface)", borderRadius: 12, fontSize: 14, fontWeight: 600 }} placeholder="Buscar ou escanear…" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {B3_PRODUTOS.slice(0,4).map(p => (
          <button key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 10, cursor: "pointer", textAlign: "left" }}>
            <div style={{ aspectRatio: "1", background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, marginBottom: 8 }}>{p.img}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
            <div className="mono" style={{ fontWeight: 700, marginTop: 2 }}>R$ {(p.price/100).toFixed(2)}</div>
          </button>
        ))}
      </div>
    </>
  );

  // Catálogo
  if (route === "catalogo") return (
    <>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <IcSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
        <input style={{ width: "100%", height: 42, padding: "0 14px 0 36px", background: "var(--bg-app)", border: "none", borderRadius: 12, fontSize: 13.5 }} placeholder="Buscar produto…" />
      </div>
      <button onClick={() => setRoute("produto")} style={{ width: "100%", padding: 12, background: "var(--brand)", color: "white", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13.5, marginBottom: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <IcPlus size={14} /> Adicionar produto
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {B3_PRODUTOS.slice(0,6).map(p => (
          <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
            <div style={{ aspectRatio: "1", background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{p.img}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>R$ {(p.price/100).toFixed(2)}</div>
          </div>
        ))}
      </div>
    </>
  );

  // Produto
  if (route === "produto") return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button style={{ width: 88, height: 88, background: "var(--ink-1)", color: "white", border: "none", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="4"/><path d="M3 7h3l1.5-2h9L18 7h3v12H3z"/></svg>
          <span style={{ fontSize: 10 }}>Câmera</span>
        </button>
        <div style={{ width: 68, height: 88, background: "var(--brand-wash)", color: "var(--brand)", border: "1px solid var(--brand-line)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>VS</div>
      </div>
      <div className="b3-field"><label className="b3-field-label">Nome</label><input className="b3-input" placeholder="Vestido midi azul" style={{ height: 48 }} /></div>
      <div className="b3-row2">
        <div className="b3-field"><label className="b3-field-label">Preço</label><input className="b3-input mono" placeholder="R$ 0" style={{ height: 48 }} /></div>
        <div className="b3-field"><label className="b3-field-label">Estoque</label><input className="b3-input mono" placeholder="0" style={{ height: 48 }} /></div>
      </div>
      <button onClick={() => setRoute("catalogo")} style={{ width: "100%", height: 48, background: "var(--brand)", color: "white", border: "none", borderRadius: 12, fontWeight: 700, marginTop: 12, cursor: "pointer" }}>Publicar produto</button>
    </>
  );

  // Cliente
  if (route === "cliente") return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <div style={{ width: 88, height: 88, background: "var(--bg-app)", border: "1.5px dashed var(--line-2)", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)" }}><IcUser size={26} /></div>
      </div>
      <div className="b3-field"><label className="b3-field-label">Nome completo</label><input className="b3-input" placeholder="Maria Eduarda Silva" style={{ height: 48 }} /></div>
      <div className="b3-field"><label className="b3-field-label">WhatsApp</label><input className="b3-input mono" placeholder="+55 99 99182-4001" style={{ height: 48 }} /></div>
      <div className="b3-field"><label className="b3-field-label">CPF</label><input className="b3-input mono" placeholder="000.000.000-00" style={{ height: 48 }} /></div>
      <button onClick={() => setRoute("painel")} style={{ width: "100%", height: 48, background: "var(--brand)", color: "white", border: "none", borderRadius: 12, fontWeight: 700, marginTop: 12, cursor: "pointer" }}>Salvar cliente</button>
    </>
  );

  // Caixa
  if (route === "caixa") return (
    <>
      <div style={{ padding: 18, background: "var(--ink-1)", color: "white", borderRadius: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Total do dia</div>
        <div className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 4 }}>R$ 12.262</div>
      </div>
      {[{l:"PIX",v:"R$ 4.842",c:"var(--brand)"},{l:"Dinheiro",v:"R$ 2.864",c:"var(--ok)"},{l:"Débito",v:"R$ 1.980",c:"var(--warn)"}].map(m => (
        <div key={m.l} style={{ padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: m.c }}></span><span style={{ fontWeight: 600 }}>{m.l}</span></span>
          <span className="mono" style={{ fontWeight: 700 }}>{m.v}</span>
        </div>
      ))}
      <button style={{ width: "100%", height: 52, background: "var(--brand)", color: "white", border: "none", borderRadius: 14, fontWeight: 700, marginTop: 14, cursor: "pointer" }}><IcCheckCir size={15} /> Fechar caixa</button>
    </>
  );

  return <div>Tela em construção</div>;
}

Object.assign(window, { B3MobileApp, B3_MOB_ROUTES });
