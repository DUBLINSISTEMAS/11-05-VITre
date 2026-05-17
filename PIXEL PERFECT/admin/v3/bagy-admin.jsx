// =========================================================
// DUBLIN V3 — BAGY-inspired Admin (navy version)
// =========================================================

const B3_NAV_GROUPS = [
  {
    label: "CONTROLE INTERNO",
    items: [
      { k: "dashboard",  ico: "IcDashboard",  label: "Painel" },
      { k: "produtos",   ico: "IcCatalog",    label: "Produtos",
        subs: [
          { k: "lista", label: "Meus produtos" },
          { k: "cat",   label: "Categorias" },
          { k: "attr",  label: "Atributos" },
          { k: "ban",   label: "Banners" },
        ] },
      { k: "estoque",    ico: "IcStock",      label: "Estoque" },
      { k: "clientes",   ico: "IcCustomers",  label: "Clientes",
        subs: [
          { k: "meus",     label: "Meus clientes" },
          { k: "grupos",   label: "Grupos de clientes" },
          { k: "contatos", label: "Contatos" },
        ] },
      { k: "vendas",     ico: "IcPdv",        label: "Vendas",
        subs: [
          { k: "pedidos", label: "Pedidos" },
          { k: "pdv",     label: "PDV" },
          { k: "caixa",   label: "Caixa" },
        ] },
      { k: "promo",      ico: "IcSparkle",    label: "Promoções", dot: true,
        subs: [
          { k: "cupons", label: "Cupons" },
          { k: "ofertas", label: "Ofertas" },
        ] },
      { k: "marketing",  ico: "IcStar",       label: "Marketing" },
      { k: "relatorios", ico: "IcArchive",    label: "Relatórios" },
    ],
  },
  {
    label: "MINHA LOJA",
    items: [
      { k: "lojavirtual", ico: "IcAppearance", label: "Loja virtual",
        subs: [
          { k: "aparencia", label: "Aparência" },
          { k: "produtos-lv", label: "Produtos da loja" },
          { k: "categorias-lv", label: "Categorias da loja" },
          { k: "banners-lv", label: "Banners" },
        ] },
      { k: "pagamentos",  ico: "IcPayment",    label: "Pagamentos" },
      { k: "config",      ico: "IcSettings",   label: "Configurações",
        subs: [
          { k: "identidade", label: "Identidade" },
          { k: "whatsapp",   label: "WhatsApp" },
          { k: "horarios",   label: "Horários" },
          { k: "equipe",     label: "Equipe" },
          { k: "geral",      label: "Geral" },
        ] },
    ],
  },
  {
    label: "CONTA",
    items: [
      { k: "assinatura",  ico: "IcSparkle",    label: "Assinatura" },
      { k: "suporte",     ico: "IcInfo",       label: "Suporte" },
    ],
  },
];

const B3_CUSTOMERS = [
  { id: 1, name: "Caio Martins",        doc: "719.310.49-00", phone: "(99) 99999-9999", email: "caio.martins@gmail.com",  group: "Clientes Silver", active: true },
  { id: 2, name: "Antônio de Paula",    doc: "557.050.35-01", phone: "(99) 99999-9999", email: "seuantonio@gmail.com",    group: "Padrão",           active: true },
  { id: 3, name: "Marcos Paulo de Souza", doc: "953.026.54-09", phone: "(11) 99999-9999", email: "marcospaulo@gmail.com",  group: "Padrão",           active: true },
  { id: 4, name: "Augusto Metz",         doc: "532.120.57-01", phone: "(51) 99999-9999", email: "augusto.metz@dublin.com.br", group: "Padrão",         active: true },
  { id: 5, name: "José Luís",            doc: "360.326.49-08", phone: "(99) 99999-9999", email: "clientejoseluis@gmail.com", group: "Padrão",          active: true },
  { id: 6, name: "Tiago Assis",          doc: "345.003.86-05", phone: "(51) 99999-9999", email: "tiago@dublin.com.br",     group: "Padrão",           active: true },
  { id: 7, name: "Robson Cavalcante",    doc: "714.283.14-05", phone: "(11) 99999-9999", email: "robinho@gmail.com",       group: "Padrão",           active: true },
  { id: 8, name: "Antônio Carlos",       doc: "729.168.79-00", phone: "(99) 99999-9999", email: "b@b.com.br",              group: "Clientes Gold",    active: true },
  { id: 9, name: "Maria Carla",          doc: "169.891.41-05", phone: "(99) 99999-9999", email: "a@a.com.br",              group: "Clientes Silver",  active: true },
  { id: 10, name: "José da Silva",       doc: "994.149.16-07", phone: "(99) 99999-9999", email: "cliente348@gmail.com",    group: "Clientes Silver",  active: true },
];

