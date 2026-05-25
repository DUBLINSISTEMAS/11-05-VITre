import { loadAttributes } from "@/actions/attribute/load";
import { AttributesManager } from "@/components/admin/attributes-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AtributosPage() {
  await requireSession();
  const attributes = await loadAttributes();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Filtros da loja
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Catálogo de cores, tamanhos e características reutilizáveis entre
          produtos.
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
