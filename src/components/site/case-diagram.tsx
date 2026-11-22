import { cn } from "@/lib/utils";

type CaseDiagramVariant = "veneer" | "endo" | "implant";

const CROWN = "M30 104C25 86 23 68 27 53C32 35 45 26 60 26C75 26 88 35 93 53C97 68 95 86 90 104";
const DENTIN = "M41 100C37 84 36 68 39 56C43 42 50 36 60 36C70 36 77 42 81 56C84 68 83 84 79 100";

/**
 * Абстрактный разрез зуба для кейсов: только линии и один акцентный элемент.
 * Схема декоративная — смысл несёт текст карточки, поэтому aria-hidden.
 */
export function CaseDiagram({ variant, className }: { variant: CaseDiagramVariant; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("h-auto w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" strokeLinecap="square" strokeLinejoin="miter">
        <line x1="60" y1="14" x2="60" y2="116" stroke="var(--color-line)" strokeDasharray="2 5" />

        {variant === "veneer" ? (
          <>
            <path d={CROWN} stroke="var(--color-line-strong)" strokeWidth="1" />
            <path d={DENTIN} stroke="var(--color-line)" strokeWidth="1" />
            <path
              d="M30 104C25 86 23 68 27 53C32 35 45 26 60 26"
              stroke="var(--color-accent-text)"
              strokeWidth="3"
            />
            <path d="M30 104L41 100" stroke="var(--color-accent-text)" strokeWidth="1" />
            <path d="M60 26L60 36" stroke="var(--color-accent-text)" strokeWidth="1" />
          </>
        ) : null}

        {variant === "endo" ? (
          <>
            <path d={CROWN} stroke="var(--color-line-strong)" strokeWidth="1" />
            <path d={DENTIN} stroke="var(--color-line)" strokeWidth="1" />
            <path
              d="M52 48C52 44 55 42 60 42C65 42 68 44 68 48V60C68 64 65 66 60 66C55 66 52 64 52 60Z"
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
            <path d="M48 100C47 106 45 111 41 115" stroke="var(--color-line-strong)" strokeWidth="1" />
            <path d="M72 100C73 106 75 111 79 115" stroke="var(--color-line-strong)" strokeWidth="1" />
            <path d="M60 60V74C60 86 55 96 48 103" stroke="var(--color-accent-text)" strokeWidth="2" />
            <path d="M60 74C62 86 66 96 72 103" stroke="var(--color-accent-text)" strokeWidth="1.5" />
            <circle cx="48" cy="105" r="1.6" fill="var(--color-accent-text)" stroke="none" />
            <circle cx="72" cy="105" r="1.6" fill="var(--color-accent-text)" stroke="none" />
          </>
        ) : null}

        {variant === "implant" ? (
          <>
            <path
              d="M33 68C27 56 26 44 30 36C35 25 46 20 60 20C74 20 85 25 90 36C94 44 93 56 87 68Z"
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
            <path d="M52 68H68V75H52Z" stroke="var(--color-line-strong)" strokeWidth="1" />
            <path d="M49 75H71L66 114H54Z" stroke="var(--color-accent-text)" strokeWidth="1.5" />
            <path d="M51 83H69" stroke="var(--color-accent-text)" strokeWidth="1" />
            <path d="M52 91H68" stroke="var(--color-accent-text)" strokeWidth="1" />
            <path d="M53 99H67" stroke="var(--color-accent-text)" strokeWidth="1" />
            <path d="M54 107H66" stroke="var(--color-accent-text)" strokeWidth="1" />
          </>
        ) : null}
      </g>
    </svg>
  );
}
