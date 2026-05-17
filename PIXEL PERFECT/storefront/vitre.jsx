// =========================================================
// VITRÊ STOREFRONT — fiel ao canvas-v1 do repo Vitrê
// =========================================================
// Recreated from: src/components/storefront/* + src/app/(storefront)/*
// Pixel-faithful: hero variants, product card overlay, bottom-nav pill,
// PDP com sticky CTA, sacola checkout completo.
// =========================================================

const VT_STORE = {
  slug: "sandra-brito-collection",
  name: "Sandra Brito Collection",
  handle: "sandrabrito",
  primaryColor: "#1A3A8F",
  cashDiscountBps: 1000, // 10%
  paymentMethodsNote: "Aceitamos PIX, dinheiro, cartão de débito e crédito em até 6× sem juros.",
};

const VT_CATEGORIES = [
  { id: "c1", slug: "vestidos",   name: "Vestidos",   seed: "VS" },
  { id: "c2", slug: "blusas",     name: "Blusas",     seed: "BL" },
  { id: "c3", slug: "blazers",    name: "Blazers",    seed: "BZ" },
  { id: "c4", slug: "saias",      name: "Saias",      seed: "SA" },
  { id: "c5", slug: "calcas",     name: "Calças",     seed: "CL" },
  { id: "c6", slug: "acessorios", name: "Acessórios", seed: "AC" },
];

const VT_PRODUCTS = [
  { id: "p1", sku: "VST-AZ",  slug: "vestido-midi-azul-royal", name: "Vestido midi azul royal",    cat: "Vestidos", price: 18900, promo: null,  promoEndsAt: null, isFeatured: true,  seed: "VS1", stock: 6  },
  { id: "p2", sku: "BL-VRD",  slug: "blazer-verde-salvia",     name: "Blazer verde sálvia",         cat: "Blazers",  price: 24900, promo: 19900, promoEndsAt: "31 mai", isFeatured: false, seed: "BV2", stock: 7  },
  { id: "p3", sku: "SAI-BR",  slug: "saia-plissada-bege",      name: "Saia plissada bege",          cat: "Saias",    price: 12900, promo: null,  promoEndsAt: null, isFeatured: false, seed: "SB3", stock: 8  },
  { id: "p4", sku: "BRC-DR",  slug: "brinco-gota-dourado",     name: "Brinco gota dourado",          cat: "Acessórios", price: 4000, promo: null, promoEndsAt: null, isFeatured: false, seed: "BD4", stock: 12 },
  { id: "p5", sku: "BLS-CRM", slug: "blusa-cropped-creme",     name: "Blusa cropped creme",          cat: "Blusas",   price: 8900,  promo: 6900,  promoEndsAt: "31 mai", isFeatured: false, seed: "BC5", stock: 4  },
  { id: "p6", sku: "CJ-LNHO", slug: "conjunto-crop-linho",     name: "Conjunto crop linho off",      cat: "Conjuntos", price: 28900, promo: null, promoEndsAt: null, isFeatured: true,  seed: "CL6", stock: 5  },
  { id: "p7", sku: "CMS-BR",  slug: "camisa-oversized-branca", name: "Camisa oversized branca",      cat: "Camisas",  price: 11900, promo: null,  promoEndsAt: null, isFeatured: false, seed: "CB7", stock: 11 },
  { id: "p8", sku: "CL-VLD",  slug: "calca-wide-leg-veludo",   name: "Calça wide leg veludo",        cat: "Calças",   price: 16900, promo: null,  promoEndsAt: null, isFeatured: true,  seed: "CW8", stock: 6  },
];

const fmtBRL = (cents) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Color seed for product image placeholder
function vtSeedGrad(seed) {
  const palette = [
    "linear-gradient(135deg, #1A3A8F, #3F60C2)",
    "linear-gradient(135deg, #0F6E3F, #2E8C5E)",
    "linear-gradient(135deg, #92580C, #B6731F)",
    "linear-gradient(135deg, #6B2A8C, #8A47AC)",
    "linear-gradient(135deg, #A4231E, #C24238)",
    "linear-gradient(135deg, #1F6F75, #3A8B92)",
    "linear-gradient(135deg, #374151, #56616F)",
    "linear-gradient(135deg, #0F4D4F, #2A6F71)",
  ];
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function VtImage({ seed, gradient }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: gradient || vtSeedGrad(seed),
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 28, fontWeight: 600,
        color: "rgba(255,255,255,0.4)",
        letterSpacing: "-0.04em",
      }}>{seed}</span>
    </div>
  );
}

