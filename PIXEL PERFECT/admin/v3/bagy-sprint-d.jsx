// =========================================================
// DUBLIN V3 — Sprint D: Fluxos do dia-a-dia
// Recibo · Marcar entregue · WhatsApp handoff · Inventário
// =========================================================

// ───────── RECIBO DE IMPRESSÃO ─────────
function B3ReciboModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="b3-overlay" style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 420, maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px -20px rgba(15,20,25,0.5)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Recibo · BLC-219</h2>
          <button className="b3-drawer-close" onClick={onClose}><IcClose size={14} /></button>
        </div>
        <div style={{ padding: 24, fontFamily: "var(--mono)", fontSize: 12, overflow: "auto" }}>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, background: "var(--brand)", color: "white", margin: "0 auto 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20 }}>S</div>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "var(--font)" }}>Sandra Brito Collection</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>Rua Coelho Neto, 142 · Pedreiras-MA</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>+55 99 98401-3304</div>
          </div>
          <div style={{ borderTop: "1px dashed var(--line-2)", borderBottom: "1px dashed var(--line-2)", padding: "10px 0", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "var(--ink-4)" }}>RECIBO</span><b style={{ color: "var(--brand)" }}>BLC-219</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "var(--ink-4)" }}>Data</span><span>17 mai · 14:08</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink-4)" }}>Caixa</span><span>#03 · Sandra</span></div>
          </div>
          <table style={{ width: "100%", marginBottom: 10 }}>
            <thead><tr style={{ fontSize: 9, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)" }}><th align="left">Item</th><th align="right">Qtd</th><th align="right">Total</th></tr></thead>
            <tbody>
              {[{n:"Vestido midi azul · M",q:1,t:18900},{n:"Brinco gota dourado",q:2,t:8000}].map((it,i)=>(
                <tr key={i}><td style={{padding:"6px 0",borderBottom:"1px dashed var(--line)"}}><div>{it.n}</div></td><td align="right">{it.q}</td><td align="right" style={{fontWeight:700}}>R$ {(it.t/100).toFixed(2).replace(".",",")}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop: "1px dashed var(--line-2)", paddingTop: 10, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}><span style={{ color: "var(--ink-4)" }}>Subtotal</span><span>R$ 269,00</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 11 }}><span style={{ color: "var(--ink-4)" }}>Desconto PIX</span><span style={{ color: "var(--warn)" }}>−R$ 26,90</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--ink-1)" }}><b style={{ fontSize: 13 }}>TOTAL</b><b style={{ fontSize: 16 }}>R$ 242,10</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11 }}><span style={{ color: "var(--ink-4)" }}>Pagamento</span><span className="b3-pill b3-pill--brand">PIX</span></div>
          </div>
          <div style={{ textAlign: "center", marginTop: 18, paddingTop: 14, borderTop: "1px dashed var(--line-2)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.08, color: "var(--brand)" }}>OBRIGADA PELA COMPRA ✿</div>
            <div style={{ fontSize: 9.5, color: "var(--ink-4)", marginTop: 4 }}>Trocas até 7 dias com este recibo</div>
          </div>
        </div>
        <div style={{ padding: "14px 20px", background: "var(--bg-app)", borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
          <button className="b3-btn" onClick={onClose}><IcCopy size={13} /> Copiar</button>
          <button className="b3-btn"><IcWhatsApp size={13} /> WhatsApp</button>
          <div style={{ flex: 1 }}></div>
          <button className="b3-btn b3-btn--cta" onClick={() => { window.print(); onClose(); }}><IcPrint size={14} /> Imprimir</button>
        </div>
      </div>
    </div>
  );
}

// ───────── WHATSAPP HANDOFF MODAL ─────────
function B3WhatsAppHandoff({ open, onClose }) {
  if (!open) return null;
  const msg = `Olá Maria! 💖

Vim do seu catálogo Sandra Brito e gostaria de finalizar este pedido:

• Vestido midi azul royal · M (1) — R$ 189,00
• Blazer verde sálvia · G (1) — R$ 249,00
• Brinco gota dourado (2) — R$ 80,00

Subtotal: R$ 518,00
Total com PIX (10% OFF): R$ 466,20

Forma de pagamento: PIX
Entrega: Sedex · 3-5 dias

Me responde quando puder ✿`;
  return (
    <div className="b3-overlay" style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", boxShadow: "0 30px 80px -20px rgba(15,20,25,0.5)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Atender pedido no WhatsApp</h2>
            <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>Maria Eduarda Silva · VTR-8042</div>
          </div>
          <button className="b3-drawer-close" onClick={onClose}><IcClose size={14} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ background: "#0F1419", borderRadius: 18, padding: 8, marginBottom: 16 }}>
            <div style={{ background: "#075E54", color: "white", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderRadius: "10px 10px 0 0" }}>
              <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, var(--brand), #3F60C2)", borderRadius: 50, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>S</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Sandra Brito Collection</div>
                <div style={{ fontSize: 10.5, opacity: 0.8 }}>online</div>
              </div>
            </div>
            <div style={{ background: "linear-gradient(180deg, #E3DDD2, #DACEB6)", padding: 14, borderRadius: "0 0 10px 10px" }}>
              <div style={{ background: "#DCF8C6", padding: "8px 10px", borderRadius: 10, borderTopRightRadius: 2, maxWidth: "85%", marginLeft: "auto", fontSize: 12, lineHeight: 1.4, whiteSpace: "pre-wrap", fontFamily: "var(--font)", color: "var(--ink-1)" }}>{msg}<div style={{ textAlign: "right", fontSize: 9.5, opacity: 0.5, marginTop: 4 }}>14:08 ✓✓</div></div>
            </div>
          </div>
          <div style={{ padding: 12, background: "var(--brand-wash)", border: "1px solid var(--brand-line)", borderRadius: 10, display: "flex", gap: 10, fontSize: 12.5 }}>
            <IcInfo size={14} style={{ color: "var(--brand)", marginTop: 2, flexShrink: 0 }} />
            <span>Ao confirmar, o pedido será marcado como <b>"Confirmado"</b> e o estoque debitado. Sandra te chama no WhatsApp pra combinar entrega.</span>
          </div>
        </div>
        <div style={{ padding: "14px 22px", background: "var(--bg-app)", borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
          <button className="b3-btn" onClick={onClose}>Cancelar</button>
          <div style={{ flex: 1 }}></div>
          <button className="b3-btn" onClick={onClose}><IcXCir size={13} /> Marcar como expirado</button>
          <button className="b3-btn b3-btn--cta" onClick={onClose} style={{ background: "#25D366", borderColor: "#25D366" }}><IcWhatsApp size={14} /> Abrir WhatsApp · confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ───────── MARCAR ENTREGUE ─────────
function B3MarkDeliveredModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="b3-overlay" style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 420, boxShadow: "0 30px 80px -20px rgba(15,20,25,0.5)" }}>
        <div style={{ padding: "20px 24px 16px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, background: "var(--ok-wash)", color: "var(--ok)", borderRadius: 50, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <IcCheckCir size={26} />
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Marcar pedido como entregue?</h3>
          <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.5 }}>VTR-8042 · Maria Eduarda · R$ 478,00 · 3 itens. Confirma que a cliente recebeu o pedido?</p>
        </div>
        <div style={{ padding: "0 24px 16px" }}>
          <label className="b3-checkbox" style={{ marginBottom: 8 }}>
            <span className="b3-checkbox-box"><IcCheck size={11} /></span>
            <span>Enviar mensagem de agradecimento no WhatsApp</span>
          </label>
          <label className="b3-checkbox">
            <span className="b3-checkbox-box"><IcCheck size={11} /></span>
            <span>Convidar cliente pra deixar avaliação</span>
          </label>
        </div>
        <div style={{ padding: "14px 24px 18px", display: "flex", gap: 10, borderTop: "1px solid var(--line)" }}>
          <button className="b3-btn" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="b3-btn b3-btn--cta" onClick={onClose} style={{ flex: 1 }}><IcCheck size={14} /> Marcar entregue</button>
        </div>
      </div>
    </div>
  );
}

