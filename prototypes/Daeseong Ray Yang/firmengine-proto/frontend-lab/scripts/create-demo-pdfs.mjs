/** Rebuild fictional evidence fixtures. No input files, account data or API calls. */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const output = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo");
const fixedDate = new Date("2026-10-29T00:00:00.000Z");
const fixtures = {
  identity: [{ title: "Basic consultation record", rows: [["Applicant", "Demo Applicant (fictional)"], ["Reference period", "January - September 2026"], ["Monthly living cost - illustrative", "KRW 1,800,000"]] }],
  income: [
    { title: "Monthly income record", rows: [["Applicant", "Demo Applicant (fictional)"], ["Employer / payer", "Synthetic Demo Employer"], ["Reference period", "January - September 2026"], ["Monthly income", "KRW 4,500,000"]] },
    { title: "Monthly expense record", rows: [["Applicant", "Demo Applicant (fictional)"], ["Reference period", "January - September 2026"], ["Monthly expenses - illustrative", "KRW 300,000"], ["Related evidence", "Monthly income record, page 1"]] },
  ],
  debt: [{ title: "Synthetic debt balance record", rows: [["Creditor", "Synthetic Demo Bank"], ["Contract reference", "DEMO-LOAN-001"], ["Balance reference date", "2026-10-29"], ["Debt balance", "KRW 72,000,000"]] }],
  business: [{ title: "Synthetic business operation record", rows: [["Business", "Synthetic Demo Business"], ["Operator", "Demo Applicant (fictional)"], ["Monthly income", "KRW 4,500,000"], ["Monthly expenses", "KRW 300,000"], ["Reference period", "January - September 2026"]] }],
  asset: [{ title: "Synthetic asset inventory", rows: [["Owner", "Demo Applicant (fictional)"], ["Asset", "Synthetic example deposit"], ["Reference date", "2026-10-29"], ["Total assets", "KRW 3,000,000"]] }],
  "debt-alt": [{ title: "Alternative synthetic debt balance", rows: [["Creditor", "Synthetic Demo Bank"], ["Contract reference", "DEMO-LOAN-001"], ["Balance reference date", "2026-10-29"], ["Alternative debt balance", "KRW 84,000,000"], ["Review status", "Conflicts with debt.pdf; source selection required"]] }],
};

await mkdir(output, { recursive: true });
const manifest = { synthetic: true, source: "scripts/create-demo-pdfs.mjs", realClientData: false, generatedAt: fixedDate.toISOString(), fixtures: {} };
for (const [kind, pages] of Object.entries(fixtures)) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setTitle(`SYNTHETIC DEMO ONLY - ${kind}`);
  pdf.setAuthor("FirmEngine frontend-lab synthetic fixture generator");
  pdf.setSubject("Fictional UI evidence. Not an official record, a legal allowance, or real client data.");
  pdf.setKeywords(["synthetic", "demo", "fictional", "no real client data"]);
  pdf.setCreator("scripts/create-demo-pdfs.mjs"); pdf.setProducer("pdf-lib local synthetic fixture generator");
  pdf.setCreationDate(fixedDate); pdf.setModificationDate(fixedDate);
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pages.forEach((definition, index) => {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 770, width: 595.28, height: 71.89, color: rgb(.16, .2, .34) });
    page.drawText("SYNTHETIC DEMO EVIDENCE", { x: 42, y: 805, size: 16, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Fictional example - no real client information", { x: 42, y: 785, size: 10, font: regular, color: rgb(.85, .89, 1) });
    page.drawText(definition.title, { x: 42, y: 724, size: 19, font: bold, color: rgb(.16, .2, .34) });
    page.drawText(`Fixture: ${kind}.pdf / page ${index + 1} of ${pages.length}`, { x: 42, y: 700, size: 10, font: regular, color: rgb(.4, .44, .52) });
    definition.rows.forEach(([label, value], rowIndex) => {
      const y = 649 - rowIndex * 72;
      page.drawText(label, { x: 42, y, size: 11, font: regular, color: rgb(.4, .44, .52) });
      page.drawText(value, { x: 42, y: y - 24, size: value.startsWith("KRW") ? 18 : 12, font: value.startsWith("KRW") ? bold : regular, color: rgb(.17, .21, .32) });
      page.drawLine({ start: { x: 42, y: y - 37 }, end: { x: 553, y: y - 37 }, color: rgb(.86, .89, .94), thickness: .7 });
    });
    page.drawRectangle({ x: 42, y: 102, width: 511, height: 64, color: rgb(1, .96, .85) });
    page.drawText("DEMO ONLY - NOT AN ISSUED RECORD", { x: 55, y: 143, size: 12, font: bold, color: rgb(.55, .36, .08) });
    page.drawText("Amounts support local UI testing only. They are not verified legal inputs.", { x: 55, y: 123, size: 9, font: regular, color: rgb(.55, .36, .08) });
    page.drawText("Source: scripts/create-demo-pdfs.mjs | Generated locally without external services", { x: 42, y: 65, size: 8, font: regular, color: rgb(.45, .49, .56) });
    page.drawText(`${index + 1} / ${pages.length}`, { x: 515, y: 43, size: 9, font: regular, color: rgb(.45, .49, .56) });
  });
  const bytes = await pdf.save();
  await writeFile(resolve(output, `${kind}.pdf`), bytes);
  manifest.fixtures[kind] = { path: `/demo/${kind}.pdf`, pages: pages.length, synthetic: true, content: pages };
  console.log(`${kind}.pdf: ${pages.length} page(s), ${bytes.length} bytes`);
}
await writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