// ───────── MOBILE STATUS BAR ─────────
function VtStatus() {
  return (
    <div className="vt-mob-status">
      <span>9:41</span>
      <span style={{ width: 92, height: 28, background: "var(--fg)", borderRadius: 999 }}></span>
      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        <svg width="16" height="10" viewBox="0 0 16 10"><path d="M1 6h2v3H1zM5 4h2v5H5zM9 2h2v7H9zM13 0h2v9h-2z" fill="currentColor"/></svg>
        <span style={{ fontSize: 10, fontWeight: 700 }}>100</span>
      </span>
    </div>
  );
}

// ───────── HOME ─────────
function VtHomeScreen() {
  return (
    <div className="vt vt-mob">
      <VtStatus />
      <div className="vt-hdr-home">
        <div className="store-mark">S</div>
        <div className="store-text">
          <span className="store-name">{VT_STORE.name}</span>
          <span className="store-handle">@{VT_STORE.handle}</span>
        </div>
        <button className="vt-hdr-icbtn"><IcSearch size={16} /></button>
        <button className="vt-hdr-icbtn">
          <IcCart size={16} />
          <span className="badge">3</span>
        </button>
      </div>

      <div style={{ paddingBottom: 100 }}>
        {/* Hero banner */}
        <div className="vt-hero">
          <div className="vt-hero-cover">
            <VtImage seed="hero" />
            <span className="vt-hero-kicker">★ COLEÇÃO OUTONO 26</span>
            <h1 className="vt-hero-title">Tons que aquecem a estação</h1>
            <p className="vt-hero-sub">Linho, veludo e malha · novidades em pré-venda</p>
            <span className="vt-hero-cta">Explorar →</span>
          </div>
        </div>

        {/* Categorias */}
        <div className="vt-section">
          <div className="vt-section-hd">
            <h2 className="vt-section-h">Categorias</h2>
          </div>
        </div>
        <div className="vt-cat-strip">
          {VT_CATEGORIES.map(c => (
            <div key={c.id} className="vt-cat-tile">
              <div className="vt-cat-tile-img"><VtImage seed={c.seed} /></div>
              <span className="vt-cat-tile-name">{c.name}</span>
            </div>
          ))}
        </div>

        {/* Em destaque */}
        <div className="vt-section">
          <div className="vt-section-hd">
            <h2 className="vt-section-h">Em destaque</h2>
            <a className="vt-section-seeall">Ver todos <IcChevR size={11} /></a>
          </div>
        </div>
        <div className="vt-grid">
          {VT_PRODUCTS.slice(0, 4).map(p => <VtProductCard key={p.id} p={p} />)}
        </div>

        {/* Promo strip */}
        <div className="vt-promo">
          <div className="vt-promo-ico"><IcSparkle size={16} /></div>
          <div className="vt-promo-text">
            <b>5 produtos em promoção</b>
            <span>Termina em 14 dias · até 30% OFF</span>
          </div>
          <IcChevR size={14} style={{ color: "var(--gray-500)" }} />
        </div>

        {/* Mais produtos */}
        <div className="vt-grid">
          {VT_PRODUCTS.slice(4, 8).map(p => <VtProductCard key={p.id} p={p} />)}
        </div>
      </div>

      <VtBottomNav active="home" />
    </div>
  );
}

function VtProductCard({ p }) {
  const isPromo = !!p.promo;
  const isNew = p.isFeatured && !isPromo;
  return (
    <div className="vt-card">
      <div className="vt-card-img">
        <div className="vt-card-img-inner"><VtImage seed={p.seed} /></div>
        {isPromo && <span className="vt-card-tag promo">PROMO</span>}
        {isNew   && <span className="vt-card-tag">NOVO</span>}
        <button className="vt-card-fav"><IcStar size={13} /></button>
      </div>
      <h3 className="vt-card-name">{p.name}</h3>
      <div className="vt-card-price">
        <span className="now">{fmtBRL(p.promo || p.price)}</span>
        {isPromo && <span className="was">{fmtBRL(p.price)}</span>}
      </div>
    </div>
  );
}

