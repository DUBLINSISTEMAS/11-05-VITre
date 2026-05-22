import { cn } from "@/lib/utils";

export interface MangoIconProps {
  className?: string;
}

/**
 * Brand mark Mangos Pay — manga estilizada com folha verde escura.
 * SVG inline (~1KB) escala perfeito, sem HTTP. Cores hardcoded pra
 * preservar identidade independente do tema do contêiner (cards,
 * sidebar tops, etc).
 *
 * Use `className` pra ajustar tamanho (default size-5 = 20px).
 */
export function MangoIcon({ className }: MangoIconProps) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={cn("h-5 w-5", className)}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="mangoIconFill"
          x1="34"
          y1="24"
          x2="90"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F8C84E" />
          <stop offset="1" stopColor="#F6B73C" />
        </linearGradient>
      </defs>
      <path
        d="M58.3 23.7C76.1 16.7 96.8 25.1 101.8 44.8C107.1 65.5 93 91.3 70.6 101.2C50.7 110 30.1 103.2 23.7 87.4C17.9 73.1 25.5 58.6 36.6 51.7C37.8 40.8 46.1 28.5 58.3 23.7Z"
        fill="url(#mangoIconFill)"
        stroke="#0F5A3C"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path
        d="M39 40C45.5 31.7 55.7 26.3 66 25.5"
        stroke="#FFF8E8"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M80.5 21.2C86.2 6.8 104.2 5.6 117 15.8C111 30.8 94.5 35.3 80.5 21.2Z"
        fill="#174D44"
      />
    </svg>
  );
}
