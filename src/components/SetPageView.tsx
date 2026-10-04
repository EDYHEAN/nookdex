import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cardGallery, formatDate, num } from "@/lib/blog";
import { keyOf } from "@/lib/cardLang";
import { type PageLang, SET_PAGES_ROOT, setPageEntries } from "@/lib/setPath";
import { cardCount, money, setFaq, setPage, trendOf } from "@/lib/setPages";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { CardData } from "@/lib/types";
import blog from "./Blog.module.css";
import legal from "./LegalPage.module.css";
import { LegalPage } from "./LegalPage";
import styles from "./SetPages.module.css";

/**
 * One set's page, French cards (/extensions/<slug>) or English ones (/en/sets/<slug>): its cards, today's prices, the most
 * wanted ones, and a door to the desk. Written for the people who search "<set> card list" or "<set> prices".
 */
export const setPageParams = (lang: PageLang) => setPageEntries(lang).map((e) => ({ slug: e.slug }));

export async function setPageMetadata(lang: PageLang, slug: string): Promise<Metadata> {
  const p = await setPage(lang, slug);
  if (!p) return {};
  const fr = lang === "fr";
  const { n } = cardCount(p);
  const name = p.set.name;
  const best = p.top[0];
  const title = fr ? `${name} (${p.set.code}) : liste des cartes et prix · ${SITE_NAME}` : `${name} (${p.set.code}): card list and prices · ${SITE_NAME}`;
  const description = fr
    ? `Les ${n} cartes de ${name} (${p.set.serieName}${p.set.releaseDate ? `, ${p.set.releaseDate.slice(0, 4)}` : ""}) avec leur rareté et leur prix Cardmarket du jour.` +
      (best ? ` La plus chère : ${best.name} (${money(trendOf(best)!, p)}).` : "")
    : `All ${n} cards of ${name} (${p.set.serieName}${p.set.releaseDate ? `, ${p.set.releaseDate.slice(0, 4)}` : ""}) with their rarity and today's TCGplayer price.` +
      (best ? ` Most expensive: ${best.name} (${money(trendOf(best)!, p)}).` : "");
  const languages = { [lang]: p.path, ...(p.other ? { [p.other.lang]: p.other.path } : {}) };
  return {
    title,
    description,
    alternates: { canonical: p.path, languages },
    openGraph: {
      type: "website",
      url: p.path,
      siteName: SITE_NAME,
      title,
      description,
      locale: fr ? "fr_FR" : "en_GB",
      images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: SITE_NAME }],
    },
  };
}

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

