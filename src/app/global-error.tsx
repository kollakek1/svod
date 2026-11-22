"use client";

import Link from "next/link";

/**
 * Последний рубеж: если упал корневой layout, глобальный CSS может не загрузиться.
 * Поэтому все стили — инлайновые, шрифты — системные, без картинок.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          background: "#f2eee4",
          color: "#14160f",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "ui-monospace, 'SFMono-Regular', Consolas, monospace",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#67695c",
            }}
          >
            СВОД · стоматология
          </p>
          <h1 style={{ margin: "20px 0 0", fontSize: "clamp(32px, 6vw, 56px)", lineHeight: 1.02, fontWeight: 400 }}>
            Сайт не загрузился
          </h1>
          <p style={{ margin: "20px 0 0", fontSize: 18, lineHeight: 1.55, color: "#4b4d42", maxWidth: 520 }}>
            Что-то сломалось на нашей стороне. Попробуйте открыть страницу заново — данные вашей записи не потеряны.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 52,
                padding: "0 28px",
                background: "#1e5b49",
                color: "#f8f4ea",
                border: "1px solid #1e5b49",
                borderRadius: 2,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Попробовать снова
            </button>
            <Link
              href="/"
              style={{
                minHeight: 52,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 28px",
                border: "1px solid #6f7164",
                borderRadius: 2,
                color: "#14160f",
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              На главную
            </Link>
          </div>
          <p style={{ marginTop: 32, fontSize: 14, color: "#67695c" }}>
            Телефон: <a href="tel:+74951201840" style={{ color: "#143f33" }}>+7 495 120-18-40</a>
          </p>
        </div>
      </body>
    </html>
  );
}