// ───────── BOTTOM NAV (pill variant) ─────────
function VtBottomNav({ active }) {
  const items = [
    { k: "home", ico: "IcDashboard", label: "Início" },
    { k: "cat",  ico: "IcGrid",      label: "Categorias" },
    { k: "fav",  ico: "IcStar",      label: "Favoritos" },
    { k: "srch", ico: "IcSearch",    label: "Buscar" },
    { k: "bag",  ico: "IcCart",      label: "Sacola", badge: 3 },
  ];
  return (
    <nav className="vt-bnav">
      {items.map(it => {
        const Ic = window[it.ico] || window.IcDashboard;
        return (
          <button key={it.k} className={`vt-bnav-i${active === it.k ? " vt-bnav-i--on" : ""}`}>
            <span className="vt-bnav-pill">
              <Ic size={18} />
              {it.badge && active !== "bag" && <span className="vt-bnav-badge">{it.badge}</span>}
            </span>
            <span className="vt-bnav-l">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ───────── PDP ─────────
function VtPDPScreen() {
  return (
    <div className="vt vt-mob">
      <VtStatus />

      <div style={{ position: "relative" }}>
        <div className="vt-pdp-gallery">
          <div className="vt-pdp-gallery-img">
            <VtImage seed="VS1-MAIN" />
          </div>
        </div>
        <div className="vt-hdr-pdp">
          <button><IcChevL size={16} /></button>
          <button><IcSearch size={16} /></button>
        </div>
      </div>

      <div className="vt-pdp-thumbs">
        {[1,2,3,4].map(i => (
          <div key={i} className="vt-pdp-thumb" data-active={i === 1}>
            <VtImage seed={`vs1-${i}`} />
          </div>
        ))}
      </div>

      <div style={{ paddingBottom: 160 }}>
        <div className="vt-pdp-meta">
          <h1 className="vt-pdp-h">Vestido midi azul royal</h1>
          <div className="vt-pdp-price-row">
            <span className="vt-pdp-price">R$ 170,10</span>
            <span className="vt-pdp-was">R$ 189,00</span>
            <span className="vt-pdp-disc">−10%</span>
          </div>
          <div className="vt-pdp-parc">ou 3× de R$ 56,70 sem juros</div>
          <div className="vt-pdp-cash">R$ 153,09 no PIX (10% OFF)</div>
        </div>

        <div className="vt-pdp-section">
          <div className="vt-pdp-section-label">Tamanho</div>
          <div className="vt-pdp-sizes">
            <button className="vt-pdp-size">PP</button>
            <button className="vt-pdp-size" data-state="out">P</button>
            <button className="vt-pdp-size" data-state="on">M</button>
            <button className="vt-pdp-size">G</button>
            <button className="vt-pdp-size" data-state="out">GG</button>
          </div>
        </div>

        <div className="vt-pdp-section">
          <div className="vt-pdp-section-label">Cor — Azul royal</div>
          <div className="vt-pdp-colors">
            <button className="vt-pdp-color" data-state="on" style={{ background: "#1A3A8F" }}></button>
            <button className="vt-pdp-color" style={{ background: "#0A0A0A" }}></button>
            <button className="vt-pdp-color" style={{ background: "#A4231E" }}></button>
          </div>
        </div>

        <div className="vt-pdp-section">
          <div className="vt-pdp-section-label">Descrição</div>
          <p style={{ fontSize: 12, color: "var(--gray-700)", lineHeight: 1.55, margin: 0 }}>
            Vestido midi em tecido leve com caimento fluido. Manga curta, gola em V profundo, com cinto removível em tom da peça. Modelagem evasê, perfeito pra ocasiões diurnas e noturnas.
          </p>
        </div>

        <div className="vt-pdp-meta-grid">
          <div className="vt-pdp-meta-item">
            <div className="label">COMPOSIÇÃO</div>
            <div className="value">65% poliéster · 30% viscose</div>
          </div>
          <div className="vt-pdp-meta-item">
            <div className="label">MODELAGEM</div>
            <div className="value">Evasê midi</div>
          </div>
          <div className="vt-pdp-meta-item">
            <div className="label">FORRO</div>
            <div className="value">100% poliéster</div>
          </div>
          <div className="vt-pdp-meta-item">
            <div className="label">LAVAGEM</div>
            <div className="value">À mão · sem alvejante</div>
          </div>
        </div>

        <div className="vt-pdp-trust">
          <div className="vt-pdp-trust-row">
            <IcTruck size={16} />
            <div>
              <b>Entrega ou retirada</b>
              <span>Combine direto com a loja.</span>
            </div>
          </div>
          <div className="vt-pdp-trust-row">
            <IcPayment size={16} />
            <div>
              <b>Pagamento combinado</b>
              <span>Sem cobrança pelo site.</span>
            </div>
          </div>
          <div className="vt-pdp-trust-row">
            <IcWhatsApp size={16} />
            <div>
              <b>Atendimento no WhatsApp</b>
              <span>Tire dúvidas antes de finalizar.</span>
            </div>
          </div>
        </div>

        <div style={{ margin: "12px 16px 0", padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600 }}>Como pagar</div>
          <p style={{ fontSize: 11, color: "var(--gray-500)", margin: "4px 0 0", lineHeight: 1.4 }}>
            {VT_STORE.paymentMethodsNote}
          </p>
        </div>
      </div>

      <div className="vt-pdp-cta">
        <div className="vt-pdp-cta-row">
          <button className="vt-pdp-heart"><IcStar size={18} /></button>
          <button className="vt-pdp-add">Adicionar à sacola · R$ 170,10</button>
        </div>
        <button className="vt-pdp-continue">Adicionar e voltar pra loja</button>
      </div>
    </div>
  );
}

// ───────── SACOLA ─────────
const SACOLA_ITEMS = [
  { id: "i1", sku: "VST-AZ-M", name: "Vestido midi azul royal · M",  qty: 1, price: 17010, hint: "Entrega, retirada e pagamento são combinados pelo WhatsApp.", seed: "VS1" },
  { id: "i2", sku: "BL-VRD-G", name: "Blazer verde sálvia · G",       qty: 1, price: 19900, hint: "Entrega, retirada e pagamento são combinados pelo WhatsApp.", seed: "BV2" },
  { id: "i3", sku: "BRC-DR-U", name: "Brinco gota dourado · Único",   qty: 2, price: 4000,  hint: "Entrega, retirada e pagamento são combinados pelo WhatsApp.", seed: "BD4" },
];

function VtSacolaScreen() {
  const subtotal = SACOLA_ITEMS.reduce((s, i) => s + i.qty * i.price, 0);
  return (
    <div className="vt vt-mob">
      <VtStatus />
      <div className="vt-hdr-sticky">
        <button className="vt-hdr-back"><IcChevL size={16} /></button>
        <span className="vt-hdr-title">Sua sacola</span>
      </div>

      <div className="vt-sacola">
        <div className="vt-sacola-list">
          {SACOLA_ITEMS.map(it => (
            <div key={it.id} className="vt-sacola-row">
              <div className="vt-sacola-img"><VtImage seed={it.seed} /></div>
              <div className="vt-sacola-meta">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="vt-sacola-id">{it.sku.slice(0, 8)}</span>
                    <div className="vt-sacola-name">{it.name}</div>
                    <div className="vt-sacola-hint">{it.hint}</div>
                  </div>
                  <button className="vt-sacola-remove"><IcTrash size={14} /></button>
                </div>
                <div className="vt-sacola-bottom">
                  <div className="vt-stepper">
                    <button><IcMinus size={11} /></button>
                    <span className="vt-stepper-val">{it.qty}</span>
                    <button><IcPlus size={11} /></button>
                  </div>
                  <span className="vt-sacola-total">{fmtBRL(it.qty * it.price)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="vt-form-section">
          <div className="vt-form-label">SEUS DADOS</div>
          <div className="vt-field">
            <label className="label">Nome completo<span className="req">*</span></label>
            <input className="vt-input" placeholder="Como devemos te chamar?" />
          </div>
          <div className="vt-field">
            <label className="label">WhatsApp<span className="req">*</span></label>
            <input className="vt-input mono" placeholder="+55 99 99182-4001" />
          </div>
          <div className="vt-field">
            <label className="label">Observações</label>
            <textarea className="vt-input vt-textarea" placeholder="Ex.: pode entregar na portaria a partir de 14h"></textarea>
            <div className="hint">Tamanho, cor, horário de entrega — opcional</div>
          </div>
        </div>

        <div className="vt-totals">
          <div className="vt-totals-row">
            <span className="label">Subtotal</span>
            <span className="value">{fmtBRL(subtotal)}</span>
          </div>
          <div className="vt-totals-row">
            <span className="label">Frete</span>
            <span className="value">A combinar</span>
          </div>
          <div className="vt-totals-hr"></div>
          <div className="vt-totals-total">
            <span className="label">Total</span>
            <span className="value">{fmtBRL(subtotal)}</span>
          </div>
        </div>

        <div className="vt-notice">
          O pedido é finalizado pelo WhatsApp da loja. Frete e formas de pagamento são combinados diretamente com Sandra.
        </div>
      </div>

      <div className="vt-cta-fixed">
        <button className="vt-wa-btn">
          <IcWhatsApp size={18} />
          Finalizar no WhatsApp
        </button>
      </div>
    </div>
  );
}

// ───────── SUCESSO ─────────
function VtSucessoScreen() {
  return (
    <div className="vt vt-mob">
      <VtStatus />
      <div className="vt-hdr-sticky">
        <button className="vt-hdr-back"><IcChevL size={16} /></button>
        <span className="vt-hdr-title">Pedido recebido</span>
      </div>

      <div className="vt-sucesso">
        <div className="vt-sucesso-ico">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div className="vt-sucesso-kicker">PEDIDO ENVIADO</div>
        <h1 className="vt-sucesso-h">Obrigada, Maria!</h1>
        <p className="vt-sucesso-sub">
          Sandra acabou de receber seu pedido no WhatsApp. Em alguns minutos ela te chama pra combinar a entrega.
        </p>

        <div className="vt-sucesso-card">
          <div className="vt-sucesso-kv"><span className="k">Número do pedido</span><span className="v" style={{ color: "var(--brand-store)", fontWeight: 600 }}>VTR-8042</span></div>
          <div className="vt-sucesso-kv"><span className="k">Data</span><span className="v">17 mai · 14:08</span></div>
          <div className="vt-sucesso-kv"><span className="k">Itens</span><span className="v">3</span></div>
          <div className="vt-sucesso-kv"><span className="k">Total</span><span className="v" style={{ fontWeight: 700, fontSize: 14 }}>R$ 44.910</span></div>
        </div>

        <button className="vt-wa-btn" style={{ marginTop: 12 }}>
          <IcWhatsApp size={18} />
          Abrir conversa com Sandra
        </button>

        <button style={{ marginTop: 12, height: 40, width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          Continuar comprando
        </button>

        <div style={{ marginTop: 28, padding: 16, background: "var(--bg-muted)", borderRadius: 12, textAlign: "left" }}>
          <div className="vt-form-label" style={{ color: "var(--brand-store)" }}>★ DICA</div>
          <div style={{ fontSize: 12.5, color: "var(--gray-700)", lineHeight: 1.55 }}>
            Salve nosso WhatsApp como <b>"Sandra Brito · Loja"</b> e me siga em @sandrabrito.colection pra ver as novidades antes ✿
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── CATEGORIA ─────────
function VtCategoriaScreen() {
  const items = VT_PRODUCTS;
  return (
    <div className="vt vt-mob">
      <VtStatus />
      <div className="vt-cat-page-hd">
        <button className="vt-hdr-back"><IcChevL size={16} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="kicker">CATEGORIA</span>
          <span className="title">Vestidos</span>
        </div>
        <span className="vt-hdr-counter">14 PEÇAS</span>
      </div>

      <div style={{ paddingBottom: 100 }}>
        <div style={{ display: "flex", gap: 6, padding: "12px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
          {["Todos", "Midi", "Curto", "Longo", "Festa"].map((c, i) => (
            <span key={c} style={{
              padding: "6px 14px",
              background: i === 0 ? "var(--fg)" : "var(--bg)",
              color: i === 0 ? "var(--bg)" : "var(--fg)",
              border: `1px solid ${i === 0 ? "var(--fg)" : "var(--border)"}`,
              borderRadius: 999,
              fontSize: 12, fontWeight: 500,
              whiteSpace: "nowrap",
              cursor: "pointer", flexShrink: 0,
            }}>{c}</span>
          ))}
        </div>

        <div className="vt-grid">
          {items.map(p => <VtProductCard key={p.id} p={p} />)}
        </div>
      </div>

      <VtBottomNav active="cat" />
    </div>
  );
}

// ───────── BUSCAR ─────────
function VtBuscarScreen() {
  return (
    <div className="vt vt-mob">
      <VtStatus />
      <div className="vt-search-bar">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="vt-hdr-back" style={{ width: 32, height: 32 }}><IcChevL size={14} /></button>
          <div className="vt-search-input-wrap" style={{ flex: 1 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--gray-500)" }}><IcSearch size={16} /></span>
            <input placeholder="Buscar produtos…" defaultValue="vestido azul" />
          </div>
        </div>
      </div>

      <div style={{ paddingBottom: 100 }}>
        <div style={{ padding: "12px 16px 6px" }}>
          <span className="vt-form-label">RESULTADOS · 12 PRODUTOS</span>
        </div>
        <div className="vt-grid">
          {VT_PRODUCTS.slice(0, 6).map(p => <VtProductCard key={p.id} p={p} />)}
        </div>

        <div style={{ padding: "20px 16px 8px" }}>
          <span className="vt-form-label">BUSCAS POPULARES</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px" }}>
          {["vestido midi", "blazer", "joia dourada", "linho", "preto", "festa", "promoção"].map(t => (
            <span key={t} style={{ padding: "6px 12px", background: "var(--muted)", borderRadius: 999, fontSize: 12 }}>{t}</span>
          ))}
        </div>
      </div>

      <VtBottomNav active="srch" />
    </div>
  );
}

// ───────── DESKTOP HOME ─────────
function VtDesktopHomeScreen() {
  return (
    <div className="vt vt-desk">
      <header className="vt-desk-hdr">
        <div className="vt-desk-hdr-inner">
          <a className="vt-desk-logo">
            <span className="vt-desk-logo-mark">S</span>
            <span className="vt-desk-logo-name">{VT_STORE.name}</span>
          </a>
          <nav className="vt-desk-nav">
            <a data-active="true">Início</a>
            <a>Vestidos</a>
            <a>Blusas</a>
            <a>Acessórios</a>
            <a>Sobre</a>
          </nav>
          <div className="vt-desk-actions">
            <button className="vt-desk-icbtn"><IcSearch size={18} /></button>
            <button className="vt-desk-icbtn"><IcStar size={18} /></button>
            <button className="vt-desk-icbtn">
              <IcCart size={18} />
              <span className="badge">3</span>
            </button>
          </div>
        </div>
      </header>

      <div className="vt-desk-content">
        <div className="vt-desk-hero">
          <VtImage seed="hero-desk" />
          <div style={{ position: "absolute", inset: 0, padding: 48, color: "white", display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.5))" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", opacity: 0.9, marginBottom: 8 }}>★ COLEÇÃO OUTONO 26</span>
            <h1 style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.05, margin: 0, maxWidth: 480 }}>Tons que aquecem<br/>a estação.</h1>
            <p style={{ fontSize: 14, opacity: 0.9, marginTop: 8, maxWidth: 420 }}>Linho, veludo e malha · novidades exclusivas em pré-venda</p>
            <button style={{ marginTop: 14, height: 44, padding: "0 24px", background: "white", color: "var(--fg)", border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", width: "fit-content" }}>Explorar coleção →</button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Em destaque</h2>
          <a style={{ fontSize: 13, fontWeight: 500, color: "var(--brand-store)", textDecoration: "none", cursor: "pointer" }}>Ver todos →</a>
        </div>
        <div className="vt-desk-grid">
          {VT_PRODUCTS.slice(0, 4).map(p => <VtProductCard key={p.id} p={p} />)}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "40px 0 16px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Chegou agora</h2>
          <a style={{ fontSize: 13, fontWeight: 500, color: "var(--brand-store)", textDecoration: "none", cursor: "pointer" }}>Ver novidades →</a>
        </div>
        <div className="vt-desk-grid">
          {VT_PRODUCTS.slice(4, 8).map(p => <VtProductCard key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  );
}

// Ícone IcTruck e IcMinus fallback
if (!window.IcTruck) window.IcTruck = (p) => <svg {...p} width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
if (!window.IcMinus) window.IcMinus = (p) => <svg {...p} width={p.size || 16} height={p.size || 16} viewBox="0 0 16 16" fill="currentColor"><path d="M4 8a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 4 8Z"/></svg>;

Object.assign(window, {
  VtHomeScreen, VtPDPScreen, VtSacolaScreen, VtSucessoScreen,
  VtCategoriaScreen, VtBuscarScreen, VtDesktopHomeScreen,
  VtProductCard, VtBottomNav, VtImage,
  VT_STORE, VT_PRODUCTS, VT_CATEGORIES,
});
