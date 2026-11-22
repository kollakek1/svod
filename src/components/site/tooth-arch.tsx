import { cn } from "@/lib/utils";

/**
 * Схема зубных дуг по системе FDI.
 *
 * Геометрия: две отдельные полудуги (верхняя и нижняя), 16 сегментов в каждой.
 * Нумерация идёт от заднего моляра к центральному резцу и дальше на другую сторону:
 * верхняя — 18…11 / 21…28, нижняя — 48…41 / 31…38. Подписи не поворачиваются.
 */

interface ArchSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  start: number;
  end: number;
}

const UPPER: ArchSpec = { cx: 320, cy: 226, rx: 200, ry: 112, start: 181, end: 359 };
const LOWER: ArchSpec = { cx: 320, cy: 294, rx: 200, ry: 112, start: 1, end: 179 };

const GAP_DEG = 0.5;
const TEETH_PER_ARCH = 16;

const TOOTH_NAMES: Record<number, string> = {
  1: "центральный резец",
  2: "боковой резец",
  3: "клык",
  4: "первый премоляр",
  5: "второй премоляр",
  6: "первый моляр",
  7: "второй моляр",
  8: "зуб мудрости",
};

const UPPER_NUMBERS = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_NUMBERS = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/** Ширина зуба в «единицах» от моляра к резцу: моляры шире, резцы уже. */
const WIDTH_WEIGHTS = [1.14, 1.12, 1.06, 0.94, 0.9, 0.78, 0.8, 0.88];

function round(value: number) {
  return Number(value.toFixed(2));
}

function point(spec: ArchSpec, angleDeg: number, growth = 0) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: spec.cx + (spec.rx + growth) * Math.cos(angle),
    y: spec.cy + (spec.ry + growth) * Math.sin(angle),
  };
}

interface Tooth {
  key: string;
  number: number;
  name: string;
  path: string;
  label: { x: number; y: number };
}

function buildArch(spec: ArchSpec, numbers: number[]): Tooth[] {
  const fullWeights = [...WIDTH_WEIGHTS, ...[...WIDTH_WEIGHTS].reverse()];
  const total = fullWeights.reduce((sum, weight) => sum + weight, 0);
  const span = Math.abs(spec.end - spec.start) - GAP_DEG * (TEETH_PER_ARCH - 1);
  const direction = Math.sign(spec.end - spec.start);

  let cursor = spec.start;

  return numbers.map((number, index) => {
    const share = (fullWeights[index] / total) * span;
    const a0 = cursor;
    const a1 = cursor + share * direction;
    cursor = a1 + GAP_DEG * direction;

    const outerA = point(spec, a0);
    const outerB = point(spec, a1);
    const innerB = point(spec, a1, -48);
    const innerA = point(spec, a0, -48);

    const mid = (a0 + a1) / 2;
    /**
     * Передние зубы стоят плотно: подписи 11/12/21/22 и 31/32/41/42
     * накладываются друг на друга. В технических схемах это решают
     * «зигзагом» — соседние номера выносятся на разный радиус.
     */
    const zigzag = index >= 4 && index <= 11 && index % 2 === 0 ? 13 : 0;
    const label = point(spec, mid, 19 + zigzag);

    return {
      key: `tooth-${number}`,
      number,
      name: TOOTH_NAMES[number % 10] ?? "зуб",
      path: [
        `M ${round(outerA.x)} ${round(outerA.y)}`,
        `L ${round(outerB.x)} ${round(outerB.y)}`,
        `L ${round(innerB.x)} ${round(innerB.y)}`,
        `L ${round(innerA.x)} ${round(innerA.y)}`,
        "Z",
      ].join(" "),
      label: { x: round(label.x), y: round(label.y) },
    };
  });
}

const UPPER_TEETH = buildArch(UPPER, UPPER_NUMBERS);
const LOWER_TEETH = buildArch(LOWER, LOWER_NUMBERS);

export function ToothArch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 470"
      role="img"
      aria-label="Схема зубных дуг по системе FDI: 32 зуба, верхняя дуга 11–28, нижняя 31–48"
      className={cn("h-auto w-full", className)}
    >
      <g>
        {/* Осевые линии */}
        <line x1={UPPER.cx} y1="48" x2={LOWER.cx} y2="440" stroke="var(--color-line)" strokeDasharray="2 7" />
        <line
          x1={UPPER.cx - UPPER.rx - 46}
          y1="260"
          x2={UPPER.cx + UPPER.rx + 46}
          y2="260"
          stroke="var(--color-line)"
          strokeDasharray="2 7"
        />
        <text x="596" y="256" textAnchor="end" className="tooth-note">
          линия смыкания
        </text>

        {[...UPPER_TEETH, ...LOWER_TEETH].map((tooth) => (
          <g key={tooth.key}>
            <path
              d={tooth.path}
              className="tooth-shape"
              pathLength={1}
              style={{ "--stroke-len": 1 } as React.CSSProperties}
            >
              <title>{`${tooth.number} · ${tooth.name}`}</title>
            </path>
            <text
              x={tooth.label.x}
              y={tooth.label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="tooth-label"
            >
              {tooth.number}
            </text>
          </g>
        ))}

        {/* Размерные линии */}
        <g stroke="var(--color-line-strong)">
          <line x1={UPPER.cx - UPPER.rx} y1="448" x2={UPPER.cx + UPPER.rx} y2="448" />
          <line x1={UPPER.cx - UPPER.rx} y1="442" x2={UPPER.cx - UPPER.rx} y2="454" />
          <line x1={UPPER.cx + UPPER.rx} y1="442" x2={UPPER.cx + UPPER.rx} y2="454" />
        </g>
        <text x={UPPER.cx} y="464" textAnchor="middle" className="tooth-dim">
          56 MM
        </text>

        <g stroke="var(--color-line-strong)">
          <line x1="44" y1={UPPER.cy - UPPER.ry + 4} x2="44" y2={LOWER.cy + LOWER.ry - 4} />
          <line x1="38" y1={UPPER.cy - UPPER.ry + 4} x2="50" y2={UPPER.cy - UPPER.ry + 4} />
          <line x1="38" y1={LOWER.cy + LOWER.ry - 4} x2="50" y2={LOWER.cy + LOWER.ry - 4} />
        </g>
        <text
          x="32"
          y={(UPPER.cy - UPPER.ry + LOWER.cy + LOWER.ry) / 2}
          textAnchor="middle"
          className="tooth-dim"
          transform={`rotate(-90 32 ${(UPPER.cy - UPPER.ry + LOWER.cy + LOWER.ry) / 2})`}
        >
          44 MM
        </text>
      </g>
    </svg>
  );
}
