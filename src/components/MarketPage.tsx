import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/blog";
import { cardPagePath } from "@/lib/cardPages";
import { publicJson } from "@/lib/setFiles";
import { SET_PAGES_ROOT, type PageLang } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { LegalPage } from "./LegalPage";
import cal from "./ReleaseCalendar.module.css";
import styles from "./MarketPage.module.css";

/** The market page: French cards on Cardmarket (/marche), English ones on TCGplayer (/en/market), hreflang twins. */
export const MARKET_PATH: Record<PageLang, string> = { fr: "/marche", en: "/en/market" };

interface Move {
  id: string;
  name: string;
  num: string;
  set: string;
  /** a set of the current series (me, sv, swsh): the old ones are listed apart */
  recent?: boolean;
  setName: string;
  img: string;
  price: number;
  m7?: number;
  d7?: number;
  m30?: number;
  d30?: number;
}
interface Market {
  updated: string;
  days: number;
  currency: "EUR" | "USD";
  up7: Move[];
  down7: Move[];
  up30: Move[];
  down30: Move[];
  /** the same lists for the current series only (scripts/market-moves.mjs) */
  recent?: { up7: Move[]; down7: Move[]; up30: Move[]; down30: Move[] };
}

/** shown per list, and in the old cards' corner */
const SHOWN = 12;
const SHOWN_OLD = 6;
/**
 * Beyond this, an old card's week is left out of the page: Cardmarket's trend of an old card sold a few times a month jumps on
 * one sale (Aligatueur Neo +464 % on 2026-10-23), which says nothing about the market. Still in public/market for the posts.
 */
const NOISE = 250;

const market = (lang: PageLang) => publicJson<Market>("market", `${lang}.json`);

export function marketMetadata(lang: PageLang): Metadata {
  const fr = lang === "fr";
  const title = fr ? `Cartes Pokémon qui montent et qui chutent cette semaine · ${SITE_NAME}` : `Pokémon cards rising and falling this week · ${SITE_NAME}`;
  const description = fr
    ? "Les cartes Pokémon dont la cote Cardmarket a le plus monté et le plus baissé en 7 jours, mises à jour chaque jour."
    : "The Pokémon cards whose TCGplayer market price rose and fell the most in 7 days, updated every day.";
  return {
    title,
    description,
    alternates: { canonical: MARKET_PATH[lang], languages: { fr: MARKET_PATH.fr, en: MARKET_PATH.en } },
    openGraph: { type: "website", url: MARKET_PATH[lang], siteName: SITE_NAME, title, description, locale: fr ? "fr_FR" : "en_GB" },
  };
}

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