export async function SetPageView({ lang, slug }: { lang: PageLang; slug: string }) {
  const p = await setPage(lang, slug);
  if (!p) notFound();
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const { n, official, beyond } = cardCount(p);
  const name = p.set.name;
  const day = formatDate(p.data.pricesUpdated.slice(0, 10), lang);
  const market = fr ? "Cardmarket" : "TCGplayer";
  const faq = setFaq(p);
  const url = `${SITE_URL}${p.path}`;
  const root = SET_PAGES_ROOT[lang];
  const logo = p.set.logo ? `${p.set.logo}.png` : null;
  /** "186/195": the number as printed on the card */
  const numOf = (c: CardData) => num(c, p.data);
  const gallery = await cardGallery(
    p.top.slice(0, 8).map((c) => keyOf(lang, c.id)),
    lang,
  );
  return (
    <LegalPage path={root} title={t(`${name} : liste des cartes et prix`, `${name}: card list and prices`)} en={!fr}>
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: fr ? SITE_URL : `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: t("Extensions", "Sets"), item: `${SITE_URL}${root}` },
          { "@type": "ListItem", position: 3, name, item: url },
        ],
      })}
      {ld({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: lang,
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })}

      <div className={styles.head}>
        {logo && (
          <img className={styles.logo} src={logo} alt={name} loading="lazy" />
        )}
        <dl className={styles.facts}>
          <div>
            <dt>{t("Code", "Code")}</dt>
            <dd>{p.set.code}</dd>
          </div>
          <div>
            <dt>{t("Série", "Series")}</dt>
            <dd>{p.set.serieName}</dd>
          </div>
          {p.set.releaseDate && (
            <div>
              <dt>{t("Sortie", "Released")}</dt>
              <dd>{formatDate(p.set.releaseDate, lang)}</dd>
            </div>
          )}
          <div>
            <dt>{t("Cartes", "Cards")}</dt>
            <dd>{beyond ? `${n} (${official} + ${beyond})` : n}</dd>
          </div>
          {p.priced > 0 && (
            <div>
              <dt>{t("Une de chaque", "One of each")}</dt>
              <dd>≈ {money(p.total, p)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className={blog.body}>
        <p>
          {fr ? (
            <>
              Les {n} cartes de <b>{name}</b>, extension de la série {p.set.serieName}
              {beyond ? ` (${official} numérotées et ${beyond} au-delà : cartes secrètes et séries spéciales)` : ""}, avec leur rareté et leur
              prix tendance Cardmarket, mis à jour le {day}. Les prix Cardmarket mélangent toutes les langues d&apos;impression de la carte.
            </>
          ) : (
            <>
              All {n} cards of <b>{name}</b>, a {p.set.serieName} set{beyond ? ` (${official} in the official numbering and ${beyond} beyond it: secret rares and special sub-sets)` : ""}, with
              their rarity and TCGplayer market price for English cards, updated {day}. Cards TCGplayer doesn&apos;t sell show
              Cardmarket&apos;s price, converted to dollars.
            </>
          )}
        </p>
        {p.other && (
          <p className={styles.other}>
            <Link href={p.other.path} hrefLang={p.other.lang}>
              {fr ? `EN · ${p.other.name}: the English cards and their TCGplayer prices` : `FR · ${p.other.name} : les cartes françaises et leurs prix Cardmarket`}
            </Link>
          </p>
        )}

        <p className={blog.cta}>
          <Link href={fr ? "/" : "/en"} className={legal.cta}>
            {t(`Coche tes cartes de ${name} sur le bureau ${SITE_NAME} ▶`, `Tick your ${name} cards on the ${SITE_NAME} desk ▶`)}
          </Link>
        </p>

        {gallery && (
          <>
            <h2>{t(`Les cartes les plus chères de ${name}`, `The most expensive ${name} cards`)}</h2>
            <div dangerouslySetInnerHTML={{ __html: gallery }} />
          </>
        )}

        {p.rarities.length > 1 && (
          <>
            <h2>{t("Les raretés", "Rarities")}</h2>
            <div className="blog-table">
              <table>
                <thead>
                  <tr>
                    <th>{t("Rareté", "Rarity")}</th>
                    <th>{t("Cartes", "Cards")}</th>
                    <th>{t("Valeur (une de chaque)", "Value (one of each)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.rarities.map((r) => (
                    <tr key={r.rarity}>
                      <td>{r.rarity}</td>
                      <td>{r.count}</td>
                      <td>{r.value ? money(r.value, p) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2>{t(`Liste des ${n} cartes de ${name}`, `All ${n} ${name} cards`)}</h2>
        <p className={styles.other}>{t(`Prix tendance ${market} du ${day}.`, `${market} market prices, ${day}.`)}</p>
        {/* every card with its scan: what people come to see (and what image search finds), loaded as the page scrolls */}
        <ul className={styles.cards}>
          {p.data.cards.map((c) => {
            const price = trendOf(c);
            const label = `${c.name} ${numOf(c)}`;
            return (
              <li key={c.id} className={styles.card}>
                {c.img ? (
                  <img src={`${c.img}/low.webp`} alt={`${label} · ${name}`} width={245} height={342} loading="lazy" decoding="async" />
                ) : (
                  // taken out by TCGdex for now (see CardBack in the binders)
                  <span className={styles.back}>{t("Bientôt de retour", "Back soon")}</span>
                )}
                <small>{numOf(c)}</small>
                <b>{c.name}</b>
                {c.rarity && <small>{c.rarity}</small>}
                <span className={styles.price}>{price != null ? money(price, p) : "—"}</span>
              </li>
            );
          })}
        </ul>

        <h2>{t("Questions fréquentes", "FAQ")}</h2>
        {faq.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>

      {p.posts.length > 0 && (
        <nav className={blog.more} aria-label={t("Sur le blog", "On the blog")}>
          <h2>{t("Sur le blog", "On the blog")}</h2>
          <ul className={blog.list}>
            {p.posts.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`} className={blog.note}>
                  <time dateTime={post.date}>{formatDate(post.date, post.lang)}</time>
                  <b>{post.title}</b>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {p.series.length > 0 && (
        <nav className={styles.series} aria-label={p.set.serieName}>
          <h2>{t(`Les autres extensions ${p.set.serieName}`, `Other ${p.set.serieName} sets`)}</h2>
          <ul>
            {p.series.map((s) => (
              <li key={s.path}>
                <Link href={s.path}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p>
        <Link href={root}>{t("← toutes les extensions", "← all sets")}</Link>
      </p>
    </LegalPage>
  );
}

/** Every set with a page, by series, newest first: the shelf of the set pages. */
export function SetIndexView({ lang }: { lang: PageLang }) {
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const series = new Map<string, { name: string; sets: { name: string; code: string; year: string; path: string; logo: string | null; total: number }[] }>();
  for (const e of setPageEntries(lang)) {
    const s = series.get(e.set.serie) ?? { name: e.set.serieName, sets: [] };
    s.sets.push({
      name: e.set.name,
      code: e.set.code,
      year: e.set.releaseDate?.slice(0, 4) ?? "",
      path: `${SET_PAGES_ROOT[lang]}/${e.slug}`,
      logo: e.set.logo ? `${e.set.logo}.png` : null,
      total: e.set.total,
    });
    series.set(e.set.serie, s);
  }
  return (
    <LegalPage path={SET_PAGES_ROOT[lang]} title={t("Les extensions du JCC Pokémon", "Pokémon TCG sets")} en={!fr}>
      <p>
        {fr
          ? "Chaque extension du JCC Pokémon en français : la liste de ses cartes, leur rareté et leur prix Cardmarket mis à jour chaque jour."
          : "Every Pokémon TCG set in English: its card list, rarities and TCGplayer prices, updated every day."}
      </p>
      <p>
        <Link href={fr ? "/en/sets" : "/extensions"} hrefLang={fr ? "en" : "fr"}>
          {fr ? "EN · The English sets and their TCGplayer prices" : "FR · Les extensions en français et leurs prix Cardmarket"}
        </Link>
      </p>
      {[...series.values()].map((s) => (
        <section key={s.name}>
          <h2>{s.name}</h2>
          <ul className={styles.grid}>
            {s.sets.map((set) => (
              <li key={set.path}>
                <Link href={set.path} className={styles.tile}>
                  {set.logo ? (
                    <img src={set.logo} alt="" loading="lazy" />
                  ) : (
                    <span className={styles.noLogo}>{set.code}</span>
                  )}
                  <b>{set.name}</b>
                  <small>
                    {set.code} · {set.year} · {set.total} {t("cartes", "cards")}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </LegalPage>
  );
}
