import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/blog";
import { daysUntil, type Release, releases } from "@/lib/releases";
import { SET_PAGES_ROOT, type PageLang } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { LegalPage } from "./LegalPage";
import styles from "./ReleaseCalendar.module.css";

/** The release calendar: French page /calendrier-des-sorties, English one /en/release-calendar (hreflang twins). */
export const CALENDAR_PATH: Record<PageLang, string> = { fr: "/calendrier-des-sorties", en: "/en/release-calendar" };

export function calendarMetadata(lang: PageLang): Metadata {
  const fr = lang === "fr";
  const year = new Date().getFullYear();
  const next = releases(lang).upcoming.find((r) => r.kind === "set" && r.region === "intl");
  const title = fr ? `Calendrier des sorties Pokémon JCC ${year}-${year + 1} · ${SITE_NAME}` : `Pokémon TCG release calendar ${year}-${year + 1} · ${SITE_NAME}`;
  const description = fr
    ? `Les prochaines sorties du JCC Pokémon (extensions, coffrets, avant-premières) en France et au Japon${next ? `, avec ${next.name} le ${formatDate(next.date, "fr")}` : ""}, et les extensions de l'année.`
    : `Upcoming Pokémon TCG releases (sets, products, prereleases) worldwide and in Japan${next ? `, with ${next.name} on ${formatDate(next.date, "en")}` : ""}, and this year's sets.`;
  return {
    title,
    description,
    alternates: { canonical: CALENDAR_PATH[lang], languages: { fr: CALENDAR_PATH.fr, en: CALENDAR_PATH.en } },
    openGraph: { type: "website", url: CALENDAR_PATH[lang], siteName: SITE_NAME, title, description, locale: fr ? "fr_FR" : "en_GB" },
  };
}

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

export function ReleaseCalendar({ lang }: { lang: PageLang }) {
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const { upcoming, past, updated } = releases(lang);
  const kind = (r: Release) =>
    r.kind === "set" ? t("Extension", "Set") : r.kind === "product" ? t("Coffret", "Product") : t("Événement", "Event");
  const region = (r: Release) => (r.region === "jp" ? t("Japon", "Japan") : t("France et monde", "Worldwide"));
  const day = (d: string) => new Date(`${d}T12:00:00Z`);
  const nextSet = upcoming.find((r) => r.kind === "set" && r.region === "intl");
  const lastSet = past.find((r) => r.kind === "set" && r.region === "intl");
  const faq = [
    nextSet && {
      q: t("Quelle est la prochaine extension Pokémon ?", "What is the next Pokémon TCG set?"),
      a: t(
        `${nextSet.name}, qui sort le ${formatDate(nextSet.date, "fr")} en France.`,
        `${nextSet.name}, out on ${formatDate(nextSet.date, "en")}.`,
      ),
    },
    lastSet && {
      q: t("Quelle est la dernière extension Pokémon sortie ?", "What is the latest Pokémon TCG set?"),
      a: t(`${lastSet.name}, sortie le ${formatDate(lastSet.date, "fr")}.`, `${lastSet.name}, released on ${formatDate(lastSet.date, "en")}.`),
    },
  ].filter(Boolean) as { q: string; a: string }[];

  return (
    <LegalPage path={CALENDAR_PATH[lang]} title={t("Calendrier des sorties du JCC Pokémon", "Pokémon TCG release calendar")} en={!fr}>
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: fr ? SITE_URL : `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: t("Calendrier des sorties", "Release calendar"), item: `${SITE_URL}${CALENDAR_PATH[lang]}` },
        ],
      })}
      {faq.length > 0 &&
        ld({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        })}

      <p>
        {t(
          "Les prochaines extensions, coffrets et avant-premières du JCC Pokémon, en France et au Japon : seulement ce qui est annoncé officiellement, avec sa source.",
          "The next Pokémon TCG sets, products and prereleases, worldwide and in Japan: only what has been officially announced, with its source.",
        )}{" "}
        <Link href={CALENDAR_PATH[fr ? "en" : "fr"]} hrefLang={fr ? "en" : "fr"}>
          {fr ? "EN · In English" : "FR · En français"}
        </Link>
      </p>

      <h2>{t("À venir", "Coming up")}</h2>
      {upcoming.length ? (
        <ol className={styles.upcoming}>
          {upcoming.map((r) => {
            const d = daysUntil(r.date);
            return (
              <li key={r.date + r.name} className={styles.item}>
                <time className={styles.leaf} dateTime={r.date}>
                  <small>{day(r.date).toLocaleDateString(fr ? "fr-FR" : "en-GB", { month: "short" })}</small>
                  <b>{day(r.date).getUTCDate()}</b>
                  <small>{day(r.date).getUTCFullYear()}</small>
                </time>
                <div>
                  <p className={styles.tags}>
                    <span className={styles[r.kind]}>{kind(r)}</span>
                    <span>{region(r)}</span>
                    <span className={styles.count}>{d === 0 ? t("aujourd'hui !", "today!") : d === 1 ? t("demain", "tomorrow") : t(`dans ${d} jours`, `in ${d} days`)}</span>
                  </p>
                  <h3>{r.name}</h3>
                  {r.note && <p>{r.note}</p>}
                  {r.source && (
                    <a className={styles.source} href={r.source} target="_blank" rel="noopener">
                      {t("Source", "Source")} ↗
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p>{t("Rien d'annoncé officiellement pour l'instant.", "Nothing officially announced yet.")}</p>
      )}

      <h2>{t("Sorties de l'année", "This past year")}</h2>
      <ul className={styles.past}>
        {past.map((r) => (
          <li key={r.date + r.name}>
            <time dateTime={r.date}>{formatDate(r.date, lang)}</time>
            <span>
              {r.href ? <Link href={r.href}>{r.name}</Link> : r.name}
              {r.code && <small> · {r.code}</small>}
            </span>
            <small>
              {kind(r)} · {region(r)}
            </small>
          </li>
        ))}
      </ul>

      {faq.length > 0 && (
        <>
          <h2>{t("Questions fréquentes", "FAQ")}</h2>
          {faq.map((f) => (
            <div key={f.q}>
              <h3 className={styles.q}>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </>
      )}

      <p className={styles.updated}>
        {t(`Calendrier mis à jour le ${formatDate(updated, "fr")}.`, `Calendar updated ${formatDate(updated, "en")}.`)}{" "}
        <Link href={SET_PAGES_ROOT[lang]}>{t("Toutes les extensions et leurs prix →", "Every set and its prices →")}</Link>
      </p>
    </LegalPage>
  );
}
