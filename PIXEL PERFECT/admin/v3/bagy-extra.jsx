// =========================================================
// DUBLIN V3 — Extra screens (Dashboard, Pedidos, Produtos, Categorias,
// Atributos, Promoções, Marketing, Relatórios, Loja virtual, Pagamentos,
// Configurações)
// =========================================================

function B3Shell({ active, sub, children }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return (
    <div className={`b3 b3-shell${mobileOpen ? " b3-side-open" : ""}`}>
      <div className="b3-overlay-side" onClick={() => setMobileOpen(false)}></div>
      <B3Sidebar active={active} sub={sub} />
      <div className="b3-main">
        <div className="b3-top">
          <button className="b3-side-toggle" onClick={() => setMobileOpen(true)}><IcMenu size={18} /></button>
          <div className="b3-search">
            <IcSearch size={15} />
            <input placeholder="Buscar clientes, produtos, pedidos…" />
          </div>
          <div style={{ flex: 1 }}></div>
          <button className="b3-top-icbtn"><IcBolt size={16} /></button>
          <button className="b3-top-icbtn" onClick={() => location.hash = "/notificacoes"}><IcBell size={16} /><span className="ndot"></span></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ───────── DASHBOARD ─────────
function B3DashboardScreen() {
  const series = [0,1,0,2,1,0,1.5,1,0,2,1,0.5,2.5,0.7,0,1.5];
  const max = Math.max(...series, 1);
  return (
    <B3Shell active="dashboard">
      <div className="b3-page">
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", margin: "0 0 24px" }}>Olá, Sandra Brito!</h1>

        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em", margin: "0 0 14px" }}>Acesso rápido</h2>
        <div className="b3-qa-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 28 }}>
          <div className="b3-qa" onClick={() => window.open("#/loja-virtual", "_self")}>
            <IcAppearance size={18} />
            <div className="b3-qa-title">Visitar minha loja</div>
            <span className="b3-qa-link">Acessar</span>
          </div>
          <div className="b3-qa" onClick={() => location.hash = "/suporte"}>
            <IcInfo size={18} />
            <div className="b3-qa-title">Minha central de ajuda</div>
            <span className="b3-qa-link">Acessar</span>
          </div>
          <div className="b3-qa b3-qa--cta" onClick={() => location.hash = "/assinatura"}>
            <IcStar size={18} />
            <div className="b3-qa-title">Evoluir<br/>meu plano</div>
          </div>
        </div>

        <div className="b3-card" style={{ overflow: "hidden", marginBottom: 16 }}>
          <div className="b3-card-hd">
            <h3>Total de vendas</h3>
            <select className="b3-select" style={{ width: 140, height: 32, fontSize: 12.5 }}>
              <option>Últimos 7 dias</option>
              <option>Últimos 30 dias</option>
              <option>Últimos 90 dias</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 0 }}>
            <div style={{ padding: 20 }}>
              <svg width="100%" height="240" viewBox="0 0 600 240" preserveAspectRatio="none">
                {[0.2, 0.4, 0.6, 0.8].map((y, i) => (
                  <line key={i} x1="0" x2="600" y1={240 * y} y2={240 * y} stroke="#E8EAEE" strokeDasharray="2 2" />
                ))}
                <path d={series.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (series.length - 1)) * 600} ${240 - (v / max) * 200 - 20}`).join(" ")}
                  stroke="#1A3A8F" strokeWidth="2.5" fill="none" />
                <path d={`M 0 220 ${series.map((v, i) => `L ${(i / (series.length - 1)) * 600} ${240 - (v / max) * 200 - 20}`).join(" ")} L 600 220 Z`}
                  fill="rgba(26,58,143,0.08)" />
              </svg>
            </div>
            <div style={{ padding: 20, borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { l: "TOTAL DE PEDIDOS", v: "0 · R$ 0,00", pct: null, color: "var(--ink-3)" },
                { l: "APROVADOS",         v: "0 · R$ 0,00", pct: "0%",  color: "var(--ok)" },
                { l: "PENDENTES",         v: "0 · R$ 0,00", pct: "0%",  color: "var(--warn)" },
                { l: "CANCELADOS",        v: "0 · R$ 0,00", pct: "0%",  color: "var(--danger)" },
                { l: "EXPIRADOS",         v: "0 · R$ 0,00", pct: "0%",  color: "var(--ink-4)" },
              ].map(s => (
                <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="b3-stat-circle" style={{ color: s.color, borderColor: s.color }}>
                    {s.pct || <IcArchive size={12} />}
                  </span>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)" }}>{s.l}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{s.v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── PEDIDOS LISTA ─────────
function B3PedidosScreen() {
  const pedidos = [
    { id: "VTR-8042", cliente: "Maria Eduarda Silva", canal: "WhatsApp", pay: "PIX", itens: 3, total: 47800, status: "warn", label: "Aguardando", date: "16 mai · 14:08" },
    { id: "VTR-8041", cliente: "Júlio César",          canal: "WhatsApp", pay: "PIX", itens: 1, total: 12900, status: "warn", label: "Aguardando", date: "16 mai · 13:54" },
    { id: "BLC-219",  cliente: "Anônimo (Balcão)",     canal: "Balcão",   pay: "PIX", itens: 2, total: 34800, status: "ok",   label: "Entregue",   date: "16 mai · 13:42" },
    { id: "VTR-8040", cliente: "Larissa Brito",         canal: "WhatsApp", pay: "—",   itens: 5, total: 89500, status: "warn", label: "Aguardando", date: "16 mai · 13:30" },
    { id: "BLC-218",  cliente: "Patrícia Mendes",       canal: "Balcão",   pay: "Crédito", itens: 1, total: 18900, status: "ok", label: "Entregue", date: "16 mai · 12:48" },
    { id: "VTR-8038", cliente: "Camila Rodrigues",      canal: "WhatsApp", pay: "PIX", itens: 4, total: 62400, status: "brand", label: "Confirmado", date: "16 mai · 11:32" },
    { id: "VTR-8037", cliente: "Beatriz Almeida",       canal: "WhatsApp", pay: "Dinheiro", itens: 2, total: 28400, status: "ok", label: "Entregue", date: "16 mai · 10:58" },
    { id: "VTR-8036", cliente: "Aline Souza",           canal: "WhatsApp", pay: "—",   itens: 1, total: 8900,  status: "danger", label: "Cancelado", date: "16 mai · 09:18" },
  ];
  return (
    <B3Shell active="pedidos">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Pedidos</h1>
          <button className="b3-btn b3-btn--cta"><IcPlus size={14} /> Pedido manual</button>
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <div className="b3-tabs">
            <span className="b3-tab" data-active="true">Todos · 312</span>
            <span className="b3-tab">Aguardando · 4</span>
            <span className="b3-tab">Confirmados · 12</span>
            <span className="b3-tab">Entregues · 280</span>
            <span className="b3-tab">Cancelados · 5</span>
          </div>
          <div className="b3-toolbar">
            <input type="checkbox" />
            <div className="b3-toolbar-search">
              <IcSearch size={14} />
              <input placeholder="Procurar por código, cliente, telefone…" />
            </div>
            <button className="b3-btn b3-btn--sm"><IcCalendar size={13} /> Hoje</button>
            <button className="b3-btn b3-btn--sm"><IcFilter size={13} /> Filtros</button>
            <div style={{ flex: 1 }}></div>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>1 – 8 de 312</span>
          </div>
          <table className="b3-tbl">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20, width: 28 }}></th>
                <th>CÓDIGO</th>
                <th>CLIENTE</th>
                <th>CANAL</th>
                <th>PAGAMENTO</th>
                <th style={{ textAlign: "right" }}>ITENS</th>
                <th style={{ textAlign: "right" }}>TOTAL</th>
                <th>STATUS</th>
                <th>DATA</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map(p => (
                <tr key={p.id}>
                  <td style={{ paddingLeft: 20 }}><input type="checkbox" /></td>
                  <td className="mono" style={{ color: "var(--brand)", fontWeight: 600 }}>{p.id}</td>
                  <td>{p.cliente}</td>
                  <td>
                    {p.canal === "WhatsApp"
                      ? <span className="b3-pill" style={{ color: "var(--ok)" }}><IcWhatsApp size={11} /> WhatsApp</span>
                      : <span className="b3-pill">🛍️ Balcão</span>}
                  </td>
                  <td><span className="b3-pill">{p.pay}</span></td>
                  <td className="mono" style={{ textAlign: "right" }}>{p.itens}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>R$ {(p.total/100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td><span className={`b3-pill b3-pill--${p.status}`}>{p.label}</span></td>
                  <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── PRODUTOS LISTA ─────────
const B3_PRODUTOS = [
  { id: 1, name: "Vestido midi azul royal",  cat: "Vestidos",   sku: "VST-AZ", price: 18900, stock: 6,  status: "Publicado", img: "VS" },
  { id: 2, name: "Blazer verde sálvia",       cat: "Blazers",    sku: "BL-VRD", price: 24900, stock: 7,  status: "Publicado", img: "BV", promo: 19900 },
  { id: 3, name: "Saia plissada bege",        cat: "Saias",      sku: "SAI-BR", price: 12900, stock: 8,  status: "Publicado", img: "SB" },
  { id: 4, name: "Brinco gota dourado",       cat: "Acessórios", sku: "BRC-DR", price: 4000,  stock: 12, status: "Publicado", img: "BD" },
  { id: 5, name: "Blusa cropped creme",       cat: "Blusas",     sku: "BLS-CRM",price: 8900,  stock: 4,  status: "Publicado", img: "BC", promo: 6900 },
  { id: 6, name: "Conjunto crop linho off",   cat: "Conjuntos",  sku: "CJ-LNHO",price: 28900, stock: 5,  status: "Rascunho",  img: "CL" },
  { id: 7, name: "Camisa oversized branca",   cat: "Camisas",    sku: "CMS-BR", price: 11900, stock: 11, status: "Publicado", img: "CB" },
  { id: 8, name: "Calça wide leg veludo",     cat: "Calças",     sku: "CL-VLD", price: 16900, stock: 6,  status: "Publicado", img: "CW" },
];
function B3ProdutosScreen() {
  return (
    <B3Shell active="produtos" sub="lista">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Meus produtos</h1>
          <button className="b3-btn b3-btn--cta"><IcPlus size={14} /> Adicionar produto</button>
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <div className="b3-helpbar">
            <span className="b3-helpbar-ico"><IcInfo size={14} /></span>
            <span className="b3-helpbar-text">Precisa de ajuda? Assista o vídeo sobre <a>produtos</a></span>
          </div>
          <div className="b3-tabs">
            <span className="b3-tab" data-active="true">Todos · 142</span>
            <span className="b3-tab">Publicados · 128</span>
            <span className="b3-tab">Rascunhos · 9</span>
            <span className="b3-tab">Em promoção · 8</span>
          </div>
          <div className="b3-toolbar">
            <input type="checkbox" />
            <div className="b3-toolbar-search">
              <IcSearch size={14} /><input placeholder="Procurar registros" />
            </div>
            <button className="b3-btn b3-btn--sm"><IcSliders size={13} /> Ordenar</button>
            <button className="b3-btn b3-btn--sm"><IcFilter size={13} /> Filtros</button>
          </div>
          <table className="b3-tbl">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20, width: 28 }}></th>
                <th>FOTO</th>
                <th>NOME</th>
                <th>SKU</th>
                <th>CATEGORIA</th>
                <th style={{ textAlign: "right" }}>ESTOQUE</th>
                <th style={{ textAlign: "right" }}>PREÇO</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {B3_PRODUTOS.map(p => (
                <tr key={p.id}>
                  <td style={{ paddingLeft: 20 }}><input type="checkbox" /></td>
                  <td><span className="b3-avatar" style={{ background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 6 }}>{p.img}</span></td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>{p.sku}</td>
                  <td><span className="b3-pill">{p.cat}</span></td>
                  <td className="mono" style={{ textAlign: "right" }}>{p.stock}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>
                    {p.promo ? (
                      <>
                        R$ {(p.promo/100).toFixed(2).replace(".", ",")}<br/>
                        <small style={{ color: "var(--ink-4)", textDecoration: "line-through", fontSize: 10.5 }}>R$ {(p.price/100).toFixed(2).replace(".", ",")}</small>
                      </>
                    ) : (
                      <>R$ {(p.price/100).toFixed(2).replace(".", ",")}</>
                    )}
                  </td>
                  <td>
                    {p.status === "Publicado" ? <span className="b3-pill b3-pill--ok">● Publicado</span> : <span className="b3-pill b3-pill--warn">● Rascunho</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── CATEGORIAS (tree view, BAGY style) ─────────
function B3CategoriasScreen() {
  const tree = [
    { name: "PRODUTOS", lvl: 1 },
    { name: "BEACHWEAR", lvl: 2 },
    { name: "SUTIÃ",       lvl: 3 },
    { name: "CALCINHA",    lvl: 3 },
    { name: "SAÍDAS DE PRAIA", lvl: 3 },
    { name: "ROUPAS", lvl: 2 },
    { name: "PARTES DE CIMA", lvl: 3 },
    { name: "PARTES DE BAIXO", lvl: 3 },
    { name: "VESTIDOS", lvl: 3 },
    { name: "ACESSÓRIOS", lvl: 3 },
    { name: "MASCULINO", lvl: 3 },
    { name: "QUERIDINHOS", lvl: 2 },
    { name: "LAST CHANCE", lvl: 2 },
    { name: "PERSONALIZE SEU BIQUÍNI", lvl: 2 },
  ];
  return (
    <B3Shell active="produtos" sub="cat">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Categorias</h1>
          <button className="b3-btn b3-btn--cta" onClick={() => location.hash = "/produtos/categorias/nova"}><IcPlus size={14} /> Adicionar categoria</button>
        </div>
        <div className="b3-card">
          <div className="b3-helpbar" style={{ borderRadius: "12px 12px 0 0" }}>
            <span className="b3-helpbar-ico"><IcInfo size={14} /></span>
            <span className="b3-helpbar-text">Precisa de ajuda? Assista o vídeo sobre <a>categorias</a></span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, padding: 24 }}>
            <div>
              <p style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
                As categorias e subcategorias são fundamentais para organizar o seu catálogo de produtos. É possível criar até três níveis de subcategorias.
              </p>
              <p style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6, marginTop: 14 }}>
                Para modificar ou personalizar a hierarquia das categorias, arraste os itens para cima ou para baixo, de acordo com suas necessidades e preferências.
              </p>
            </div>
            <div className="b3-tree">
              {tree.map((t, i) => (
                <div key={i} className={`b3-tree-row b3-tree-l${t.lvl}`}>
                  <span className="b3-tree-grip"><IcDots size={14} /></span>
                  <span className="b3-tree-name" style={{ color: t.lvl === 1 ? "var(--ink-1)" : t.lvl === 2 ? "var(--ink-2)" : "var(--ink-3)" }}>{t.name}</span>
                  <div className="b3-tree-actions">
                    <button>Adicionar</button>
                    <button className="danger">Excluir</button>
                  </div>
                </div>
              ))}
              <button className="b3-btn" style={{ marginTop: 8 }}><IcPlus size={14} /> Adicionar categoria</button>
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── NOVA CATEGORIA ─────────
function B3NovaCategoriaScreen() {
  return (
    <B3Shell active="produtos" sub="cat">
      <div className="b3-page">
        <div className="b3-back-row">
          <button onClick={() => location.hash = "/produtos/categorias"}><IcChevL size={15} /></button>
          <h1>Nova categoria</h1>
        </div>
        <div className="b3-form-grid">
          <div>
            <div className="b3-card b3-card-pad b3-section">
              <h3>Informações básicas</h3>
              <div className="desc">Preencha todos os campos abaixo de forma detalhada.</div>
              <div className="b3-field">
                <label className="b3-field-label">Nome da categoria</label>
                <input className="b3-input" placeholder="Ex: Sapatos" />
              </div>
              <div className="b3-field">
                <label className="b3-field-label">Descrição da categoria (Opcional)</label>
                <div className="b3-rte">
                  <div className="b3-rte-tools">
                    <button>&lt;/&gt;</button>
                    <button style={{ fontWeight: 700 }}>B</button>
                    <button style={{ fontStyle: "italic" }}>I</button>
                    <button>≡</button>
                    <button>🔗</button>
                    <button>🖼️</button>
                  </div>
                  <textarea placeholder="Descreva a categoria…"></textarea>
                </div>
              </div>
            </div>

            <div className="b3-card b3-card-pad">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Produtos</h3>
                <IcChevU size={14} style={{ color: "var(--ink-4)" }} />
              </div>
              <div className="desc">Vincule os seus produtos a esta categoria</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="b3-input" placeholder="Procurar…" style={{ flex: 1 }} />
                <button className="b3-btn b3-btn--cta">Pesquisar</button>
              </div>
            </div>
          </div>

          <div>
            <div className="b3-card b3-card-pad" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Categoria principal</h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 14px", lineHeight: 1.5 }}>
                Para transformar esta categoria em uma subcategoria, selecione uma categoria principal.
              </p>
              <select className="b3-input b3-select">
                <option>Selecione uma categoria</option>
                <option>PRODUTOS</option>
                <option>BEACHWEAR</option>
                <option>ROUPAS</option>
              </select>
            </div>

            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Visibilidade</h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 14px", lineHeight: 1.5 }}>
                Controle onde essa categoria aparece.
              </p>
              <label className="b3-checkbox" style={{ marginBottom: 8 }}>
                <span className="b3-checkbox-box"><IcCheck size={11} /></span>
                <span>Mostrar no menu da loja</span>
              </label>
              <label className="b3-checkbox">
                <span className="b3-checkbox-box"><IcCheck size={11} /></span>
                <span>Disponível no PDV de balcão</span>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button className="b3-btn">Cancelar</button>
          <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Criar categoria</button>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── ATRIBUTOS ─────────
function B3AtributosScreen() {
  return (
    <B3Shell active="produtos" sub="attr">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Atributos</h1>
          <button className="b3-btn b3-btn--cta"><IcPlus size={14} /> Adicionar atributos</button>
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <div className="b3-helpbar"><span className="b3-helpbar-ico"><IcInfo size={14} /></span><span className="b3-helpbar-text">Precisa de ajuda? Assista o vídeo sobre <a>atributos</a></span></div>
          <div className="b3-tabs">
            <span className="b3-tab" data-active="true">Todos</span>
            <span className="b3-tab">despachados</span>
            <span className="b3-tab">Separados</span>
          </div>
          <div className="b3-toolbar">
            <input type="checkbox" />
            <button className="b3-btn b3-btn--ghost b3-btn--sm"><IcRefresh size={14} /></button>
            <div className="b3-toolbar-search"><IcSearch size={14} /><input placeholder="Procurar registros" /></div>
            <button className="b3-btn b3-btn--sm"><IcStar size={13} /> Salvar filtro</button>
          </div>
          <table className="b3-tbl">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20, width: 28 }}></th>
                <th>NOME</th>
                <th>QUANTIDADE DE VALORES</th>
                <th>DATA DA CRIAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Cores",    count: 4, date: "13/03/2024 às 17:10" },
                { name: "Estampas", count: 3, date: "19/11/2023 às 12:10" },
                { name: "Modelo",   count: 2, date: "14/09/2023 às 17:10" },
                { name: "Tamanho",  count: 6, date: "14/09/2023 às 17:10" },
              ].map(a => (
                <tr key={a.name} onClick={() => location.hash = "/produtos/atributos/" + a.name.toLowerCase()}>
                  <td style={{ paddingLeft: 20 }}><input type="checkbox" onClick={(e) => e.stopPropagation()} /></td>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td>{a.count} itens</td>
                  <td className="mono" style={{ color: "var(--ink-4)" }}>{a.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── ATRIBUTO DETALHE ─────────
function B3AtributoDetalheScreen() {
  return (
    <B3Shell active="produtos" sub="attr">
      <div className="b3-page">
        <div className="b3-back-row">
          <button onClick={() => location.hash = "/produtos/atributos"}><IcChevL size={15} /></button>
          <h1>Tamanho</h1>
        </div>
        <div className="b3-form-grid">
          <div>
            <div className="b3-card b3-card-pad b3-section">
              <h3>Informações básicas</h3>
              <div className="desc">Defina um nome para seu atributo. Os mais utilizados aqui são tamanho, numeração, voltagem, sabores, entre outros.</div>
              <div className="b3-field">
                <label className="b3-field-label">Nome do atributo</label>
                <input className="b3-input" defaultValue="Tamanho" />
              </div>
            </div>
            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Valores</h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 14px", lineHeight: 1.5 }}>
                Adicione as variações como P, M e G para especificar os tamanhos do produto ou 110V e 220V para exibir as opções de voltagem disponíveis. Estes itens serão utilizados para criar as variações do seu produto.
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input className="b3-input" placeholder="Ex: GG" style={{ flex: 1 }} />
                <button className="b3-btn b3-btn--cta">Adicionar</button>
              </div>
              {["P", "M", "G", "GG", "PP", "U"].map(v => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--ink-5)", cursor: "grab" }}><IcDots size={14} /></span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{v}</span>
                  <button className="b3-drawer-close"><IcClose size={13} /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="b3-card b3-card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Excluir atributo</h3>
              <button className="b3-drawer-close" style={{ color: "var(--danger)" }}><IcTrash size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── PROMOÇÕES / MARKETING / RELATÓRIOS — placeholder seguindo padrão ─────────
function B3PlaceholderScreen({ active, sub, title, ico, desc }) {
  const Ic = window[ico];
  return (
    <B3Shell active={active} sub={sub}>
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>{title}</h1>
        </div>
        <div className="b3-card b3-card-pad" style={{ padding: 56, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 50, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
            <Ic size={32} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Em construção</h2>
          <p style={{ fontSize: 14, color: "var(--ink-3)", maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.55 }}>{desc}</p>
          <button className="b3-btn b3-btn--cta"><IcPlus size={14} /> Criar primeiro</button>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── LOJA VIRTUAL ─────────
function B3LojaVirtualScreen() {
  return (
    <B3Shell active="lojavirtual">
      <div className="b3-page">
        <div className="b3-page-hd">
          <div>
            <h1>Loja virtual</h1>
            <div className="sub" style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>Personalize como seus clientes veem sua loja</div>
          </div>
          <button className="b3-btn b3-btn--cta"><IcEye size={14} /> Visitar loja</button>
        </div>
        <div className="b3-form-grid">
          <div className="b3-card b3-card-pad">
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Identidade visual</h3>
            <div className="b3-field">
              <label className="b3-field-label">Nome da loja</label>
              <input className="b3-input" defaultValue="Sandra Brito Collection" />
            </div>
            <div className="b3-field">
              <label className="b3-field-label">URL pública</label>
              <input className="b3-input mono" defaultValue="dublin.app/sandra-brito" />
            </div>
            <div className="b3-row2">
              <div className="b3-field">
                <label className="b3-field-label">Logo</label>
                <div style={{ height: 80, background: "var(--bg-app)", border: "1px dashed var(--line-2)", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", color: "var(--ink-4)" }}>
                  <IcUpload size={20} />
                </div>
              </div>
              <div className="b3-field">
                <label className="b3-field-label">Favicon (redondo)</label>
                <div style={{ height: 80, width: 80, background: "var(--brand)", borderRadius: 50, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 32 }}>S</div>
              </div>
            </div>
            <div className="b3-field">
              <label className="b3-field-label">Cor primária</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["#1A3A8F","#0E1129","#0F6E3F","#92580C","#A4231E","#6B2A8C"].map(c => (
                  <button key={c} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: c === "#1A3A8F" ? "2px solid var(--ink-1)" : "1px solid var(--line-2)", cursor: "pointer" }} />
                ))}
              </div>
            </div>
          </div>
          <div className="b3-card b3-card-pad">
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Pré-visualização</h3>
            <div style={{ background: "white", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
              <div style={{ height: 150, background: "linear-gradient(135deg, #1A3A8F, #3F60C2)", display: "flex", alignItems: "flex-end", padding: 14, color: "white" }}>
                <div>
                  <div style={{ fontSize: 9.5, letterSpacing: 0.08, fontWeight: 600 }}>COLEÇÃO OUTONO 26</div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Tons que aquecem</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 10 }}>
                <div style={{ aspectRatio: "3/4", background: "var(--bg-app)", borderRadius: 6 }}></div>
                <div style={{ aspectRatio: "3/4", background: "var(--bg-app)", borderRadius: 6 }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── PAGAMENTOS ─────────
function B3PagamentosScreen() {
  return (
    <B3Shell active="pagamentos">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Pagamentos</h1>
          <button className="b3-btn b3-btn--cta"><IcPlus size={14} /> Novo perfil</button>
        </div>
        <div className="b3-card b3-card-pad" style={{ background: "var(--brand-wash)", border: "1px solid var(--brand-line)", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <IcInfo size={16} style={{ color: "var(--brand)", marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Dublin não processa pagamentos</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>Você combina o pagamento direto com o cliente via WhatsApp ou recebe no balcão.</div>
            </div>
          </div>
        </div>
        <div className="b3-card b3-card-pad">
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Métodos aceitos</h3>
          {[
            { ico: "IcBolt",    name: "PIX",      sub: "Chave: +55 99 98401-3304", on: true },
            { ico: "IcMoney",   name: "Dinheiro", sub: "Pagamento na entrega/retirada", on: true },
            { ico: "IcPayment", name: "Cartão débito", sub: "Maquininha SumUp",  on: true },
            { ico: "IcPayment", name: "Cartão crédito", sub: "Até 6× sem juros · mín R$ 30/parcela", on: true },
            { ico: "IcArchive", name: "Boleto",   sub: "Envie por WhatsApp", on: false },
          ].map((m, i) => {
            const Ic = window[m.ico];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < 4 ? "1px solid var(--line)" : "none" }}>
                <span style={{ width: 40, height: 40, background: m.on ? "var(--brand-wash)" : "var(--bg-app)", color: m.on ? "var(--brand)" : "var(--ink-4)", borderRadius: 50, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic size={16} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>{m.sub}</div>
                </div>
                <span className={`b3-toggle${m.on ? " b3-toggle--on" : ""}`}></span>
              </div>
            );
          })}
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── CONFIGURAÇÕES ─────────
function B3ConfiguracoesScreen() {
  return (
    <B3Shell active="config">
      <div className="b3-page">
        <div className="b3-page-hd">
          <h1>Configurações</h1>
          <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Salvar mudanças</button>
        </div>
        <div className="b3-form-grid">
          <div>
            <div className="b3-card b3-card-pad b3-section">
              <h3>Endereço da loja</h3>
              <div className="desc">Aparece no rodapé do storefront e no recibo</div>
              <div className="b3-row2">
                <div className="b3-field">
                  <label className="b3-field-label">CEP</label>
                  <input className="b3-input mono" defaultValue="65725-000" />
                </div>
                <div className="b3-field">
                  <label className="b3-field-label">UF</label>
                  <input className="b3-input mono" defaultValue="MA" />
                </div>
              </div>
              <div className="b3-field">
                <label className="b3-field-label">Rua</label>
                <input className="b3-input" defaultValue="Rua Coelho Neto, 142 · Centro · Pedreiras" />
              </div>
            </div>
            <div className="b3-card b3-card-pad b3-section">
              <h3>WhatsApp & contato</h3>
              <div className="desc">Como os clientes entram em contato</div>
              <div className="b3-field">
                <label className="b3-field-label">WhatsApp principal</label>
                <input className="b3-input mono" defaultValue="+55 99 98401-3304" />
              </div>
              <div className="b3-field">
                <label className="b3-field-label">Instagram</label>
                <input className="b3-input mono" defaultValue="@sandrabrito.colection" />
              </div>
            </div>
          </div>
          <div>
            <div className="b3-card b3-card-pad" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>Plano</h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 14px" }}>Você está no plano <b>Trial</b> · 14 dias restantes</p>
              <button className="b3-btn b3-btn--cta" style={{ width: "100%" }}>Assinar Pro</button>
            </div>
            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--danger)" }}>Zona de perigo</h3>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 14px" }}>Ações irreversíveis · cuidado</p>
              <button className="b3-btn" style={{ color: "var(--danger)", borderColor: "rgba(185,28,28,0.2)" }}><IcTrash size={13} /> Excluir loja</button>
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

Object.assign(window, {
  B3Shell, B3DashboardScreen, B3PedidosScreen, B3ProdutosScreen,
  B3CategoriasScreen, B3NovaCategoriaScreen, B3AtributosScreen,
  B3AtributoDetalheScreen, B3PlaceholderScreen, B3LojaVirtualScreen,
  B3PagamentosScreen, B3ConfiguracoesScreen,
});
