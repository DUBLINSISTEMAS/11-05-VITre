// =========================================================
// DUBLIN V3 — Modais + Status popover + Mobile
// =========================================================

// ───────── MODAL ─────────
function B3Modal({ open, onClose, size = "md", title, subtitle, children, footer }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 420, md: 560, lg: 780, xl: 1080 };
  return (
    <div className="b3-overlay" style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: widths[size], maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px -20px rgba(15,20,25,0.5)", animation: "b3slidein 280ms cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</h2>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-4)" }}>{subtitle}</p>}
          </div>
          <button className="b3-drawer-close" onClick={onClose}><IcClose size={14} /></button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px" }}>{children}</div>
        {footer && <div style={{ padding: "14px 22px", background: "var(--bg-app)", borderTop: "1px solid var(--line)", display: "flex", gap: 10, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

// ───────── VENDA NOVA (Lançar pedido manual / venda balcão) ─────────
function B3VendaNovaModal({ open, onClose }) {
  return (
    <B3Modal open={open} onClose={onClose} size="lg" title="Lançar venda" subtitle="Venda balcão · registra como receita confirmada."
      footer={<>
        <button className="b3-btn" onClick={onClose}>Cancelar</button>
        <button className="b3-btn b3-btn--cta"><IcCheckCir size={14} /> Finalizar venda · R$ 269,00</button>
      </>}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 8 }}>Cliente</div>
        <div style={{ padding: 12, background: "var(--brand-wash)", border: "1px solid var(--brand-line)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span className="b3-avatar">PM</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Patrícia Mendes</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>+55 99 99882-1142 · 3 pedidos</div>
          </div>
          <button className="b3-btn b3-btn--sm">Trocar</button>
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)" }}>Produtos · 3 itens</div>
        </div>
        <div className="b3-toolbar-search" style={{ marginBottom: 8 }}>
          <IcSearch size={14} /><input placeholder="Buscar produto…" />
        </div>
        {[
          { name: "Vestido midi azul · M", sku: "VST-AZ-M", qty: 1, p: 18900 },
          { name: "Brinco gota dourado", sku: "BRC-DR-U", qty: 2, p: 4000 },
        ].map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 6 }}>
            <span className="b3-avatar" style={{ background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 6 }}>{it.name.slice(0,2)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{it.sku}</div>
            </div>
            <div className="mono" style={{ fontWeight: 700 }}>R$ {((it.qty * it.p) / 100).toFixed(2).replace(".", ",")}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 8 }}>Pagamento</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {[
            { l: "PIX", on: true, ico: "IcBolt" },
            { l: "Dinheiro", ico: "IcMoney" },
            { l: "Débito", ico: "IcPayment" },
            { l: "Crédito", ico: "IcPayment" },
          ].map(p => {
            const Ic = window[p.ico];
            return (
              <button key={p.l} style={{ padding: 12, background: p.on ? "var(--brand)" : "var(--surface)", color: p.on ? "white" : "var(--ink-1)", border: `1px solid ${p.on ? "var(--brand)" : "var(--line)"}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Ic size={14} /> {p.l}
              </button>
            );
          })}
        </div>
      </div>
    </B3Modal>
  );
}

// ───────── PRODUTO RÁPIDO ─────────
function B3ProdutoNovoModal({ open, onClose }) {
  return (
    <B3Modal open={open} onClose={onClose} size="lg" title="Cadastrar produto" subtitle="Preenche o essencial · detalhes depois."
      footer={<>
        <button className="b3-btn" onClick={onClose}>Cancelar</button>
        <button className="b3-btn"><IcPlus size={13} /> Publicar e criar outro</button>
        <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Publicar</button>
      </>}>
      <div className="b3-field">
        <label className="b3-field-label">Fotos do produto</label>
        <div style={{ display: "flex", gap: 8 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ width: 76, height: 76, background: i === 1 ? "var(--brand-wash)" : "var(--bg-app)", border: i === 1 ? "1px solid var(--brand-line)" : "1.5px dashed var(--line-2)", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {i === 1 ? <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--brand)" }}>VS</span> : <IcPlus size={14} style={{ color: "var(--ink-4)" }} />}
            </div>
          ))}
        </div>
      </div>
      <div className="b3-field">
        <label className="b3-field-label">Nome do produto</label>
        <input className="b3-input" placeholder="Ex: Vestido midi azul royal" autoFocus />
      </div>
      <div className="b3-row2">
        <div className="b3-field">
          <label className="b3-field-label">Categoria</label>
          <select className="b3-input b3-select"><option>Vestidos</option><option>Blazers</option></select>
        </div>
        <div className="b3-field">
          <label className="b3-field-label">SKU</label>
          <input className="b3-input mono" placeholder="VST-AZ" />
        </div>
      </div>
      <div className="b3-row2">
        <div className="b3-field">
          <label className="b3-field-label">Preço</label>
          <input className="b3-input mono" placeholder="R$ 0,00" />
        </div>
        <div className="b3-field">
          <label className="b3-field-label">Estoque inicial</label>
          <input className="b3-input mono" placeholder="0" />
        </div>
      </div>
      <div className="b3-field">
        <label className="b3-field-label">Tamanhos</label>
        <div style={{ display: "flex", gap: 6 }}>
          {[{s:"PP"},{s:"P"},{s:"M",on:true},{s:"G",on:true},{s:"GG"}].map(t => (
            <button key={t.s} style={{ flex: 1, height: 40, background: t.on ? "var(--brand-wash)" : "white", border: `1.5px solid ${t.on ? "var(--brand)" : "var(--line-2)"}`, color: t.on ? "var(--brand)" : "var(--ink-1)", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{t.s}</button>
          ))}
        </div>
      </div>
    </B3Modal>
  );
}

// ───────── MOVIMENTAÇÃO ESTOQUE ─────────
function B3MovimentacaoModal({ open, onClose }) {
  return (
    <B3Modal open={open} onClose={onClose} size="md" title="Nova movimentação" subtitle="Toda alteração de saldo é registrada."
      footer={<>
        <button className="b3-btn" onClick={onClose}>Cancelar</button>
        <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Lançar</button>
      </>}>
      <div className="b3-field">
        <label className="b3-field-label">Tipo</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {[
            { k: "ent", l: "Entrada", t: "Recebimento, devolução", on: true },
            { k: "sai", l: "Saída", t: "Perda, doação" },
            { k: "aju", l: "Ajuste", t: "Inventário, correção" },
            { k: "trf", l: "Transferência", t: "Entre lojas" },
          ].map(o => (
            <button key={o.k} style={{ padding: 12, background: o.on ? "var(--brand-wash)" : "white", border: `1.5px solid ${o.on ? "var(--brand)" : "var(--line)"}`, borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: o.on ? "var(--brand)" : "var(--ink-1)" }}>{o.l}</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{o.t}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="b3-field">
        <label className="b3-field-label">Produto</label>
        <input className="b3-input" placeholder="Buscar produto…" />
      </div>
      <div className="b3-row2">
        <div className="b3-field">
          <label className="b3-field-label">Quantidade</label>
          <input className="b3-input mono" placeholder="0" />
        </div>
        <div className="b3-field">
          <label className="b3-field-label">Data</label>
          <input className="b3-input mono" defaultValue="17/05/2026" />
        </div>
      </div>
      <div className="b3-field">
        <label className="b3-field-label">Motivo / Observação</label>
        <textarea className="b3-input" style={{ height: 80, padding: 10, fontFamily: "var(--font)" }} placeholder="Ex: recebimento da coleção verão 26…"></textarea>
      </div>
    </B3Modal>
  );
}

// ───────── STATUS POPOVER (event-delegated) ─────────
function B3StatusLayer() {
  const [pop, setPop] = React.useState(null);
  React.useEffect(() => {
    function onClick(e) {
      const pill = e.target.closest(".b3-pill--warn, .b3-pill--ok, .b3-pill--brand, .b3-pill--danger");
      if (!pill) return;
      const tr = pill.closest("tr");
      if (!tr) return;
      const h = location.hash;
      if (!h.includes("/pedidos") && !h.includes("/clientes") && !h.includes("/caixa") && !h.includes("/cupons")) return;
      e.stopPropagation(); e.preventDefault();
      const r = pill.getBoundingClientRect();
      setPop({ anchor: pill, x: r.left, y: r.bottom + 6, current: pill.textContent.trim() });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  if (!pop) return null;
  const opts = [
    { l: "Aguardando", c: "warn" },
    { l: "Confirmado", c: "brand" },
    { l: "Entregue", c: "ok" },
    { l: "Cancelado", c: "danger" },
  ];
  return (
    <div onClick={() => setPop(null)} style={{ position: "fixed", inset: 0, zIndex: 500 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", top: pop.y, left: pop.x, background: "white", borderRadius: 10, boxShadow: "0 10px 30px -10px rgba(15,20,25,0.3), 0 0 0 1px var(--line)", padding: 4, minWidth: 200 }}>
        <div style={{ padding: "6px 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", borderBottom: "1px solid var(--line)", marginBottom: 4 }}>Mudar status</div>
        {opts.map(o => (
          <button key={o.l} onClick={() => {
            pop.anchor.className = `b3-pill b3-pill--${o.c}`;
            pop.anchor.textContent = o.l;
            setPop(null);
          }} style={{ width: "100%", padding: "8px 10px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left", borderRadius: 6, fontSize: 13 }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-app)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span className={`b3-pill b3-pill--${o.c}`} style={{ height: 22 }}>{o.l}</span>
            {pop.current === o.l && <IcCheck size={12} style={{ marginLeft: "auto", color: "var(--brand)" }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────── MOBILE SHELL ─────────
function B3MobileFrame({ title, sub, nav = "painel", children, action }) {
  return (
    <div style={{ width: 390, height: 844, margin: "0 auto", background: "var(--bg-app)", borderRadius: 38, overflow: "hidden", position: "relative", border: "1px solid var(--line-2)", boxShadow: "0 30px 80px -30px rgba(15,20,25,0.25)" }}>
      <div style={{ height: 44, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700 }}>
        <span>9:41</span>
        <span style={{ width: 90, height: 26, background: "var(--ink-1)", borderRadius: 999 }}></span>
        <span style={{ fontSize: 11 }}>100%</span>
      </div>
      <div style={{ padding: "12px 16px", background: "var(--surface)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
        <button style={{ width: 38, height: 38, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer" }}><IcMenu size={16} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{sub}</div>}
        </div>
        {action || (
          <>
            <button style={{ width: 38, height: 38, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer" }}><IcSearch size={15} /></button>
            <button style={{ width: 38, height: 38, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer", position: "relative" }}>
              <IcBell size={15} />
              <span style={{ position: "absolute", top: 6, right: 8, width: 7, height: 7, background: "var(--danger)", borderRadius: 50, border: "2px solid white" }}></span>
            </button>
          </>
        )}
      </div>
      <div style={{ height: "calc(100% - 44px - 62px - 80px)", overflow: "auto", padding: "12px 16px" }}>{children}</div>
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 16, height: 64, background: var3MobNavBg, borderRadius: 22, display: "grid", gridTemplateColumns: "1fr 1fr 80px 1fr 1fr", padding: 4, alignItems: "center", boxShadow: "0 12px 30px -8px rgba(15,20,25,0.4)" }}>
        {[
          { k: "painel", ico: "IcDashboard", l: "Painel" },
          { k: "vendas", ico: "IcOrders", l: "Vendas" },
          { k: "pdv", ico: "IcPdv", l: "PDV", primary: true },
          { k: "catalogo", ico: "IcCatalog", l: "Catálogo" },
          { k: "mais", ico: "IcDots", l: "Mais" },
        ].map(it => {
          const Ic = window[it.ico];
          if (it.primary) return (
            <button key={it.k} style={{ width: 60, height: 60, margin: "0 auto", border: "4px solid var(--ink-1)", background: "linear-gradient(135deg, white, #DCE3F5)", color: "var(--ink-1)", borderRadius: 50, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic size={22} /></button>
          );
          return (
            <button key={it.k} style={{ background: "transparent", border: "none", color: nav === it.k ? "white" : "rgba(255,255,255,0.55)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 0", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
              <Ic size={17} /><span>{it.l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
const var3MobNavBg = "#0F1419";

// ───────── MOBILE DASHBOARD ─────────
function B3MobDashboardScreen() {
  return (
    <B3MobileFrame title="Painel" sub="sex 17 mai · 14:08" nav="painel">
      <div style={{ padding: 16, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ok)", marginBottom: 4 }}>● Confirmada</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1 }}>R$ 18.420</div>
          </div>
          <div style={{ paddingLeft: 14, borderLeft: "1px solid var(--line)" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--warn)", marginBottom: 4 }}>● Potencial</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1, color: "var(--warn)" }}>R$ 6.890</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { l: "Pedidos", v: "84", d: "+12%" },
          { l: "Pendentes", v: "4", d: "2 urg" },
          { l: "Ticket", v: "R$ 153", d: "+5%" },
        ].map(k => (
          <div key={k.l} style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)" }}>{k.l}</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{k.v}</div>
            <span className="b3-pill b3-pill--ok" style={{ fontSize: 9.5, height: 18, padding: "0 6px", marginTop: 4 }}>{k.d}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Pedidos aguardando</div>
      {[
        { id: "VTR-8042", name: "Maria Eduarda S.", t: 47800, age: "2 min" },
        { id: "VTR-8041", name: "Júlio César", t: 12900, age: "14 min" },
      ].map(o => (
        <div key={o.id} style={{ display: "flex", gap: 10, padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 8 }}>
          <span className="b3-avatar" style={{ borderRadius: 50 }}>{o.name.slice(0,2)}</span>
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>{o.id}</div>
            <div style={{ fontWeight: 600 }}>{o.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>há {o.age}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>R$ {(o.t/100).toFixed(2).replace(".", ",")}</div>
            <button className="b3-btn b3-btn--cta b3-btn--sm" style={{ marginTop: 4, fontSize: 10.5, height: 24, padding: "0 8px" }}>Abrir</button>
          </div>
        </div>
      ))}
    </B3MobileFrame>
  );
}

// ───────── MOBILE PRODUTOS ─────────
function B3MobProdutosScreen() {
  return (
    <B3MobileFrame title="Catálogo" sub="142 produtos" nav="catalogo" action={<button style={{ width: 38, height: 38, background: "var(--brand)", color: "white", border: "none", borderRadius: 50, cursor: "pointer" }}><IcPlus size={15} /></button>}>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <IcSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
        <input style={{ width: "100%", height: 42, padding: "0 14px 0 36px", background: "var(--bg-app)", border: "none", borderRadius: 12, fontSize: 13.5 }} placeholder="Buscar produto…" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {B3_PRODUTOS.slice(0, 6).map(p => (
          <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
            <div style={{ aspectRatio: "1", background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{p.img}</div>
            <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25 }}>{p.name}</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>R$ {(p.price/100).toFixed(2).replace(".", ",")}</div>
          </div>
        ))}
      </div>
    </B3MobileFrame>
  );
}

// ───────── MOBILE PDV ─────────
function B3MobPDVScreen() {
  return (
    <B3MobileFrame title="PDV" sub="Caixa #03 · aberto" nav="pdv">
      <div style={{ padding: 16, background: "linear-gradient(135deg, var(--ink-1), #1A1E40)", color: "white", borderRadius: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Carrinho · 2 itens</div>
        <div className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 4 }}>R$ 296,00</div>
        <button style={{ width: "100%", height: 44, background: "white", color: "var(--ink-1)", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13.5, marginTop: 12, cursor: "pointer" }}>
          <IcCheckCir size={14} style={{ marginRight: 6 }} /> Finalizar
        </button>
      </div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <IcSearch size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
        <input style={{ width: "100%", height: 52, padding: "0 16px 0 42px", border: "none", background: "var(--surface)", borderRadius: 12, fontSize: 14, fontWeight: 600 }} placeholder="Buscar ou escanear código…" />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", marginBottom: 8, letterSpacing: 0.04, textTransform: "uppercase" }}>Mais vendidos hoje</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {B3_PRODUTOS.slice(0, 4).map(p => (
          <button key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 10, cursor: "pointer", textAlign: "left" }}>
            <div style={{ aspectRatio: "1", background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, marginBottom: 8 }}>{p.img}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
            <div className="mono" style={{ fontWeight: 700, marginTop: 2 }}>R$ {(p.price/100).toFixed(2).replace(".", ",")}</div>
          </button>
        ))}
      </div>
    </B3MobileFrame>
  );
}

Object.assign(window, {
  B3Modal, B3VendaNovaModal, B3ProdutoNovoModal, B3MovimentacaoModal,
  B3StatusLayer,
  B3MobileFrame, B3MobDashboardScreen, B3MobProdutosScreen, B3MobPDVScreen,
});
