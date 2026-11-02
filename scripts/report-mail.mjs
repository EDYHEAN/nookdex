// Sends the week's report e-mail (docs/reports/<YYYY-MM-DD>.html, written by the Monday routine from
// docs/reports/mail-template.html) to contact@nookdex.com through Brevo, from contact@nookdex.com. Its <title> is the
// subject. Run by .github/workflows/report-mail.yml when such a file lands on main (BREVO_API_KEY: the site's key).
// The shop's sales and the tips are put in only here, read from Stripe (scripts/report-money.mjs): the repo is public.
// So is the list of Amazon products still waiting for their page (scripts/report-amazon.mjs).
// Run: node scripts/report-mail.mjs [docs/reports/<date>.html] (default: the newest one)
import fs from "node:fs";
import { moneyBlock, withMoney } from "./report-money.mjs";
import { amazonBlock } from "./report-amazon.mjs";

// REPORT_TO (a secret: addresses, comma separated) adds a straight address: on 2026-11-02 the mail to contact@ bounced at
// ImprovMX, Brevo's shared IP being on SpamCop's list that morning (« 551 5.7.1 Your IP is black listed »)
const TO = ["contact@nookdex.com", ...(process.env.REPORT_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean)];
const file =
  process.argv[2] ||
  "docs/reports/" +
    fs
      .readdirSync("docs/reports")
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
      .sort()
      .at(-1);
if (!file || !fs.existsSync(file)) throw new Error("no report e-mail to send");

let html = fs.readFileSync(file, "utf8");
if (html.includes("{{")) throw new Error(`${file} still has blanks ({{…}}): not sent`);
html = withMoney(html, await moneyBlock());
// then the Amazon products still on a search (their /dp/ link is for Johan to find: amazon.fr turns robots away)
html = withMoney(html, amazonBlock());
const subject = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || `NookDex · rapport de la semaine`;

const r = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "api-key": process.env.BREVO_API_KEY ?? "", "Content-Type": "application/json", accept: "application/json" },
  body: JSON.stringify({ sender: { name: "NookDex", email: "contact@nookdex.com" }, to: [...new Set(TO)].map((email) => ({ email })), subject, htmlContent: html }),
});
if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
console.log(`sent ${file} to ${TO.length} address(es): ${subject}`);
