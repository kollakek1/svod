/**
 * Переносит демонстрационные записи в Postgres (Neon) — для задеплоенного демо.
 *
 * Запуск: node scripts/seed-demo-postgres.mjs
 * Берёт DATABASE_URL из окружения или из .env.local.
 * Читает .data/bookings.json (создаётся scripts/seed-demo-bookings.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

function readEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return env;
}

const local = readEnvLocal();
const url = process.env.DATABASE_URL ?? local.DATABASE_URL;
if (!url) {
  console.error("Нет DATABASE_URL — сначала `vercel env pull .env.local`");
  process.exit(1);
}

const bookingsFile = path.join(process.cwd(), ".data", "bookings.json");
if (!fs.existsSync(bookingsFile)) {
  console.error("Нет .data/bookings.json — запустите node scripts/seed-demo-bookings.mjs");
  process.exit(1);
}

const bookings = JSON.parse(fs.readFileSync(bookingsFile, "utf8"));
const sql = neon(url);

await sql`CREATE TABLE IF NOT EXISTS documents (
  name text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;

await sql`
  INSERT INTO documents (name, value, updated_at)
  VALUES ('bookings', ${JSON.stringify(bookings)}::jsonb, now())
  ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
`;

console.log(`В Postgres записано ${bookings.length} демонстрационных записей.`);
