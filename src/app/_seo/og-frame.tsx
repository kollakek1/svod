import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/** Размер кадра один для OG и Twitter: 1200×630 не режется ни одной соцсетью. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

const BG = "#F2EEE4";
const INK = "#14160F";
const GREEN = "#1E5B49";
const MUTED = "#67695C";
const GRID = "rgba(20, 22, 15, 0.10)";
const LINE = "rgba(20, 22, 15, 0.18)";

/** Локальные TTF: без них satori рисует кириллицу квадратами. Лежат в /public, чтобы попадать в деплой. */
const FONTS_DIR = join(process.cwd(), "public/fonts");

export const OG_FONTS = [
  {
    name: "Spectral",
    data: readFileSync(join(FONTS_DIR, "Spectral-Regular.ttf")),
    style: "normal" as const,
    weight: 400 as const,
  },
  {
    name: "Golos",
    data: readFileSync(join(FONTS_DIR, "GolosText-Regular.ttf")),
    style: "normal" as const,
    weight: 400 as const,
  },
];

const GRID_STEP = 96;
const verticals = Array.from({ length: Math.floor(1200 / GRID_STEP) - 1 }, (_, i) => (i + 1) * GRID_STEP);
const horizontals = Array.from({ length: Math.floor(630 / GRID_STEP) }, (_, i) => (i + 1) * GRID_STEP);

/** Кадр превью: костяная бумага, чертёжная сетка, арка и обещание. */
export function OgFrame() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: BG,
        fontFamily: "Golos",
        color: INK,
        padding: "62px 76px 56px",
      }}
    >
      {/* Чертёжная сетка: 1px, шаг 96 */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex" }}>
        {verticals.map((x) => (
          <div
            key={`v${x}`}
            style={{ position: "absolute", top: 0, left: x, width: 1, height: 630, background: GRID }}
          />
        ))}
        {horizontals.map((y) => (
          <div
            key={`h${y}`}
            style={{ position: "absolute", top: y, left: 0, width: 1200, height: 1, background: GRID }}
          />
        ))}
      </div>

      {/* Верхняя метка */}
      <div style={{ display: "flex", alignItems: "center", height: 22 }}>
        <div style={{ fontSize: 17, letterSpacing: "3.1px", color: MUTED, textTransform: "uppercase" }}>
          СВОД · СТОМАТОЛОГИЯ СОХРАНЕНИЯ
        </div>
      </div>

      {/* Центр: обещание слева, арка справа */}
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 720 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Spectral",
              fontSize: 96,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            <div style={{ display: "flex" }}>Ваши зубы —</div>
            <div style={{ display: "flex" }}>на всю жизнь.</div>
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 25, lineHeight: 1.4, color: MUTED, width: 560 }}>
            Лечим под микроскопом ×25 и не меняем то, что можно сохранить.
          </div>
        </div>

        {/* Арка: контур 1.5px, внутри увеличение */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            width: 250,
            height: 318,
            border: `1.5px solid ${GREEN}`,
            borderBottom: "none",
            borderRadius: "125px 125px 0 0",
            paddingBottom: 34,
            marginRight: 26,
            marginTop: 12,
          }}
        >
          <div style={{ display: "flex", fontFamily: "Spectral", fontSize: 86, lineHeight: 1, color: GREEN, letterSpacing: "-0.02em" }}>
            ×25
          </div>
        </div>
      </div>

      {/* Нижняя линия и адрес */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", width: 1048, height: 1, background: LINE }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 20,
            fontSize: 17,
            letterSpacing: "2.6px",
            color: MUTED,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>МОСКВА · ХАМОВНИКИ · СВОД.DENTAL</div>
          <div style={{ display: "flex" }}>+7 495 120-18-40</div>
        </div>
      </div>
    </div>
  );
}

export function ogImageResponse() {
  return new ImageResponse(<OgFrame />, { ...OG_SIZE, fonts: OG_FONTS });
}
