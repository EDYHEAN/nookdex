// Sends the week's report e-mail (docs/reports/<YYYY-MM-DD>.html, written by the Monday routine from
// docs/reports/mail-template.html) to contact@nookdex.com through Brevo, from contact@nookdex.com. Its <title> is the
// subject. Run by .github/workflows/report-mail.yml when such a file lands on main (BREVO_API_KEY: the site's key).
// Run: node scripts/report-mail.mjs [docs/reports/<date>.html] (default: the newest one)
import fs from "node:fs";

const TO = process.env.REPORT_TO || "contact@nookdex.com";
const file =
  process.argv[2] ||
  "docs/reports/" +
    fs
      .readdirSync("docs/reports")
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
      .sort()
      .at(-1);
if (!file || !fs.existsSync(file)) throw new Error("no report e-mail to send");

const html = fs.readFileSync(file, "utf8");
if (html.includes("{{")) throw new Error(`${file} still has blanks ({{…}}): not sent`);
const subject = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || `NookDex · rapport de la semaine`;

const r = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "api-key": process.env.BREVO_API_KEY ?? "", "Content-Type": "application/json", accept: "application/json" },
  body: JSON.stringify({ sender: { name: "NookDex", email: "contact@nookdex.com" }, to: [{ email: TO }], subject, htmlContent: html }),
});
if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
console.log(`sent ${file} to ${TO}: ${subject}`);
