import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Layout do grupo (auth). Não adiciona chrome — cada página usa <AuthCard>
 * para controlar layout. Apenas marca essas rotas como noindex.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
