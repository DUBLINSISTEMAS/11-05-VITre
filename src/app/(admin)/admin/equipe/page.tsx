import { asc, eq } from "drizzle-orm";
import { ShieldIcon, UserPlusIcon } from "lucide-react";

import { db } from "@/db";
import { storeMembershipTable, userTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: equipe page sem loja");
  }

  // Carrega owner + memberships. ⚠ NÃO usa withTenant aqui — owner pode
  // querer ver os membros mesmo durante o setup. RLS protege via store_id
  // do GUC quando outras actions tocarem.
  const [owner] = await db
    .select({ name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, store.ownerId))
    .limit(1);

  const memberships = await db
    .select({
      id: storeMembershipTable.id,
      invitedEmail: storeMembershipTable.invitedEmail,
      role: storeMembershipTable.role,
      status: storeMembershipTable.status,
      createdAt: storeMembershipTable.createdAt,
    })
    .from(storeMembershipTable)
    .where(eq(storeMembershipTable.storeId, store.id))
    .orderBy(asc(storeMembershipTable.createdAt));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Equipe
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Gerencie quem tem acesso ao painel da loja.
        </p>
      </div>

      {/* Owner */}
      <div className="b3-card b3-card-pad">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-full"
              style={{ background: "var(--brand-wash)", color: "var(--brand)" }}
            >
              <ShieldIcon size={16} />
            </div>
            <div>
              <div className="text-ink-1 text-[14px] font-semibold">
                {owner?.name ?? "Você"}
              </div>
              <div className="text-ink-3 text-[12.5px]">
                {owner?.email ?? "—"}
              </div>
            </div>
          </div>
          <span
            className="b3-pill b3-pill--brand"
            style={{ alignSelf: "center" }}
          >
            Dono
          </span>
        </div>
      </div>

      {/* Memberships + convite */}
      <div className="b3-card b3-card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-ink-1 text-[16px] font-bold">Membros</h3>
            <p className="text-ink-3 mt-0.5 text-[12.5px]">
              Convide funcionários ou sócios. 3 níveis: Dono, Operador, Visualizador.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="b3-btn disabled:cursor-not-allowed disabled:opacity-50"
            style={{ height: 36 }}
            title="Convite por email vem na Fase 2 (Better Auth invite link)"
          >
            <UserPlusIcon size={13} /> Convidar · em breve
          </button>
        </div>

        {memberships.length === 0 ? (
          <p className="text-ink-3 mt-4 text-[12.5px]">
            Nenhum membro além de você ainda.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="b3-tbl w-full">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Papel</th>
                  <th>Status</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr key={m.id}>
                    <td className="text-ink-1">{m.invitedEmail}</td>
                    <td>
                      <span className="b3-pill">{labelRole(m.role)}</span>
                    </td>
                    <td>{renderStatus(m.status)}</td>
                    <td className="text-ink-3 mono text-[12px]">
                      {m.createdAt.toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Roles cheatsheet */}
      <div className="b3-card b3-card-pad">
        <h3 className="text-ink-1 text-[14px] font-bold">O que cada papel pode fazer</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <RoleCard
            title="Dono"
            tone="brand"
            items={[
              "Tudo",
              "Excluir loja",
              "Gerenciar equipe",
              "Mexer em pagamento e plano",
            ]}
          />
          <RoleCard
            title="Operador"
            items={[
              "PDV, pedidos, estoque",
              "Clientes, leads, atributos",
              "Cupons, banners",
              "Sem acesso a equipe/plano",
            ]}
          />
          <RoleCard
            title="Visualizador"
            items={[
              "Listings (read-only)",
              "Relatórios",
              "Sem criar/editar/deletar",
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function labelRole(r: "owner" | "staff" | "viewer"): string {
  return r === "owner" ? "Dono" : r === "staff" ? "Operador" : "Visualizador";
}

function renderStatus(s: "pending" | "active" | "revoked") {
  if (s === "active")
    return <span className="b3-pill b3-pill--ok">Ativo</span>;
  if (s === "pending")
    return <span className="b3-pill b3-pill--warn">Pendente</span>;
  return <span className="b3-pill b3-pill--danger">Revogado</span>;
}

function RoleCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "brand";
}) {
  return (
    <div
      className="rounded-[10px] border p-3"
      style={{
        background: "var(--bg-app)",
        borderColor: tone === "brand" ? "var(--brand-line)" : "var(--line)",
      }}
    >
      <h4
        className="text-[13px] font-bold"
        style={{ color: tone === "brand" ? "var(--brand)" : "var(--ink-1)" }}
      >
        {title}
      </h4>
      <ul className="mt-2 space-y-1 text-[12px]">
        {items.map((i, idx) => (
          <li key={idx} className="text-ink-3">
            · {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
