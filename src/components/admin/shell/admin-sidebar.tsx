// Sidebar lateral fixa do admin — desktop only.
// Onda A.3 port Dublin v3 (ADR-0019): substitui wrappers tailwind pela
// classe canônica `b3-side` (248px, sticky, bg-surface, border-right --line,
// flex column pra rodapé com margin-top:auto). Mobile usa o mesmo
// SidebarContent dentro de um Sheet drawer (ver MobileHeader).
import { SidebarContent, type SidebarContentProps } from "./sidebar-content";

export type AdminSidebarProps = SidebarContentProps;

export function AdminSidebar(props: AdminSidebarProps) {
  return (
    <aside
      aria-label="Navegação principal"
      className="b3-side hidden lg:flex"
      data-admin-chrome="sidebar"
    >
      <SidebarContent {...props} />
    </aside>
  );
}