export async function MarketPage({ lang }: { lang: PageLang }) {
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const data = await market(lang);
  const money = (n: number) =>
    data?.currency === "USD" ? `$${n.toFixed(2)}` : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const pct = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(Math.round(n))}${fr ? " " : ""}%`;
  // the current series first (what players collect today); the old cards apart, their one-sale jumps left out
  const up = (data?.recent?.up7 ?? data?.up7 ?? []).slice(0, SHOWN);
  const down = (data?.recent?.down7 ?? data?.down7 ?? []).slice(0, SHOWN);
  const old = (list: Move[] | undefined) => (list ?? []).filter((m) => m.recent === false && Math.abs(m.m7 ?? 0) <= NOISE).slice(0, SHOWN_OLD);
  const oldUp = old(data?.up7);
  const oldDown = old(data?.down7);
  const top = up[0];
  const bottom = down[0];
  const source = fr ? "Cardmarket" : "TCGplayer";

  const faq = [
    top && {
      q: t("Quelle carte Pokémon a le plus monté cette semaine ?", "Which Pokémon card rose the most this week?"),
      a: t(
        `${top.name} (${top.setName}, ${top.num}) : ${pct(top.m7 ?? 0)} en 7 jours, à ${money(top.price)} sur Cardmarket.`,
        `${top.name} (${top.setName}, ${top.num}): ${pct(top.m7 ?? 0)} in 7 days, at ${money(top.price)} on TCGplayer.`,
      ),
    },
    bottom && {
      q: t("Quelle carte Pokémon a le plus baissé cette semaine ?", "Which Pokémon card fell the most this week?"),
      a: t(
        `${bottom.name} (${bottom.setName}, ${bottom.num}) : ${pct(bottom.m7 ?? 0)} en 7 jours, à ${money(bottom.price)} sur Cardmarket.`,
        `${bottom.name} (${bottom.setName}, ${bottom.num}): ${pct(bottom.m7 ?? 0)} in 7 days, at ${money(bottom.price)} on TCGplayer.`,
      ),
    },
    {
      q: t("D'où viennent ces prix ?", "Where do these prices come from?"),
      a: t(
        "De la tendance Cardmarket de chaque carte, relevée chaque jour. Cardmarket mélange toutes les langues d'impression d'une carte. Seules les cartes à 1 € ou plus comptent, pour que quelques centimes ne fassent pas des +100 %.",
        "From each card's TCGplayer market price (English cards), recorded every day. Only cards at $1 or more count, so a few cents don't make +100 %.",
      ),
    },
  ].filter((f): f is { q: string; a: string } => !!f);

  const list = (moves: Move[]) => (
    <ol className={styles.grid}>
      {moves.map((m) => {
        const href = cardPagePath(lang, m.set, m);
        const body = (
          <>
            <img src={`${m.img}/low.webp`} alt={`${m.name} ${m.num}`} loading="lazy" width={120} height={167} />
            <b className={(m.m7 ?? 0) >= 0 ? styles.up : styles.down}>
              {(m.m7 ?? 0) >= 0 ? "↗" : "↘"} {pct(m.m7 ?? 0)}
            </b>
            <span>{m.name}</span>
            <small>
              {m.setName} · {m.num}
            </small>
            <small className={styles.price}>{money(m.price)}</small>
          </>
        );
        return <li key={m.id}>{href ? <Link prefetch={false} href={href}>{body}</Link> : body}</li>;
      })}
    </ol>
  );

  return (
    <LegalPage path={MARKET_PATH[lang]} title={t("Le marché de la semaine", "This week's market")} en={!fr}>
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: fr ? SITE_URL : `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: t("Marché", "Market"), item: `${SITE_URL}${MARKET_PATH[lang]}` },
        ],
      })}
      {faq.length > 0 &&
        ld({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        })}

      {!data ? (
        <p>{t("Les cotes de la semaine arrivent : reviens demain.", "This week's prices are on their way: come back tomorrow.")}</p>
      ) : (
        <>
          {top && bottom && (
            <p className={cal.answer}>
              <b>{t("En bref", "In short")}</b>
              {t("Cette semaine, ", "This week, ")}
              <strong>{top.name}</strong> ({top.setName}) {t("monte de", "rose")} {pct(top.m7 ?? 0)}
              {t(" et ", " and ")}
              <strong>{bottom.name}</strong> ({bottom.setName}) {t("baisse de", "fell")} {pct(bottom.m7 ?? 0)}.
              <small>{t(`Cotes ${source} du ${formatDate(data.updated, "fr")}.`, `${source} prices of ${formatDate(data.updated, "en")}.`)}</small>
            </p>
          )}
          <p>
            {t(
              "Les cartes Pokémon dont la cote a le plus bougé en 7 jours, d'après la tendance Cardmarket relevée chaque jour. Les cartes à moins de 1 € n'y sont pas : quelques centimes de plus ne font pas une hausse.",
              "The Pokémon cards whose price moved the most in 7 days, from the TCGplayer market price recorded every day (English cards). Cards under $1 are left out: a few cents more isn't a rise.",
            )}{" "}
            <Link prefetch={false} href={MARKET_PATH[fr ? "en" : "fr"]} hrefLang={fr ? "en" : "fr"}>
              {t("English cards (TCGplayer) →", "Cartes françaises (Cardmarket) →")}
            </Link>
          </p>

          <h2>{t("Ça monte ↗", "Rising ↗")}</h2>
          {up.length ? list(up) : <p>{t("Rien de notable cette semaine.", "Nothing notable this week.")}</p>}
          <h2>{t("Ça chute ↘", "Falling ↘")}</h2>
          {down.length ? list(down) : <p>{t("Rien de notable cette semaine.", "Nothing notable this week.")}</p>}

          {(oldUp.length > 0 || oldDown.length > 0) && (
            <>
              <h2>{t("Les anciennes (Wizards)", "The old ones (Wizards era)")}</h2>
              <p>
                {t(
                  "Les cartes des années 2000 se vendent peu : une seule vente fait bouger leur cote. À prendre avec des pincettes.",
                  "The early-2000s cards sell rarely: one sale moves their price. Take these with a pinch of salt.",
                )}
              </p>
              {oldUp.length > 0 && list(oldUp)}
              {oldDown.length > 0 && list(oldDown)}
            </>
          )}

          <p className={styles.cta}>
            {t("Suis la cote de tes propres cartes, chaque jour, sur ton bureau.", "Follow your own cards' prices, every day, on your desk.")}{" "}
            <Link prefetch={false} href={fr ? "/" : "/en"}>{t("Ouvrir mon bureau ▶", "Open my desk ▶")}</Link>
          </p>

          <h2>{t("Questions fréquentes", "FAQ")}</h2>
          {faq.map((f) => (
            <div key={f.q}>
              <h3 className={cal.q}>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}

          <p className={cal.updated}>
            {t(
              `Prix ${source}, mis à jour le ${formatDate(data.updated, "fr")}. Les prix Cardmarket mélangent toutes les langues d'impression de la carte.`,
              `${source} prices, updated ${formatDate(data.updated, "en")}.`,
            )}{" "}
            <Link prefetch={false} href={SET_PAGES_ROOT[lang]}>{t("Toutes les extensions et leurs prix →", "Every set and its prices →")}</Link>
          </p>
        </>
      )}
    </LegalPage>
  );
}
