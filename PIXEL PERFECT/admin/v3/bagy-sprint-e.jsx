// =========================================================
// DUBLIN V3 — Sprint E: Loja virtual completa, Login, Onboarding,
// Storefront mobile, rotas extras
// =========================================================

// ───────── LOGIN ─────────
function B3LoginScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "white" }}>
      <div style={{ background: "linear-gradient(135deg, var(--brand), #2A4FA8)", padding: 56, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 44, height: 44, background: "rgba(255,255,255,0.15)", color: "white", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 22 }}>D</span>
          <span style={{ fontWeight: 700, fontSize: 20 }}>dublin</span>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.16, textTransform: "uppercase", opacity: 0.7, marginBottom: 16 }}>★ GESTÃO COMPLETA · CATÁLOGO + WHATSAPP</div>
          <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>Sua loja merece<br/>um sistema sério.</h1>
          <p style={{ fontSize: 15, opacity: 0.85, marginTop: 18, maxWidth: 380, lineHeight: 1.55 }}>O Dublin é tudo o que sua loja precisa: catálogo online, PDV, estoque, clientes e relatórios — direto do celular.</p>
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.65, fontFamily: "var(--mono)", letterSpacing: 0.04 }}>© 2026 Dublin · powered by Dublin Sistemas</div>
      </div>
      <div style={{ padding: 56, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 460, margin: "0 auto", width: "100%" }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Entre na sua conta</h2>
        <p style={{ fontSize: 14, color: "var(--ink-4)", margin: "10px 0 32px" }}>Bem-vinda de volta. Continue de onde parou.</p>
        <div className="b3-field"><label className="b3-field-label">E-mail</label><input className="b3-input mono" placeholder="seu@email.com" defaultValue="sandra@sandrabrito.com" /></div>
        <div className="b3-field"><label className="b3-field-label">Senha</label><input className="b3-input mono" type="password" defaultValue="••••••••••" /></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, fontSize: 13 }}>
          <label className="b3-checkbox"><span className="b3-checkbox-box"><IcCheck size={11} /></span><span>Lembrar login</span></label>
          <a style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>Esqueceu a senha?</a>
        </div>
        <button onClick={() => location.hash = "/dashboard"} className="b3-btn b3-btn--cta" style={{ height: 48, fontSize: 14, fontWeight: 700, justifyContent: "center" }}>Entrar →</button>
        <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid var(--line)", textAlign: "center" }}>
          <span style={{ fontSize: 13, color: "var(--ink-4)" }}>Ainda não tem loja? <a onClick={() => location.hash = "/onboarding"} style={{ color: "var(--brand)", fontWeight: 700, cursor: "pointer" }}>Criar conta</a></span>
        </div>
      </div>
    </div>
  );
}

