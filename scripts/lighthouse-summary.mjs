import fs from "node:fs";

const file = process.argv[2] ?? ".artifacts/lighthouse-mobile.json";
const report = JSON.parse(fs.readFileSync(file, "utf8"));

console.log("URL:", report.finalDisplayedUrl, "| form factor:", report.configSettings.formFactor);
for (const [key, category] of Object.entries(report.categories)) {
  console.log(`${key}: ${Math.round((category.score ?? 0) * 100)}`);
}

const metrics = ["largest-contentful-paint", "first-contentful-paint", "cumulative-layout-shift", "total-blocking-time", "speed-index", "interactive"];
for (const id of metrics) {
  const audit = report.audits[id];
  if (audit) console.log(`${id}: ${audit.displayValue ?? audit.numericValue}`);
}

console.log("\nTop opportunities:");
for (const [id, audit] of Object.entries(report.audits)) {
  if (audit.details?.type === "opportunity" && (audit.numericValue ?? 0) > 50) {
    console.log(`- ${id}: ${audit.displayValue ?? Math.round(audit.numericValue)}`);
  }
}

console.log("\nFailed audits (score < 1, weight > 0):");
for (const [key, category] of Object.entries(report.categories)) {
  for (const ref of category.auditRefs) {
    const audit = report.audits[ref.id];
    if (!audit) continue;
    if (audit.score !== null && audit.score < 1 && ref.weight > 0 && !["notApplicable", "manual"].includes(audit.scoreDisplayMode)) {
      console.log(`- [${key}] ${ref.id}: ${Math.round(audit.score * 100)} — ${audit.title}`);
    }
  }
}
