// Sidebar lateral fixa do admin — desktop only (`hidden lg:flex`).
// Mobile usa o mesmo conteúdo dentro de um Sheet drawer (ver MobileHeader).
//
// Onda 4 port Dublin (ADR-0019): 240px → 248px e border-right usa --line
// (alias gray-200 mantém pixel-exato).
import { SidebarContent, type SidebarContentProps } from "./sidebar-content";

export type AdminSidebarProps = SidebarContentProps;

export function AdminSidebar(props: AdminSidebarProps) {
  return (
    <aside
      aria-label="Navegação principal"
      className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line lg:flex"
    >
      <SidebarContent {...props} />
    </aside>
  );
}