// ───────── ONBOARDING WIZARD ─────────
function B3OnboardingScreen({ initialStep = 0 }) {
  const [step, setStep] = React.useState(initialStep);
  const steps = [
    { k: "conta", l: "Sua conta", ico: "IcUser" },
    { k: "loja", l: "Identidade", ico: "IcAppearance" },
    { k: "ramo", l: "Tipo de negócio", ico: "IcCatalog" },
    { k: "pagamento", l: "Pagamento", ico: "IcPayment" },
  ];
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)", padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", width: "100%", maxWidth: 880, borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px -30px rgba(15,20,25,0.25)" }}>
        <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="b3-logo-mark">D</span>
            <span style={{ fontWeight: 700, fontSize: 17 }}>dublin</span>
          </div>
          <a onClick={() => location.hash = "/dashboard"} style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)", letterSpacing: 0.06, textTransform: "uppercase", cursor: "pointer" }}>PULAR</a>
        </div>
        <div style={{ padding: "16px 32px", background: "var(--bg-app)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 4 }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.k}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 0", color: i === step ? "var(--ink-1)" : i < step ? "var(--ok)" : "var(--ink-4)", fontWeight: i === step ? 600 : 500, fontSize: 13 }}>
                <span style={{ width: 22, height: 22, borderRadius: 50, background: i === step ? "var(--brand)" : i < step ? "var(--ok)" : "var(--bg-app)", border: i >= step ? "none" : "1.5px solid var(--line-2)", color: i <= step ? "white" : "var(--ink-4)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i < step ? <IcCheck size={11} /> : i + 1}</span>
                <span>{s.l}</span>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? "var(--ok)" : "var(--line-2)", margin: "0 6px" }}></div>}
            </React.Fragment>
          ))}
        </div>
        <div style={{ padding: "36px 48px" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: 0.14, color: "var(--brand)", textTransform: "uppercase" }}>PASSO {step + 1} DE {steps.length}</span>
          {step === 0 && (<>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 6px" }}>Vamos começar com seus dados</h2>
            <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "0 0 24px" }}>Você é a dona da loja. Esses dados ficam só pra você.</p>
            <div className="b3-row2">
              <div className="b3-field"><label className="b3-field-label">Seu nome</label><input className="b3-input" placeholder="Como devo te chamar?" /></div>
              <div className="b3-field"><label className="b3-field-label">WhatsApp</label><input className="b3-input mono" placeholder="+55 99 99182-4001" /></div>
            </div>
            <div className="b3-field"><label className="b3-field-label">E-mail</label><input className="b3-input mono" placeholder="seu@email.com" /></div>
            <div className="b3-field"><label className="b3-field-label">Senha</label><input className="b3-input mono" type="password" placeholder="Mínimo 8 caracteres" /></div>
          </>)}
          {step === 1 && (<>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 6px" }}>Como sua loja se chama?</h2>
            <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "0 0 24px" }}>É o nome que aparece pro cliente. Pode mudar depois.</p>
            <div className="b3-field"><label className="b3-field-label">Nome da loja</label><input className="b3-input" placeholder="Ex: Sandra Brito Collection" /></div>
            <div className="b3-field"><label className="b3-field-label">URL pública</label>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line-2)", borderRadius: 8, overflow: "hidden", height: 42 }}>
                <span style={{ padding: "0 12px", background: "var(--bg-app)", height: "100%", display: "inline-flex", alignItems: "center", fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-4)" }}>dublin.app/</span>
                <input style={{ flex: 1, border: "none", height: "100%", padding: "0 12px", fontFamily: "var(--mono)", fontSize: 14 }} placeholder="sandra-brito" />
              </div>
            </div>
          </>)}
          {step === 2 && (<>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 6px" }}>Que tipo de loja você tem?</h2>
            <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "0 0 24px" }}>Usamos pra preparar categorias e exemplos. Escolha quantos quiser.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { l: "Roupas", on: true }, { l: "Joias & semijoias" }, { l: "Calçados" },
                { l: "Perfumaria" }, { l: "Casa & decor" }, { l: "Outro" },
              ].map(t => (
                <button key={t.l} style={{ padding: 16, background: t.on ? "var(--brand-wash)" : "white", border: `1.5px solid ${t.on ? "var(--brand)" : "var(--line)"}`, borderRadius: 12, textAlign: "left", cursor: "pointer", fontSize: 14, fontWeight: 600, color: t.on ? "var(--brand)" : "var(--ink-1)" }}>{t.l}</button>
              ))}
            </div>
          </>)}
          {step === 3 && (<>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 6px" }}>Como você quer receber?</h2>
            <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "0 0 24px" }}>Ative formas de pagamento que aceita. Pode ajustar depois.</p>
            {[
              { ico: "IcBolt", l: "PIX", on: true },
              { ico: "IcMoney", l: "Dinheiro", on: true },
              { ico: "IcPayment", l: "Cartão débito", on: true },
              { ico: "IcPayment", l: "Cartão crédito · até 6×", on: true },
            ].map(m => {
              const Ic = window[m.ico];
              return (
                <div key={m.l} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, border: "1px solid var(--line)", borderRadius: 10, marginBottom: 6 }}>
                  <span style={{ width: 36, height: 36, background: "var(--brand-wash)", color: "var(--brand)", borderRadius: 50, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic size={16} /></span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{m.l}</span>
                  <span className={`b3-toggle${m.on ? " b3-toggle--on" : ""}`}></span>
                </div>
              );
            })}
          </>)}
        </div>
        <div style={{ padding: "18px 32px", background: "var(--bg-app)", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
          {step > 0 ? <button className="b3-btn" onClick={() => setStep(s => s - 1)}><IcChevL size={13} /> Voltar</button> : <span></span>}
          {step < steps.length - 1 ? (
            <button className="b3-btn b3-btn--cta" onClick={() => setStep(s => s + 1)}>Continuar <IcChevR size={13} /></button>
          ) : (
            <button className="b3-btn b3-btn--cta" onClick={() => location.hash = "/dashboard"}><IcCheck size={14} /> Criar minha loja</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────── LOJA VIRTUAL — APARÊNCIA com preview live ─────────
function B3LojaVirtualV2Screen() {
  const [device, setDevice] = React.useState("desktop");
  return (
    <B3Shell active="lojavirtual" sub="aparencia">
      <div className="b3-page">
        <div className="b3-page-hd">
          <div>
            <h1>Aparência da loja</h1>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>Personalize · veja preview · publique</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="b3-btn"><IcRefresh size={14} /> Resetar</button>
            <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Publicar mudanças</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Identidade</h3>
              <div className="b3-field"><label className="b3-field-label">Nome da loja</label><input className="b3-input" defaultValue="Sandra Brito Collection" /></div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div>
                  <label className="b3-field-label">Logo</label>
                  <div style={{ width: 64, height: 64, background: "var(--brand)", color: "white", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 26 }}>S</div>
                </div>
                <div>
                  <label className="b3-field-label">Favicon redondo</label>
                  <div style={{ width: 64, height: 64, background: "var(--brand)", color: "white", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 26 }}>S</div>
                </div>
              </div>
            </div>
            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Cor primária</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["#1A3A8F","#0E1129","#0F6E3F","#92580C","#A4231E","#6B2A8C","#1F6F75"].map(c => (
                  <button key={c} style={{ width: 36, height: 36, borderRadius: 10, background: c, border: c === "#1A3A8F" ? "2px solid var(--ink-1)" : "1px solid var(--line-2)", cursor: "pointer" }} />
                ))}
              </div>
            </div>
            <div className="b3-card b3-card-pad">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Tipografia</h3>
              {[{n:"Geist",on:true},{n:"Inter Tight"},{n:"DM Sans"},{n:"Fraunces · serif"}].map(f => (
                <div key={f.n} style={{ padding: "10px 12px", background: f.on ? "var(--brand-wash)" : "var(--surface)", border: `1.5px solid ${f.on ? "var(--brand)" : "var(--line)"}`, borderRadius: 8, marginBottom: 4, fontSize: 13, fontWeight: f.on ? 600 : 500, color: f.on ? "var(--brand)" : "var(--ink-1)", cursor: "pointer" }}>{f.n}</div>
              ))}
            </div>
          </div>

          <div className="b3-card" style={{ overflow: "hidden" }}>
            <div className="b3-card-hd">
              <h3>Pré-visualização ao vivo</h3>
              <div style={{ display: "flex", gap: 4, background: "var(--bg-app)", borderRadius: 8, padding: 3 }}>
                {[{k:"desktop",l:"Desktop"},{k:"mobile",l:"Mobile"}].map(d => (
                  <button key={d.k} onClick={() => setDevice(d.k)} style={{ padding: "6px 14px", background: device === d.k ? "white" : "transparent", color: device === d.k ? "var(--ink-1)" : "var(--ink-4)", border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", boxShadow: device === d.k ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}>{d.l}</button>
                ))}
              </div>
            </div>
            <div style={{ background: "var(--bg-app)", padding: 24, display: "flex", justifyContent: "center" }}>
              {device === "desktop" ? (
                <div style={{ width: "100%", maxWidth: 720, background: "white", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 24, height: 24, background: "var(--brand)", color: "white", borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11 }}>S</span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Sandra Brito</span>
                    <span style={{ flex: 1, textAlign: "center", fontSize: 11, color: "var(--ink-4)" }}>Vestidos · Blusas · Acessórios</span>
                  </div>
                  <div style={{ height: 180, background: "linear-gradient(135deg, var(--brand), #3F60C2)", padding: 20, color: "white", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.08 }}>★ OUTONO 26</div>
                    <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em" }}>Tons que aquecem</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, padding: 12 }}>
                    {[1,2,3,4].map(i => <div key={i} style={{ aspectRatio: "3/4", background: "var(--brand-wash)", borderRadius: 6 }}></div>)}
                  </div>
                </div>
              ) : (
                <div style={{ width: 240, background: "white", border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 22, height: 22, background: "var(--brand)", color: "white", borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 10 }}>S</span>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>Sandra Brito</span>
                  </div>
                  <div style={{ height: 140, background: "linear-gradient(135deg, var(--brand), #3F60C2)", padding: 14, color: "white", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, letterSpacing: 0.08 }}>★ OUTONO 26</div>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em" }}>Tons que aquecem</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 10 }}>
                    {[1,2,3,4].map(i => <div key={i} style={{ aspectRatio: "3/4", background: "var(--brand-wash)", borderRadius: 4 }}></div>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── PRODUTOS DA LOJA — escolher quais aparecem ─────────
function B3ProdutosLVScreen() {
  return (
    <B3Shell active="lojavirtual" sub="produtos-lv">
      <div className="b3-page">
        <div className="b3-page-hd">
          <div>
            <h1>Produtos da loja</h1>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>Escolha quais produtos cadastrados aparecem na sua loja pública.</div>
          </div>
          <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Publicar seleção</button>
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <div className="b3-toolbar">
            <div className="b3-toolbar-search"><IcSearch size={14} /><input placeholder="Buscar produto…" /></div>
            <button className="b3-btn b3-btn--sm">Filtrar por categoria</button>
            <span style={{ flex: 1 }}></span>
            <span style={{ fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--mono)" }}>128 de 142 visíveis</span>
          </div>
          <table className="b3-tbl">
            <thead><tr><th style={{ paddingLeft: 20, width: 60 }}>VISÍVEL</th><th>PRODUTO</th><th>CATEGORIA</th><th>POSIÇÃO</th><th style={{ textAlign: "right", paddingRight: 20 }}>PREÇO</th></tr></thead>
            <tbody>
              {[
                { n: "Vestido midi azul royal", c: "Vestidos", on: true, pos: 1, p: "R$ 189" },
                { n: "Blazer verde sálvia", c: "Blazers", on: true, pos: 2, p: "R$ 249" },
                { n: "Saia plissada bege", c: "Saias", on: true, pos: 3, p: "R$ 129" },
                { n: "Brinco gota dourado", c: "Acessórios", on: true, pos: 4, p: "R$ 40" },
                { n: "Camisa oversized branca", c: "Camisas", on: false, pos: null, p: "R$ 119" },
                { n: "Conjunto crop linho", c: "Conjuntos", on: false, pos: null, p: "R$ 289" },
              ].map((p, i) => (
                <tr key={i}>
                  <td style={{ paddingLeft: 20 }}><span className={`b3-toggle${p.on ? " b3-toggle--on" : ""}`}></span></td>
                  <td style={{ fontWeight: 600, color: p.on ? "var(--ink-1)" : "var(--ink-4)" }}>{p.n}</td>
                  <td><span className="b3-pill">{p.c}</span></td>
                  <td className="mono">{p.pos || "—"}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700, paddingRight: 20 }}>{p.p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── CATEGORIAS DA LOJA — escolher quais aparecem ─────────
function B3CategoriasLVScreen() {
  return (
    <B3Shell active="lojavirtual" sub="categorias-lv">
      <div className="b3-page">
        <div className="b3-page-hd">
          <div>
            <h1>Categorias da loja</h1>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>Escolha quais categorias aparecem no menu da sua loja pública.</div>
          </div>
          <button className="b3-btn b3-btn--cta"><IcCheck size={14} /> Salvar ordem</button>
        </div>
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <table className="b3-tbl">
            <thead><tr><th style={{ paddingLeft: 20, width: 60 }}>VISÍVEL</th><th>CATEGORIA</th><th style={{ textAlign: "right" }}>PRODUTOS</th><th>POSIÇÃO NO MENU</th></tr></thead>
            <tbody>
              {[
                { n: "Vestidos", c: 24, on: true, pos: 1 },
                { n: "Blusas", c: 18, on: true, pos: 2 },
                { n: "Saias", c: 14, on: true, pos: 3 },
                { n: "Acessórios", c: 28, on: true, pos: 4 },
                { n: "Blazers", c: 12, on: false, pos: null },
                { n: "Conjuntos", c: 7, on: false, pos: null },
                { n: "Calças", c: 9, on: false, pos: null },
              ].map((c, i) => (
                <tr key={i}>
                  <td style={{ paddingLeft: 20 }}><span className={`b3-toggle${c.on ? " b3-toggle--on" : ""}`}></span></td>
                  <td style={{ fontWeight: 600, color: c.on ? "var(--ink-1)" : "var(--ink-4)" }}>{c.n}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{c.c}</td>
                  <td className="mono">{c.pos || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </B3Shell>
  );
}

// ───────── STOREFRONT MOBILE (preview) ─────────
function B3StorefrontMobile({ route = "home" }) {
  return (
    <div style={{ width: 390, height: 844, background: "white", borderRadius: 38, overflow: "hidden", position: "relative", border: "1px solid var(--line-2)", boxShadow: "0 30px 80px -30px rgba(15,20,25,0.25)", fontFamily: "var(--font)" }}>
      <div style={{ height: 44, padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700 }}>
        <span>9:41</span>
        <span style={{ width: 90, height: 26, background: "var(--ink-1)", borderRadius: 999 }}></span>
        <span style={{ fontSize: 11 }}>100%</span>
      </div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
        <button style={{ width: 36, height: 36, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer" }}><IcMenu size={15} /></button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
          <span style={{ width: 24, height: 24, background: "var(--brand)", color: "white", borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11 }}>S</span>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Sandra Brito</span>
        </div>
        <button style={{ width: 36, height: 36, background: "var(--bg-app)", border: "none", borderRadius: 50, cursor: "pointer", position: "relative" }}>
          <span style={{ fontSize: 14 }}>🛍</span>
          <span style={{ position: "absolute", top: 4, right: 4, width: 16, height: 16, background: "var(--brand)", color: "white", borderRadius: 50, fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>3</span>
        </button>
      </div>
      <div style={{ height: "calc(100% - 44px - 62px - 64px)", overflow: "auto" }}>
        {route === "home" && (<>
          <div style={{ height: 200, background: "linear-gradient(135deg, var(--brand), #3F60C2)", padding: 20, color: "white", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: 0.1, marginBottom: 6 }}>★ COLEÇÃO OUTONO 26</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.05 }}>Tons que aquecem</div>
            <button style={{ marginTop: 10, height: 32, padding: "0 14px", background: "white", color: "var(--ink-1)", border: "none", borderRadius: 6, fontWeight: 600, alignSelf: "flex-start", fontSize: 12 }}>Explorar →</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 14 }}>
            {[1,2,3,4].map(i => (
              <div key={i}>
                <div style={{ aspectRatio: "3/4", background: "var(--brand-wash)", borderRadius: 8, marginBottom: 6 }}></div>
                <div style={{ fontSize: 11.5, fontWeight: 600 }}>Produto {i}</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>R$ 189,00</div>
                <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>3× R$ 63 sem juros</div>
              </div>
            ))}
          </div>
        </>)}
        {route === "categoria" && (<>
          <div style={{ padding: 16 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: 0.06, color: "var(--ink-4)" }}>CATEGORIA</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "4px 0 0" }}>Vestidos</h1>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)" }}>24 PEÇAS</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 14px 14px" }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i}>
                <div style={{ aspectRatio: "3/4", background: "var(--brand-wash)", borderRadius: 8, marginBottom: 6 }}></div>
                <div style={{ fontSize: 11.5, fontWeight: 600 }}>Vestido {i}</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>R$ 189</div>
              </div>
            ))}
          </div>
        </>)}
        {route === "buscar" && (<>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
            <input style={{ width: "100%", height: 44, padding: "0 14px", background: "var(--bg-app)", border: "none", borderRadius: 12, fontSize: 14 }} defaultValue="vestido azul" />
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: 0.06, color: "var(--ink-4)", marginBottom: 10 }}>RESULTADOS · 12</div>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ width: 48, height: 60, background: "var(--brand-wash)", borderRadius: 6 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>Vestido midi azul {i}</div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>R$ 189,00</div>
                </div>
              </div>
            ))}
          </div>
        </>)}
        {route === "sacola" && (<>
          <div style={{ padding: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Sua sacola</h1>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)" }}>3 ITENS</span>
          </div>
          <div style={{ padding: "0 16px" }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ width: 80, height: 100, background: "var(--brand-wash)", borderRadius: 8 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>Vestido midi azul · M</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>VST-AZ-M</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, marginTop: 14 }}>R$ 189,00</div>
                </div>
              </div>
            ))}
            <div style={{ padding: 14, background: "var(--bg-app)", borderRadius: 10, marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "var(--ink-4)" }}>Subtotal</span><span className="mono">R$ 478</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}><span style={{ color: "var(--ink-4)" }}>Frete</span><span>a combinar</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}><span style={{ fontWeight: 600 }}>Total</span><span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>R$ 478</span></div>
            </div>
          </div>
        </>)}
      </div>
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 16, height: 48, background: "white", border: "1px solid var(--line)", borderRadius: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: 4, boxShadow: "0 -4px 16px rgba(0,0,0,0.04)" }}>
        {[{k:"home",l:"Início"},{k:"categoria",l:"Categorias"},{k:"buscar",l:"Buscar"},{k:"sacola",l:"Sacola"}].map(b => (
          <div key={b.k} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: b.k === route ? "var(--brand)" : "var(--ink-4)", borderRadius: 12, background: b.k === route ? "var(--brand-wash)" : "transparent" }}>{b.l}</div>
        ))}
      </div>
    </div>
  );
}

function B3StorefrontPreview() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)", padding: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 24, placeItems: "center" }}>
      <B3StorefrontMobile route="home" />
      <B3StorefrontMobile route="categoria" />
      <B3StorefrontMobile route="buscar" />
      <B3StorefrontMobile route="sacola" />
    </div>
  );
}

Object.assign(window, {
  B3LoginScreen, B3OnboardingScreen, B3LojaVirtualV2Screen,
  B3ProdutosLVScreen, B3CategoriasLVScreen,
  B3StorefrontMobile, B3StorefrontPreview,
});