// ───────── INVENTÁRIO FÍSICO ─────────
function B3InventarioScreen() {
  return (
    <B3Shell active="estoque">
      <div className="b3-page">
        <div className="b3-back-row">
          <button onClick={() => location.hash = "/estoque"}><IcChevL size={15} /></button>
          <div>
            <h1>Inventário físico</h1>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>Iniciado em 17 mai · operador Sandra · 8 de 142 produtos contados</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="b3-btn"><IcPrint size={14} /> Imprimir lista</button>
            <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Finalizar inventário</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
          {[
            { l: "Total a contar", v: "142", c: "var(--ink-1)" },
            { l: "Contados", v: "8", c: "var(--ok)" },
            { l: "Com divergência", v: "3", c: "var(--warn)" },
            { l: "Pendentes", v: "134", c: "var(--ink-4)" },
          ].map(s => (
            <div key={s.l} className="b3-card b3-card-pad">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: s.c, marginBottom: 6 }}>{s.l}</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div className="b3-card" style={{ overflow: "hidden" }}>
          <div className="b3-toolbar">
            <div className="b3-toolbar-search">
              <IcSearch size={14} />
              <input placeholder="Buscar produto ou escanear código de barras…" autoFocus />
            </div>
            <button className="b3-btn b3-btn--sm">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="1.5" height="10"/><rect x="3.5" y="3" width="0.5" height="10"/><rect x="5" y="3" width="2" height="10"/><rect x="8" y="3" width="0.5" height="10"/><rect x="9.5" y="3" width="2" height="10"/></svg>
              Escanear
            </button>
          </div>
          <table className="b3-tbl">
            <thead>
              <tr><th style={{ paddingLeft: 20 }}>PRODUTO</th><th>SKU</th><th style={{ textAlign: "right" }}>SISTEMA</th><th style={{ textAlign: "right" }}>CONTADO</th><th style={{ textAlign: "right" }}>DIVERGÊNCIA</th><th>STATUS</th></tr>
            </thead>
            <tbody>
              {[
                { n: "Vestido midi azul · M", s: "VST-AZ-M", sys: 4, count: 4, status: "ok" },
                { n: "Vestido midi azul · G", s: "VST-AZ-G", sys: 2, count: 1, status: "div" },
                { n: "Blazer verde sálvia · G", s: "BL-VRD-G", sys: 7, count: 7, status: "ok" },
                { n: "Saia plissada bege · M", s: "SAI-BR-M", sys: 0, count: 2, status: "div" },
                { n: "Brinco gota dourado", s: "BRC-DR-U", sys: 12, count: 12, status: "ok" },
                { n: "Blusa cropped creme · M", s: "BLS-CRM-M", sys: 4, count: 3, status: "div" },
                { n: "Camisa oversized branca", s: "CMS-BR", sys: 11, count: null, status: "pend" },
                { n: "Calça wide leg veludo", s: "CL-VLD", sys: 6, count: null, status: "pend" },
              ].map((r, i) => (
                <tr key={i}>
                  <td style={{ paddingLeft: 20, fontWeight: 600 }}>{r.n}</td>
                  <td className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>{r.s}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.sys}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.count !== null ? <input className="b3-input mono" defaultValue={r.count} style={{ width: 70, height: 32, textAlign: "right", marginLeft: "auto" }} /> : <input className="b3-input" placeholder="—" style={{ width: 70, height: 32, marginLeft: "auto" }} />}
                  </td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: r.status === "div" ? "var(--warn)" : "var(--ink-4)" }}>
                    {r.count !== null && r.count !== r.sys ? (r.count > r.sys ? "+" : "") + (r.count - r.sys) : "—"}
                  </td>
                  <td>
                    {r.status === "ok" && <span className="b3-pill b3-pill--ok">● Conferido</span>}
                    {r.status === "div" && <span className="b3-pill b3-pill--warn">● Divergência</span>}
                    {r.status === "pend" && <span className="b3-pill">Pendente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="b3-card b3-card-pad" style={{ marginTop: 16, background: "var(--warn-wash)", border: "1px solid #F0D580" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <IcInfo size={16} style={{ color: "var(--warn)", marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>3 produtos com divergência</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>Ao finalizar inventário, as divergências geram movimentação automática de ajuste no estoque com motivo "inventário físico · 17 mai".</div>
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

Object.assign(window, { B3ReciboModal, B3WhatsAppHandoff, B3MarkDeliveredModal, B3InventarioScreen });
