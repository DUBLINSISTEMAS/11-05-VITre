// =========================================================
// DUBLIN V3 — Sprint A: features migradas (banner + toast + hide-value)
// =========================================================

// ───────── BANNER DE ASSINATURA ─────────
function B3Banner({ kind = "trial", onClose }) {
  const variants = {
    trial:   { label: <><b>14 dias de Pro grátis</b> · cadastre cartão pra continuar depois.</>, cta: "Assinar Pro" },
    renew:   { label: <><b>Sua assinatura vence em 7 dias</b> · R$ 89/mês · renovação automática.</>, cta: "Gerenciar" },
    overdue: { label: <><b>Pagamento atrasado</b> · cartão falhou. Atualize pra reativar.</>, cta: "Atualizar" },
  };
  const v = variants[kind];
  return (
    <div className="b3-banner">
      <span className="b3-banner-ico"><IcSparkle size={12} /></span>
      <span style={{ flex: 1 }}>{v.label}</span>
      <button className="b3-banner-cta" onClick={() => location.hash = "/assinatura"}>{v.cta} <IcChevR size={11} /></button>
      <button className="b3-banner-x" onClick={onClose}><IcClose size={13} /></button>
    </div>
  );
}

// ───────── TOAST SYSTEM ─────────
function B3Toasts() {
  const [toasts, setToasts] = React.useState([]);
  React.useEffect(() => {
    const samples = [
      { id: 1, tone: "ok",    ico: "IcStock",    t: "Estoque atualizado", b: "−1 un. VST-AZ-M · pedido VTR-8042 confirmado", delay: 2500 },
      { id: 2, tone: "warn",  ico: "IcStock",    t: "Estoque baixo",       b: "Saia plissada bege · M zerou",                  delay: 7500 },
      { id: 3, tone: "brand", ico: "IcWhatsApp", t: "Novo pedido!",        b: "Maria Eduarda · 3 itens · R$ 478,00",            delay: 14000 },
    ];
    const timers = samples.map(s => setTimeout(() => {
      setToasts(ts => [...ts, s]);
      setTimeout(() => setToasts(ts => ts.filter(x => x.id !== s.id)), 5000);
    }, s.delay));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="b3-toasts">
      {toasts.map(t => {
        const Ic = window[t.ico];
        return (
          <div key={t.id} className={`b3-toast b3-toast--${t.tone}`}>
            <span className="b3-toast-ico"><Ic size={14} /></span>
            <div className="b3-toast-body"><b>{t.t}</b><span>{t.b}</span></div>
            <button className="b3-banner-x" onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}><IcClose size={11} /></button>
          </div>
        );
      })}
    </div>
  );
}

