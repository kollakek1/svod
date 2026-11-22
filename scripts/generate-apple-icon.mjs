/**
 * Растеризует `src/app/apple-icon.png` (180×180) из того же знака, что в `icon.svg`.
 *
 * Запуск: `node scripts/generate-apple-icon.mjs`
 * Нужен только при изменении знака: сам PNG лежит в репозитории.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/app/apple-icon.png");

// Костяной фон и зелёная арка: на домашнем экране знак должен дышать,
// поэтому поля больше, чем у фавикона, а линии толще.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#F2EEE4"/>
  <g fill="none" stroke="#1E5B49" stroke-width="6.5" stroke-linecap="square">
    <path d="M42 144V83a48 48 0 0 1 96 0v61"/>
    <path d="M67.4 144V96"/>
    <path d="M112.6 144V96"/>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);

const meta = await sharp(png).metadata();
console.log(`apple-icon.png: ${meta.width}×${meta.height}, ${(png.length / 1024).toFixed(1)} KB`);
