import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/blog";
import { type CardPage, cardFaq, cardPage } from "@/lib/cardPages";
import { money } from "@/lib/setPages";
import { type PageLang, SET_PAGES_ROOT } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import blog from "./Blog.module.css";
import legal from "./LegalPage.module.css";
import { LegalPage } from "./LegalPage";
import styles from "./CardPage.module.css";

/**
 * One card's page (lib/cardPages): its scan, today's price on its market (each version), its curve since early October,
 * the same Pokémon in the other sets, a door to the desk. Written for « <card> <number> prix » / « <card> price ».
 */

export async function cardPageMetadata(lang: PageLang, set: string, slug: string): Promise<Metadata> {
  const p = await cardPage(lang, set, slug);
  if (!p) return {};
  const fr = lang === "fr";
  const { card } = p;
  const price = p.prices[0]?.trend;
  const title = fr
    ? `${card.name} ${p.printed} (${p.set.name}) : prix et cote · ${SITE_NAME}`
    : `${card.name} ${p.printed} (${p.set.name}): price and value · ${SITE_NAME}`;
  const description = fr
    ? `${card.name} ${p.printed}, ${p.set.name}${card.rarity ? ` (${card.rarity})` : ""} : ${price != null ? `${money(price, p)} au prix tendance Cardmarket du jour` : "son prix Cardmarket"}, sa courbe de prix et ses versions.`
    : `${card.name} ${p.printed}, ${p.set.name}${card.rarity ? ` (${card.rarity})` : ""}: ${price != null ? `${money(price, p)} at today's TCGplayer market price` : "its TCGplayer price"}, its price history and versions.`;
  const languages = { [lang]: p.path, ...(p.other ? { [p.other.lang]: p.other.path } : {}) };
  return {
    title,
    description,
    alternates: { canonical: p.path, languages },
    // a card taken out by TCGdex (shown as a card back): not worth a search result until it's back
    robots: card.unavailable ? { index: false } : undefined,
    openGraph: {
      type: "website",
      url: p.path,
      siteName: SITE_NAME,
      title,
      description,
      locale: fr ? "fr_FR" : "en_GB",
      images: card.img ? [{ url: `${card.img}/high.webp`, width: 600, height: 825, alt: `${card.name} ${p.printed}` }] : undefined,
    },
  };
}

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

/** The trend day by day: a line, the first and last prices, the extremes (server drawn, no script) */
function Curve({ p }: { p: CardPage }) {
  const pts = p.history;
  if (pts.length < 2) return null;
  const [W, H, L, R, T, B] = [640, 220, 8, 8, 28, 34];
  const t0 = Date.parse(pts[0].day), t1 = Date.parse(pts.at(-1)!.day);
  const vs = pts.map((x) => x.v);
  const lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo || hi * 0.1) * 0.2;
  const X = (d: string) => L + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const up = vs.at(-1)! >= vs[0];
  const color = up ? "#3d8b2f" : "#b8433d";
  const line = pts.map((x, i) => `${i ? "L" : "M"}${X(x.day).toFixed(1)},${Y(x.v).toFixed(1)}`).join(" ");
  const label = (x: { day: string; v: number }, anchor: "start" | "end") => (
    <text x={X(x.day) + (anchor === "start" ? 2 : -2)} y={Y(x.v) - 12} textAnchor={anchor} fill={color} fontSize="16">
      {money(x.v, p)}
    </text>
  );
  return (
    <figure className={styles.curve}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.lang === "fr" ? "Courbe du prix tendance" : "Market price history"}>
        {[0.25, 0.5, 0.75].map((k) => (
          <line key={k} x1={L} x2={W - R} y1={T + k * (H - T - B)} y2={T + k * (H - T - B)} stroke="currentColor" strokeOpacity=".12" strokeDasharray="4 6" />
        ))}
        <path d={line} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((x) => (
          <circle key={x.day} cx={X(x.day)} cy={Y(x.v)} r="3.5" fill={color} />
        ))}
        {label(pts[0], "start")}
        {label(pts.at(-1)!, "end")}
        <text x={L} y={H - 8} fontSize="15" fill="currentColor" opacity=".6">
          {formatDate(pts[0].day, p.lang)}
        </text>
        <text x={W - R} y={H - 8} fontSize="15" fill="currentColor" opacity=".6" textAnchor="end">
          {formatDate(pts.at(-1)!.day, p.lang)}
        </text>
      </svg>
    </figure>
  );
}