// ───────── DASHBOARD APRIMORADO (hide value + tabs + receita dual) ─────────
function B3DashboardV2Screen() {
  const [hide, setHide] = React.useState(false);
  const [tab, setTab] = React.useState("geral");
  const f = (v) => hide ? "R$ •••••" : v;
  return (
    <B3Shell active="dashboard">
      <div className="b3-page">
        <div className="b3-page-hd">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Olá, Sandra Brito!</h1>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>sex 17 mai · 14:08</div>
          </div>
          <button className="b3-btn" onClick={() => setHide(v => !v)}>
            <IcEye size={14} /> {hide ? "Mostrar valores" : "Ocultar valores"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 50, background: "var(--ok)" }}></span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ok)" }}>Receita confirmada</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--ink-4)" }}>7 DIAS</span>
            </div>
            <div className="mono" style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1 }}>{f("R$ 18.420")}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 8 }}><b className="mono" style={{ color: "var(--ink-1)" }}>67</b> balcão · <b className="mono" style={{ color: "var(--ink-1)" }}>29</b> WhatsApp confirmados</div>
          </div>
          <div style={{ padding: 22, borderLeft: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 50, background: "var(--warn)" }}></span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--warn)" }}>Receita potencial</span>
            </div>
            <div className="mono" style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1, color: "var(--warn)" }}>{f("R$ 6.890")}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 8 }}><b className="mono" style={{ color: "var(--ink-1)" }}>4</b> pendentes · <b className="mono" style={{ color: "var(--ink-1)" }}>64%</b> taxa histórica</div>
          </div>
        </div>

        <div className="b3-card" style={{ overflow: "hidden", marginBottom: 16 }}>
          <div className="b3-card-hd">
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)" }}>FLUXO DE RECEITA · 90 DIAS</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4 }}>{f("R$ 287.420")}</div>
            </div>
            <div style={{ display: "inline-flex", padding: 3, background: "var(--bg-app)", borderRadius: 8 }}>
              {[{k:"geral",l:"Geral"},{k:"pdv",l:"PDV"},{k:"cat",l:"Catálogo"}].map(t => (
                <span key={t.k} onClick={() => setTab(t.k)} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", borderRadius: 6, background: tab === t.k ? "white" : "transparent", color: tab === t.k ? "var(--ink-1)" : "var(--ink-4)", fontWeight: tab === t.k ? 600 : 400, boxShadow: tab === t.k ? "0 1px 2px rgba(0,0,0,0.04)" : "none" }}>{t.l}</span>
              ))}
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <svg width="100%" height="200" viewBox="0 0 600 200" preserveAspectRatio="none">
              {[0.25, 0.5, 0.75].map((y, i) => <line key={i} x1="0" x2="600" y1={200 * y} y2={200 * y} stroke="#E8EAEE" strokeDasharray="2 2" />)}
              <path d="M 0 160 C 50 140, 100 100, 150 110 S 250 80, 300 60 S 400 30, 450 40 S 550 20, 600 10" stroke="#1A3A8F" strokeWidth="2.5" fill="none" />
              <path d="M 0 160 C 50 140, 100 100, 150 110 S 250 80, 300 60 S 400 30, 450 40 S 550 20, 600 10 L 600 200 L 0 200 Z" fill="rgba(26,58,143,0.08)" />
            </svg>
          </div>
        </div>

        {/* Pedidos pendentes + Estoque baixo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div className="b3-card">
            <div className="b3-card-hd"><h3>Pendentes</h3><span className="b3-pill b3-pill--warn">4 urgentes</span></div>
            <div style={{ padding: "0 20px 16px" }}>
              {[{ id: "VTR-8042", n: "Maria Eduarda S.", t: 47800, age: "2 min", urg: true }, { id: "VTR-8041", n: "Júlio César", t: 12900, age: "14 min" }, { id: "VTR-8040", n: "Larissa Brito", t: 89500, age: "38 min" }].map(o => (
                <div key={o.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <span className="b3-avatar">{o.n.slice(0,2)}</span>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>{o.id}</div>
                    <div style={{ fontSize: 13 }}>{o.n}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 700 }}>{f(`R$ ${(o.t/100).toFixed(0)}`)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="b3-card">
            <div className="b3-card-hd"><h3>Estoque baixo</h3><span className="b3-pill b3-pill--danger">4</span></div>
            <div style={{ padding: "0 20px 16px" }}>
              {[{ s: "VST-AZ-M", n: "Vestido midi · M", st: 1, min: 5 }, { s: "VST-AZ-P", n: "Vestido midi · P", st: 0, min: 5 }, { s: "BL-VRD-G", n: "Blazer verde · G", st: 2, min: 4 }, { s: "SAI-BR-M", n: "Saia bege · M", st: 0, min: 4 }].map(p => (
                <div key={p.s} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                  <span className="b3-avatar" style={{ background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 6 }}>{p.s.slice(0,2)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{p.n}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{p.s}</div>
                  </div>
                  <span className={`b3-pill b3-pill--${p.st === 0 ? "danger" : "warn"}`} style={{ fontFamily: "var(--mono)" }}>{p.st}/{p.min}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="b3-card">
            <div className="b3-card-hd"><h3>Mix pagamento</h3><span className="b3-pill">7 dias</span></div>
            <div style={{ padding: "16px 20px" }}>
              {[{ l: "PIX", p: 41, c: "var(--brand)" }, { l: "Dinheiro", p: 28, c: "var(--ok)" }, { l: "Débito", p: 16, c: "var(--warn)" }, { l: "Crédito", p: 11, c: "#6B2A8C" }, { l: "Outros", p: 4, c: "var(--ink-4)" }].map(m => (
                <div key={m.l} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, background: m.c, borderRadius: 2 }}></span>{m.l}</span>
                    <span className="mono" style={{ fontWeight: 700 }}>{m.p}%</span>
                  </div>
                  <div style={{ height: 4, background: m.c + "1f", borderRadius: 2 }}><div style={{ width: m.p + "%", height: "100%", background: m.c, borderRadius: 2 }}></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

Object.assign(window, { B3Banner, B3Toasts, B3DashboardV2Screen });
