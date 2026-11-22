/**
 * Подготовка исходных PNG к публикации: кроп под нужные пропорции и WebP.
 * Запуск: node scripts/prepare-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const jobs = [
  { src: "images/hero-enamel.png", out: "images/hero-enamel.webp", width: 1024, height: 1280 },
  { src: "images/clinic-interior.png", out: "images/clinic-interior.webp", width: 1600, height: 1067 },
  { src: "images/clinic-instruments.png", out: "images/clinic-instruments.webp", width: 1200, height: 900 },
  { src: "images/clinic-detail.png", out: "images/clinic-detail.webp", width: 900, height: 900 },
  { src: "images/team/anna-kovaleva.png", out: "images/team/anna-kovaleva.webp", width: 1000, height: 1250 },
  { src: "images/team/ilya-gordeev.png", out: "images/team/ilya-gordeev.webp", width: 1000, height: 1250 },
  { src: "images/team/marina-shtein.png", out: "images/team/marina-shtein.webp", width: 1000, height: 1250 },
  { src: "images/team/timur-aslanov.png", out: "images/team/timur-aslanov.webp", width: 1000, height: 1250 },
  { src: "images/team/polina-eremina.png", out: "images/team/polina-eremina.webp", width: 1000, height: 1250 },
];

for (const job of jobs) {
  const src = path.join(root, "public", job.src);
  const out = path.join(root, "public", job.out);
  if (!fs.existsSync(src)) {
    console.warn(`skip: ${job.src} not found`);
    continue;
  }

  await sharp(src)
    .resize(job.width, job.height, { fit: "cover", position: "attention" })
    .webp({ quality: 82, effort: 6 })
    .toFile(out);

  const size = fs.statSync(out).size;
  console.log(`${job.out} — ${job.width}×${job.height}, ${(size / 1024).toFixed(0)} KB`);
  fs.unlinkSync(src);
}