function B3Sidebar({ active, sub, openClientes = true }) {
  const [openItems, setOpenItems] = React.useState({ [active]: true });
  return (
    <aside className="b3-side">
      <div className="b3-side-top">
        <span className="b3-logo-mark" style={{ cursor: "pointer" }} onClick={() => location.hash = "/dashboard"}>D</span>
        <span className="b3-logo-name" style={{ cursor: "pointer" }} onClick={() => location.hash = "/dashboard"}>dublin</span>
      </div>

      {B3_NAV_GROUPS.map(g => (
        <React.Fragment key={g.label}>
          <div className="b3-side-group">{g.label}</div>
          {g.items.map(it => {
            const Ic = window[it.ico];
            const isActive = it.k === active;
            const isOpen = it.subs && (openItems[it.k] !== undefined ? openItems[it.k] : isActive);
            return (
              <React.Fragment key={it.k}>
                <div className="b3-side-item" data-active={isActive} data-open={isOpen}
                  onClick={(e) => {
                    if (it.subs) {
                      setOpenItems(s => ({ ...s, [it.k]: !isOpen }));
                    } else if (window.__navTo) {
                      window.__navTo(it.label);
                    }
                  }}>
                  <Ic size={17} />
                  <span>{it.label}</span>
                  {it.subs && <IcChevD size={11} className="chev" />}
                  {it.dot && <span className="dot"></span>}
                </div>
                {isOpen && (
                  <div className="b3-side-sub">
                    {it.subs.map(s => (
                      <div key={s.k} className="b3-side-sub-item" data-active={s.k === sub}>
                        {s.label}
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </React.Fragment>
      ))}

      <div className="b3-side-foot">
        <div className="b3-side-foot-user">
          <span className="b3-side-foot-avatar">SB</span>
          <div className="b3-side-foot-user-meta">
            <b>Sandra Brito</b>
            <span>sandra@sandrabrito.com</span>
          </div>
          <IcChevU size={11} style={{ color: "var(--ink-4)" }} />
        </div>
      </div>
    </aside>
  );
}

function B3Top() {
  return (
    <div className="b3-top">
      <div className="b3-search">
        <IcSearch size={15} />
        <input placeholder="Buscar clientes, produtos, pedidos…" />
      </div>
      <div style={{ flex: 1 }}></div>
      <button className="b3-top-icbtn"><IcBolt size={16} /></button>
      <button className="b3-top-icbtn"><IcBell size={16} /><span className="ndot"></span></button>
    </div>
  );
}

// ───────── CLIENTES LISTA ─────────
function B3ClientesScreen({ onOpenNew, onOpenDetail }) {
  return (
    <div className="b3 b3-shell">
      <B3Sidebar active="clientes" sub="meus" />
      <div className="b3-main">
        <B3Top />
        <div className="b3-page">
          <div className="b3-page-hd">
            <h1>Meus clientes</h1>
            <button className="b3-btn b3-btn--cta" onClick={onOpenNew}>
              <IcPlus size={14} /> Adicionar cliente
            </button>
          </div>

          <div className="b3-card" style={{ overflow: "hidden" }}>
            <div className="b3-helpbar">
              <span className="b3-helpbar-ico"><IcInfo size={14} /></span>
              <span className="b3-helpbar-text">Precisa de ajuda? Assista o vídeo sobre <a>clientes</a></span>
            </div>

            <div className="b3-tabs">
              <span className="b3-tab" data-active="true">Todos</span>
              <span className="b3-tab">Ativos</span>
              <span className="b3-tab">Inativos</span>
            </div>

            <div className="b3-toolbar">
              <input type="checkbox" />
              <button className="b3-btn b3-btn--ghost b3-btn--sm"><IcRefresh size={14} /></button>
              <div className="b3-toolbar-search">
                <IcSearch size={14} />
                <input placeholder="Procurar registros" />
              </div>
              <button className="b3-btn b3-btn--sm"><IcStar size={13} /> Salvar filtro</button>
              <button className="b3-btn b3-btn--sm"><IcSliders size={13} /> Ordenar</button>
              <button className="b3-btn b3-btn--sm"><IcFilter size={13} /> Filtros</button>
              <div style={{ flex: 1 }}></div>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>1 – 10 de 10</span>
              <button className="b3-btn b3-btn--ghost b3-btn--sm"><IcChevL size={13} /></button>
              <button className="b3-btn b3-btn--ghost b3-btn--sm"><IcChevR size={13} /></button>
            </div>

            <table className="b3-tbl">
              <thead>
                <tr>
                  <th style={{ width: 28, paddingLeft: 20 }}></th>
                  <th>FOTO</th>
                  <th>NOME</th>
                  <th>CONTATO</th>
                  <th>GRUPO</th>
                  <th style={{ paddingRight: 20, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {B3_CUSTOMERS.map(c => (
                  <tr key={c.id} onClick={onOpenDetail}>
                    <td style={{ paddingLeft: 20 }}><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="b3-avatar">{c.name.split(" ").map(n => n[0]).slice(0,2).join("")}</span>
                        <span className="b3-wa"><IcWhatsApp size={14} /></span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>{c.doc.replace(/\./g, "").slice(0, 8)}</div>
                    </td>
                    <td>
                      <div className="mono">{c.phone}</div>
                      <div className="mono" style={{ fontSize: 11.5, color: "var(--brand)", marginTop: 2 }}>{c.email}</div>
                    </td>
                    <td>
                      {c.group === "Clientes Gold" && <span className="b3-pill b3-pill--gold">★ {c.group}</span>}
                      {c.group === "Clientes Silver" && <span className="b3-pill b3-pill--silver">{c.group}</span>}
                      {c.group === "Padrão" && <span className="b3-pill">{c.group}</span>}
                    </td>
                    <td style={{ textAlign: "right", paddingRight: 20 }}>
                      <span className="b3-pill b3-pill--ok">● Ativo</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="b3-pager">
              <span>Saiba mais sobre <a style={{ color: "var(--brand)", fontWeight: 600 }}>clientes</a> na base de conhecimento.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── CADASTRAR CLIENTE DRAWER ─────────
function B3CadastrarClienteDrawer({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="b3-overlay" onClick={(e) => { if (e.target.classList.contains("b3-overlay")) onClose(); }}>
      <div className="b3-drawer">
        <div className="b3-drawer-hd">
          <h2>Cadastrar cliente</h2>
          <button className="b3-drawer-close" onClick={onClose}><IcClose size={14} /></button>
        </div>
        <div className="b3-drawer-bd">
          <div className="b3-field">
            <label className="b3-field-label">E-mail</label>
            <input className="b3-input" placeholder="Ex: joao@dominio.com.br" />
          </div>
          <div className="b3-row2">
            <div className="b3-field">
              <label className="b3-field-label">Tipo</label>
              <select className="b3-input b3-select">
                <option>Pessoa Física</option>
                <option>Pessoa Jurídica</option>
              </select>
            </div>
            <div className="b3-field">
              <label className="b3-field-label">Documento</label>
              <input className="b3-input mono" placeholder="CPF" />
            </div>
          </div>
          <div className="b3-field">
            <label className="b3-field-label">Nome completo</label>
            <input className="b3-input" placeholder="Ex: João Pereira" />
          </div>
          <div className="b3-field">
            <label className="b3-field-label">Gênero</label>
            <select className="b3-input b3-select">
              <option>Não informar</option>
              <option>Masculino</option>
              <option>Feminino</option>
            </select>
          </div>
          <div className="b3-row2">
            <div className="b3-field">
              <label className="b3-field-label">Data de Nascimento</label>
              <input className="b3-input mono" placeholder="DD/MM/AAAA" />
            </div>
            <div className="b3-field">
              <label className="b3-field-label">Telefone</label>
              <input className="b3-input mono" placeholder="(99) 99999-9999" />
            </div>
          </div>
          <div className="b3-row2">
            <div className="b3-field">
              <label className="b3-field-label">ID Externo</label>
              <input className="b3-input" />
            </div>
            <div className="b3-field">
              <label className="b3-field-label">Grupo</label>
              <select className="b3-input b3-select">
                <option>Padrão</option>
                <option>Clientes Silver</option>
                <option>Clientes Gold</option>
              </select>
            </div>
          </div>
          <label className="b3-checkbox" style={{ marginTop: 8 }}>
            <span className="b3-checkbox-box"><IcCheck size={11} /></span>
            <span>Receber newsletter e promoções</span>
          </label>
        </div>
        <div className="b3-drawer-ft">
          <button className="b3-btn b3-btn--cta" onClick={onClose}>
            <IcCheck size={14} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────── DETALHE CLIENTE ─────────
function B3ClienteDetalheScreen({ onBack }) {
  return (
    <div className="b3 b3-shell">
      <B3Sidebar active="clientes" sub="meus" />
      <div className="b3-main">
        <B3Top />
        <div className="b3-page">
          <div className="b3-back-row">
            <button onClick={onBack}><IcChevL size={15} /></button>
            <h1>Detalhe do cliente</h1>
          </div>

          <div className="b3-detail-grid">
            <div>
              <div className="b3-detail-card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>João Mario</h2>
                    <div className="mono" style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>232.822.400-82</div>
                  </div>
                  <a style={{ color: "var(--brand)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Editar</a>
                </div>

                <div className="b3-kv-list" style={{ marginTop: 18 }}>
                  <div className="b3-kv">ID: <b>23429780</b></div>
                  <div className="b3-kv">Cadastro: <b>08/07/2024 às 14:23</b></div>
                  <div className="b3-kv">E-mail: <b className="green">joaomario@gmail.com ✓✓</b></div>
                  <div className="b3-kv">Fone: <b className="green">(51) 99999-9999 <IcWhatsApp size={13} style={{ verticalAlign: "middle", color: "var(--ok)" }} /></b></div>
                  <div className="b3-kv">Gênero: <b>Masculino</b></div>
                  <div className="b3-kv">Nascimento: <b>20/01/1990 — 34 anos</b></div>
                  <div className="b3-kv">Grupo: <b>Padrão</b></div>
                </div>


              </div>

              <div className="b3-detail-card" style={{ marginBottom: 16 }}>
                <div className="b3-stats-grid">
                  <div className="b3-stat">
                    <div className="b3-stat-label">0 PEDIDO FINALIZADO</div>
                    <div className="b3-stat-value mono">0</div>
                  </div>
                  <div className="b3-stat">
                    <div className="b3-stat-label">EM PEDIDOS APROVADOS</div>
                    <div className="b3-stat-value mono">R$ 0,00</div>
                  </div>
                  <div className="b3-stat">
                    <div className="b3-stat-label">TICKET MÉDIO</div>
                    <div className="b3-stat-value mono">R$ 0,00</div>
                  </div>
                  <div className="b3-stat">
                    <div className="b3-stat-label">PRODUTOS POR PEDIDO</div>
                    <div className="b3-stat-value mono">0</div>
                  </div>
                  <div className="b3-stat">
                    <div className="b3-stat-label">ÚLTIMO PEDIDO</div>
                    <div className="b3-stat-value mono">N/A</div>
                  </div>
                  <div className="b3-stat">
                    <div className="b3-stat-label">RANKING DE CLIENTE</div>
                    <div className="b3-stat-value mono">5º</div>
                  </div>
                </div>
              </div>

              <div className="b3-detail-card" style={{ padding: 0 }}>
                <div style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Últimos 5 produtos comprados</h3>
                  <IcChevD size={14} style={{ color: "var(--ink-4)" }} />
                </div>
              </div>

              <div className="b3-detail-card" style={{ marginTop: 16 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Histórico</h3>
                <div className="b3-history-item">
                  <span className="b3-history-dot"></span>
                  <div className="b3-history-meta">
                    <b>O cliente se cadastrou.</b>
                    <time>08 julho, 2024 às 14:23</time>
                  </div>
                  <button className="b3-drawer-close" style={{ marginLeft: "auto" }}><IcClose size={13} /></button>
                </div>
              </div>
            </div>

            <div>
              <div className="b3-detail-card" style={{ marginBottom: 16, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="b3-toggle b3-toggle--on"></span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Ativo</span>
                  </div>
                  <button className="b3-drawer-close"><IcTrash size={13} /></button>
                </div>
              </div>

              <div className="b3-detail-card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Endereço</h3>
                  <a style={{ color: "var(--brand)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Adicionar</a>
                </div>
                <div style={{ padding: 28, background: "var(--bg-app)", borderRadius: 10, textAlign: "center", color: "var(--ink-4)", border: "1px dashed var(--line-2)" }}>
                  <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <IcMap size={20} />
                    <span style={{ fontSize: 13 }}>Insira um endereço</span>
                  </div>
                </div>
              </div>

              <div className="b3-detail-card">
                <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Observações</h3>
                <textarea className="b3-input" style={{ height: 100, padding: 12, lineHeight: 1.5, fontFamily: "var(--font)" }} placeholder="Anotação sobre o cliente (não é visível para o cliente)..."></textarea>
                <button className="b3-btn b3-btn--cta" style={{ marginTop: 12 }}>Salvar observação</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── GRUPOS DE CLIENTES ─────────
function B3GruposScreen({ onBack }) {
  return (
    <div className="b3 b3-shell">
      <B3Sidebar active="clientes" sub="grupos" />
      <div className="b3-main">
        <B3Top />
        <div className="b3-page">
          <div className="b3-page-hd">
            <h1>Grupos de clientes</h1>
            <button className="b3-btn b3-btn--cta">
              <IcPlus size={14} /> Novo grupo
            </button>
          </div>

          <div className="b3-card" style={{ overflow: "hidden" }}>
            <div className="b3-helpbar">
              <span className="b3-helpbar-ico"><IcInfo size={14} /></span>
              <span className="b3-helpbar-text">Use grupos pra dar descontos exclusivos, comunicar com segmentos e criar campanhas direcionadas.</span>
            </div>
            <table className="b3-tbl">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>NOME</th>
                  <th>DESCRIÇÃO</th>
                  <th style={{ textAlign: "right" }}>CLIENTES</th>
                  <th>BENEFÍCIO</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Padrão",          desc: "Clientes sem grupo específico — comportamento padrão da loja", count: 142, beneficio: "Nenhum", default: true,  tone: "default" },
                  { name: "Clientes Silver", desc: "Clientes com 3+ pedidos · acesso antecipado a coleções",      count: 38,  beneficio: "5% OFF · acesso antecipado", tone: "silver" },
                  { name: "Clientes Gold",   desc: "Clientes VIP · gastam mais de R$ 1.000 vitalício",            count: 12,  beneficio: "10% OFF · frete grátis · brinde", tone: "gold" },
                  { name: "Atacado",         desc: "Revendedoras · pedidos a partir de R$ 500",                    count: 4,   beneficio: "20% OFF · 30/60/90 dias", tone: "brand" },
                ].map(g => (
                  <tr key={g.name}>
                    <td style={{ paddingLeft: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {g.tone === "gold" && <span className="b3-pill b3-pill--gold">★ {g.name}</span>}
                        {g.tone === "silver" && <span className="b3-pill b3-pill--silver">{g.name}</span>}
                        {g.tone === "brand" && <span className="b3-pill b3-pill--brand">{g.name}</span>}
                        {g.tone === "default" && <span className="b3-pill">{g.name}</span>}
                        {g.default && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--ink-4)" }}>PADRÃO</span>}
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-3)", maxWidth: 380 }}>{g.desc}</td>
                    <td style={{ textAlign: "right" }} className="mono">{g.count}</td>
                    <td style={{ fontSize: 12.5 }}>{g.beneficio}</td>
                    <td style={{ textAlign: "right", paddingRight: 20 }}>
                      <button className="b3-btn b3-btn--ghost b3-btn--sm"><IcDotsV size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  B3ClientesScreen, B3CadastrarClienteDrawer, B3ClienteDetalheScreen, B3GruposScreen,
  B3Sidebar, B3Top, B3_CUSTOMERS,
});
