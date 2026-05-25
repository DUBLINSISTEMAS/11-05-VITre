import { loadAttributes } from "@/actions/attribute/load";
import { AttributesManager } from "@/components/admin/attributes-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AtributosPage() {
  await requireSession();
  const attributes = await loadAttributes();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* S12 (handoff pixel-perfect 2026-05-25): vira `.b3-page-title` +
          `.b3-page-sub`. Mantemos "Filtros da loja" como label (handoff
          chama "Atributos" mas CLAUDE.md vocab canônico diz "Atributo →
          Filtro da loja", e norte vivo > handoff em conflitos). Sub vira
          o texto do handoff atributos.jsx:77 (mais informativo que o
          mock — explica WHERE os atributos aparecem). */}
      <div>
        <h1 className="b3-page-title">Filtros da loja</h1>
        <p className="b3-page-sub">
          Características que seus produtos têm (tamanho, cor, material…).
          Usadas em variantes, filtros da loja e ficha do produto.
        </p>
      </div>

      {/* PP6 (handoff 2026-05-25) — helper honesto: o CRUD funciona, mas a
          vinculação produto↔valor + filtros no storefront ainda não. Pendente
          PP6.x. Decisão "1:1 handoff" com mock — régua "funciona-ou-esconde"
          temporariamente suspensa (memory: pixel-perfect-redesign-decisao). */}
      <div
        className="rounded-[10px] p-4"
        style={{
          background: "var(--mangos-yellow-soft)",
          border: "1px solid var(--brand-line)",
        }}
      >
        <p
          className="text-[12.5px] leading-relaxed"
          style={{ color: "var(--mangos-yellow-deep)" }}
        >
          <strong>Em construção pixel-perfect.</strong> O cadastro de atributos
          + valores funciona. A vinculação <em>produto ↔ valor</em> (na ficha
          do produto) e os <em>filtros dinâmicos</em> no /categoria da loja
          online entram em PP6.x (próxima onda). Por ora, o que você cadastrar
          aqui fica disponível pra quando a integração landar.
        </p>
      </div>

      <AttributesManager initialAttributes={attributes} />
    </div>
  );
}
