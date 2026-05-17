// =========================================================
// DUBLIN V3 — Sprint F (FIXES): wiring + ações reais
// • Click no overlay fecha modais
// • Linhas de tabela clicáveis (pedidos, produtos, estoque, cupons, banners, caixa)
// • Pedido detalhe: confirmar → WhatsApp handoff
// • PDV "Finalizar venda" → Recibo
// • User menu, quick actions, search dropdown na topbar
// • Notificações clicáveis
// =========================================================

// ───── B3Modal overlay click → close (event delegation) ─────
// Quando o usuário clica no fundo escurecido (.b3-overlay) de um modal,
// dispara o close button (.b3-drawer-close) mais próximo no overlay.
(function installOverlayClickClose() {
  document.addEventListener("click", (e) => {
    // só age se o clique foi exatamente no overlay (não num filho)
    if (e.target.classList && e.target.classList.contains("b3-overlay")) {
      // se o overlay tem um drawer dentro, ele já tem handler próprio (drawer fecha)
      const drawer = e.target.querySelector(".b3-drawer");
      if (drawer) return; // o drawer já trata isso
      // pra modais centrais (B3Modal), procura o close button
      const x = e.target.querySelector(".b3-drawer-close");
      if (x) x.click();
    }
  }, true);
})();

// ───── USER MENU (popover from sidebar foot) ─────
function B3UserMenu({ open, onClose }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 600 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "fixed", left: 16, bottom: 80, width: 240, background: "white", borderRadius: 12, boxShadow: "0 12px 36px -10px rgba(15,20,25,0.3), 0 0 0 1px var(--line)", padding: 4, animation: "b3fadein 160ms ease-out" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Sandra Brito</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>sandra@sandrabrito.com</div>
          <span className="b3-pill b3-pill--ok" style={{ marginTop: 8, fontSize: 10 }}>● Trial · 14 dias</span>
        </div>
        {[
          { ico: "IcUser", l: "Meu perfil", to: "/configuracoes" },
          { ico: "IcAppearance", l: "Mudar loja", chip: "1 loja" },
          { ico: "IcSparkle", l: "Assinatura", to: "/assinatura" },
          { ico: "IcInfo", l: "Suporte", to: "/suporte" },
        ].map(it => {
          const Ic = window[it.ico];
          return (
            <button key={it.l} onClick={() => { if (it.to) location.hash = it.to; onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: "var(--ink-1)", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-app)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Ic size={15} style={{ color: "var(--ink-3)" }} />
              <span style={{ flex: 1 }}>{it.l}</span>
              {it.chip && <span className="b3-pill" style={{ fontSize: 10 }}>{it.chip}</span>}
            </button>
          );
        })}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}>
          <button onClick={() => { location.hash = "/login"; onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: "var(--danger)", cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-app)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M10 2.5a.75.75 0 0 0-1.5 0v6.75a.75.75 0 0 0 1.5 0V2.5Z"/><path d="M4.94 4.94a.75.75 0 0 0-1.06-1.06A6.5 6.5 0 1 0 14.5 8.5a.75.75 0 0 0-1.5 0 5 5 0 1 1-8.06-3.56Z"/></svg>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

// ───── QUICK ACTIONS PALETTE (bolt button) ─────
function B3QuickActions({ open, onClose }) {
  if (!open) return null;
  const actions = [
    { ico: "IcPlus", l: "Novo produto", k: "produto", desc: "Cadastrar produto" },
    { ico: "IcCustomers", l: "Novo cliente", k: "cliente", desc: "Cadastrar cliente" },
    { ico: "IcPdv", l: "Lançar venda balcão", k: "venda", desc: "Venda PDV" },
    { ico: "IcStock", l: "Movimentar estoque", k: "mov", desc: "Entrada / saída / ajuste" },
    { ico: "IcArchive", l: "Inventário físico", k: "inv", desc: "Contagem geral", to: "/estoque/inventario" },
    { ico: "IcSparkle", l: "Novo cupom", to: "/promocoes/cupons" },
  ];
  const navs = [
    { l: "Painel", to: "/dashboard" },
    { l: "Pedidos", to: "/vendas/pedidos" },
    { l: "PDV · balcão", to: "/vendas/pdv" },
    { l: "Caixa do dia", to: "/vendas/caixa" },
    { l: "Estoque", to: "/estoque" },
    { l: "Aparência da loja", to: "/loja-virtual" },
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,20,25,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "white", borderRadius: 14, boxShadow: "0 30px 80px -20px rgba(15,20,25,0.5)", animation: "b3slidein 220ms cubic-bezier(0.22,1,0.36,1)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
          <IcBolt size={15} style={{ color: "var(--brand)" }} />
          <input autoFocus placeholder="Pesquisar ações, telas e atalhos…" style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: "var(--font)" }} />
          <span className="mono" style={{ fontSize: 10.5, padding: "2px 6px", background: "var(--bg-app)", borderRadius: 4, color: "var(--ink-4)", letterSpacing: 0.05 }}>ESC</span>
        </div>
        <div style={{ padding: "12px 8px 14px", maxHeight: 480, overflow: "auto" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", padding: "6px 12px 4px" }}>Criar</div>
          {actions.map(a => {
            const Ic = window[a.ico];
            return (
              <button key={a.l} onClick={() => {
                if (a.to) { location.hash = a.to; }
                else if (a.k === "produto") window.__openProdModal?.();
                else if (a.k === "cliente") window.__openDrawer?.();
                else if (a.k === "venda") window.__openVendaModal?.();
                else if (a.k === "mov") window.__openMovModal?.();
                onClose();
              }} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-app)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ width: 28, height: 28, background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic size={13} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.l}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{a.desc}</div>
                </div>
                <IcChevR size={11} style={{ color: "var(--ink-4)" }} />
              </button>
            );
          })}
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)", padding: "12px 12px 4px" }}>Ir para…</div>
          {navs.map(n => (
            <button key={n.l} onClick={() => { location.hash = n.to; onClose(); }} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 13, color: "var(--ink-1)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-app)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ flex: 1 }}>{n.l}</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{n.to}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───── SEARCH DROPDOWN (top bar) ─────
function B3SearchDropdown({ open, onClose, anchor }) {
  if (!open || !anchor) return null;
  const r = anchor.getBoundingClientRect();
  const items = [
    { type: "Cliente", l: "Maria Eduarda Silva", sub: "+55 99 99182-4001 · 8 pedidos", to: "/clientes/detalhe" },
    { type: "Pedido", l: "VTR-8042 · R$ 478,00", sub: "Aguardando · há 2 min", to: "/vendas/pedidos/8042" },
    { type: "Produto", l: "Vestido midi azul royal", sub: "VST-AZ · 6 em estoque · R$ 189", to: "/produtos/detalhe" },
    { type: "Cliente", l: "Patrícia Mendes", sub: "+55 99 99882-1142 · 3 pedidos", to: "/clientes/detalhe" },
    { type: "Produto", l: "Blazer verde sálvia", sub: "BL-VRD · 7 em estoque · R$ 249", to: "/produtos/detalhe" },
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "fixed", top: r.bottom + 4, left: r.left, width: r.width, maxHeight: 480, overflow: "auto", background: "white", borderRadius: 12, boxShadow: "0 16px 40px -10px rgba(15,20,25,0.25), 0 0 0 1px var(--line)", padding: 6 }}>
        <div style={{ padding: "6px 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)" }}>Resultados rápidos</div>
        {items.map((it, i) => (
          <button key={i} onClick={() => { location.hash = it.to; onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-app)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span className="b3-pill" style={{ fontSize: 10, padding: "2px 6px" }}>{it.type}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.l}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{it.sub}</div>
            </div>
          </button>
        ))}
        <div style={{ padding: "8px 10px", borderTop: "1px solid var(--line)", marginTop: 4, fontSize: 11.5, color: "var(--ink-4)" }}>
          Pressione <span className="mono" style={{ padding: "1px 5px", background: "var(--bg-app)", borderRadius: 3 }}>↵</span> pra busca avançada
        </div>
      </div>
    </div>
  );
}

// ───── WIRE EVERYTHING UP (single effect on document) ─────
function B3GlobalWiring() {
  React.useEffect(() => {
    function wire() {
      const hash = location.hash.slice(1) || "/dashboard";

      // Top bar
      const [boltBtn, bellBtn] = document.querySelectorAll(".b3-top-icbtn");
      if (boltBtn && !boltBtn.__wired) {
        boltBtn.__wired = true;
        boltBtn.onclick = () => window.__openQuick?.();
      }
      // bell already wired to /notificacoes

      // Top search input — open dropdown on focus
      const searchInput = document.querySelector(".b3-top .b3-search input");
      if (searchInput && !searchInput.__wired) {
        searchInput.__wired = true;
        searchInput.onfocus = () => window.__openSearch?.(document.querySelector(".b3-top .b3-search"));
        searchInput.onkeydown = (e) => { if (e.key === "Escape") searchInput.blur(); };
      }

      // Sidebar user foot
      const userFoot = document.querySelector(".b3-side-foot-user");
      if (userFoot && !userFoot.__wired) {
        userFoot.__wired = true;
        userFoot.onclick = () => window.__openUserMenu?.();
      }

      // Pedidos table rows → detalhe
      if (hash === "/vendas/pedidos") {
        document.querySelectorAll(".b3-tbl tbody tr").forEach(tr => {
          if (tr.__wired) return;
          tr.__wired = true;
          tr.style.cursor = "pointer";
          tr.onclick = (e) => {
            if (e.target.closest("input,button,.b3-pill")) return;
            location.hash = "/vendas/pedidos/8042";
          };
        });
      }

      // Produtos table rows → detalhe
      if (hash === "/produtos" || hash === "/loja-virtual/produtos") {
        document.querySelectorAll(".b3-tbl tbody tr").forEach(tr => {
          if (tr.__wired) return;
          tr.__wired = true;
          tr.style.cursor = "pointer";
          tr.onclick = (e) => {
            if (e.target.closest("input,button,.b3-toggle")) return;
            location.hash = "/produtos/detalhe";
          };
        });
      }

      // Estoque rows → produto detalhe (foco na variante)
      if (hash === "/estoque") {
        document.querySelectorAll(".b3-tbl tbody tr").forEach(tr => {
          if (tr.__wired) return;
          tr.__wired = true;
          tr.style.cursor = "pointer";
          tr.onclick = (e) => {
            if (e.target.closest("input,button")) return;
            location.hash = "/produtos/detalhe";
          };
        });
      }

      // Caixa rows → recibo
      if (hash === "/vendas/caixa") {
        document.querySelectorAll(".b3-tbl tbody tr").forEach(tr => {
          if (tr.__wired) return;
          tr.__wired = true;
          tr.style.cursor = "pointer";
          tr.onclick = (e) => {
            if (e.target.closest("input,button")) return;
            window.__openRecibo?.();
          };
        });
      }

      // Cupons / Banners → toast
      if (hash === "/promocoes/cupons" || hash === "/promocoes" || hash === "/produtos/banners") {
        document.querySelectorAll(".b3-tbl tbody tr").forEach(tr => {
          if (tr.__wired) return;
          tr.__wired = true;
          tr.style.cursor = "pointer";
          tr.onclick = (e) => {
            if (e.target.closest("input,button,.b3-pill")) return;
            window.__toast?.({ tone: "brand", t: "Em breve", b: "Detalhe do cupom · drawer de edição" });
          };
        });
      }

      // Pedido detalhe — Confirmar pedido / WhatsApp
      if (hash === "/vendas/pedidos/8042") {
        document.querySelectorAll(".b3-back-row + * .b3-btn, .b3-back-row .b3-btn, .b3-page-hd .b3-btn").forEach(b => {
          if (b.__wired) return;
          const t = b.textContent.trim();
          if (t.includes("Confirmar pedido")) {
            b.__wired = true;
            b.onclick = () => window.__openWhats?.();
          } else if (t.includes("WhatsApp")) {
            b.__wired = true;
            b.onclick = () => window.__openWhats?.();
          } else if (t.includes("Imprimir")) {
            b.__wired = true;
            b.onclick = () => window.__openRecibo?.();
          }
        });
        // Detect status pill "Aguardando" no header → click pra mudar
        // (already handled by B3StatusLayer)
      }

      // PDV — Finalizar disabled → no-op (carrinho vazio na demo)
      // Quando o carrinho tiver itens, o handler real ficaria aqui.

      // Caixa "Imprimir fechamento" → recibo
      if (hash === "/vendas/caixa") {
        document.querySelectorAll(".b3-page-hd .b3-btn--cta").forEach(b => {
          if (b.__wired) return;
          if (b.textContent.includes("Imprimir fechamento")) {
            b.__wired = true;
            b.onclick = () => window.__openRecibo?.();
          }
        });
      }

      // Notificações — linhas clicáveis
      if (hash === "/notificacoes") {
        document.querySelectorAll(".b3-card > div[style*='grid']").forEach(row => {
          if (row.__wired) return;
          row.__wired = true;
          row.onclick = () => {
            const title = row.querySelector("div[style*='font-weight: 700'], div[style*='fontWeight: 700']")?.textContent || "";
            row.style.background = "transparent";
            const dot = row.querySelector("span[style*='width: 8px']");
            if (dot) dot.remove();
            if (title.includes("WhatsApp") || title.includes("VTR-")) location.hash = "/vendas/pedidos/8042";
            else if (title.includes("Estoque")) location.hash = "/estoque";
            else if (title.includes("Promo")) location.hash = "/promocoes/cupons";
            else if (title.includes("clientes")) location.hash = "/clientes";
            else if (title.includes("Venda")) location.hash = "/vendas/caixa";
          };
        });
        // "Marcar todas como lidas"
        document.querySelectorAll(".b3-page-hd .b3-btn").forEach(b => {
          if (b.__wired) return;
          if (b.textContent.includes("Marcar todas")) {
            b.__wired = true;
            b.onclick = () => {
              document.querySelectorAll(".b3-card > div[style*='grid']").forEach(row => {
                row.style.background = "transparent";
                row.querySelector("span[style*='width: 8px']")?.remove();
              });
              window.__toast?.({ tone: "ok", t: "Marcado como lido", b: "Todas as notificações foram lidas" });
            };
          }
        });
      }

      // Atributos rows — todos os 4 atributos
      if (hash === "/produtos/atributos") {
        document.querySelectorAll(".b3-tbl tbody tr").forEach((tr, i) => {
          if (tr.__wired) return;
          tr.__wired = true;
          tr.style.cursor = "pointer";
          tr.onclick = (e) => {
            if (e.target.closest("input,button")) return;
            location.hash = "/produtos/atributos/tamanho"; // todos vão pro mesmo detalhe genérico
          };
        });
      }
    }
    wire();
    const obs = new MutationObserver(() => wire());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}

// ───── PEDIDO IMPRESSO direto · helper (recibo de balcão usado em vários lugares) ─────
window.__toast = window.__toast || (() => {}); // placeholder, set by host

Object.assign(window, {
  B3UserMenu, B3QuickActions, B3SearchDropdown, B3GlobalWiring,
});