export async function CardPageView({ lang, set, slug }: { lang: PageLang; set: string; slug: string }) {
  const p = await cardPage(lang, set, slug);
  if (!p) notFound();
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const { card } = p;
  const market = fr ? "Cardmarket" : "TCGplayer";
  const day = formatDate(p.data.pricesUpdated.slice(0, 10), lang);
  const faq = cardFaq(p);
  const url = `${SITE_URL}${p.path}`;
  const root = SET_PAGES_ROOT[lang];
  return (
    <LegalPage path={root} title={`${card.name} ${p.printed}`} en={!fr}>
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: fr ? SITE_URL : `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: t("Extensions", "Sets"), item: `${SITE_URL}${root}` },
          { "@type": "ListItem", position: 3, name: p.set.name, item: `${SITE_URL}${p.setPath}` },
          { "@type": "ListItem", position: 4, name: `${card.name} ${p.printed}`, item: url },
        ],
      })}
      {ld({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: lang,
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })}

      <p className={styles.crumbs}>
        <Link href={p.setPath}>
          {p.set.name} ({p.set.code})
        </Link>
        {card.rarity ? ` · ${card.rarity}` : ""}
      </p>

      <div className={styles.top}>
        <div className={styles.scan}>
          {card.img ? (
            <img src={`${card.img}/high.webp`} alt={`${card.name} ${p.printed} · ${p.set.name}`} width={600} height={825} />
          ) : (
            <span className={styles.back}>{t("Bientôt de retour", "Back soon")}</span>
          )}
        </div>
        <div className={styles.sheet}>
          {p.prices.length ? (
            <dl className={styles.prices}>
              {p.prices.map((x) => (
                <div key={x.label}>
                  <dt>{x.label}</dt>
                  <dd>
                    <b>{x.trend != null ? money(x.trend, p) : "—"}</b>
                    {x.low != null && <small>{t(`dès ${money(x.low, p)}`, `from ${money(x.low, p)}`)}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={styles.none}>{t(`Pas en vente sur ${market} en ce moment.`, `Not for sale on ${market} right now.`)}</p>
          )}
          {p.move != null && (
            <p className={p.move > 0 ? styles.up : styles.down}>
              {p.move > 0 ? "↗" : "↘"} {t(`${Math.round(p.move)} % sur la semaine, comparée au mois`, `${Math.round(p.move)}% this week against the month`)}
            </p>
          )}
          <p className={styles.small}>
            {t(`Prix tendance ${market} du ${day}${fr ? ", toutes langues d'impression confondues" : ""}.`, `${market} market price, ${day}.`)}
          </p>
          <p className={blog.cta}>
            <Link href={fr ? "/" : "/en"} className={legal.cta}>
              {t(`Suis la cote de ta collection sur ${SITE_NAME} ▶`, `Track your collection's value on ${SITE_NAME} ▶`)}
            </Link>
          </p>
          {p.other && (
            <p className={styles.small}>
              <Link href={p.other.path} hrefLang={p.other.lang}>
                {fr ? `EN · ${card.name}: the English card and its TCGplayer price` : `FR · ${card.name} : la carte française et son prix Cardmarket`}
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className={blog.body}>
        {p.history.length >= 2 && (
          <>
            <h2>{t(`La cote de ${card.name}, jour après jour`, `${card.name}'s price, day by day`)}</h2>
            <Curve p={p} />
          </>
        )}

        {p.same.length > 0 && (
          <>
            <h2>{t(`Les autres cartes ${card.name}`, `Other ${card.name} cards`)}</h2>
            <ul className={styles.same}>
              {p.same.map((s) => (
                <li key={s.path}>
                  <Link href={s.path}>
                    <img src={`${s.img}/low.webp`} alt={`${s.name} ${s.num} · ${s.set}`} width={245} height={342} loading="lazy" decoding="async" />
                    <small>{s.set}</small>
                    <b>{s.trend != null ? money(s.trend, p) : "—"}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2>{t("Questions fréquentes", "FAQ")}</h2>
        {faq.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>

      <nav className={styles.walk} aria-label={p.set.name}>
        {p.prev ? <Link href={p.prev.path}>← {p.prev.name}</Link> : <span />}
        <Link href={p.setPath}>{t(`toutes les cartes de ${p.set.name}`, `every ${p.set.name} card`)}</Link>
        {p.next ? <Link href={p.next.path}>{p.next.name} →</Link> : <span />}
      </nav>
    </LegalPage>
  );
}
