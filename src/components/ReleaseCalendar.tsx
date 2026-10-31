import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/blog";
import { affiliateLabel, amazonOn, amazonSearch } from "@/lib/amazon";
import { SHOP_PATH, shopOfSet } from "@/lib/amazonShop";
import { daysUntil, type Release, releases } from "@/lib/releases";
import { SET_PAGES_ROOT, type PageLang } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { LegalPage } from "./LegalPage";
import { ShopShelf } from "./ShopShelf";
import legal from "./LegalPage.module.css";
import styles from "./ReleaseCalendar.module.css";

/** The release calendar: French page /calendrier-des-sorties, English one /en/release-calendar (hreflang twins). */
export const CALENDAR_PATH: Record<PageLang, string> = { fr: "/calendrier-des-sorties", en: "/en/release-calendar" };

export function calendarMetadata(lang: PageLang): Metadata {
  const fr = lang === "fr";
  const year = new Date().getFullYear();
  const next = releases(lang).upcoming.find((r) => r.kind === "set" && r.region === "intl");
  // what people search ("prochaine sortie pokemon", "next pokemon set"), answered in the title and the snippet (weekly
  // report, 2026-10-17: the page showed for those, from position 50 on)
  const title = fr ? `Prochaine sortie Pokémon JCC : calendrier ${year}-${year + 1} · ${SITE_NAME}` : `Next Pokémon TCG set: release calendar ${year}-${year + 1} · ${SITE_NAME}`;
  const description = fr
    ? `${next ? `Prochaine extension Pokémon : ${next.name}, le ${formatDate(next.date, "fr")}. ` : ""}Toutes les sorties du JCC Pokémon (extensions, coffrets, avant-premières) en France et au Japon, mois par mois.`
    : `${next ? `Next Pokémon TCG set: ${next.name}, out ${formatDate(next.date, "en")}. ` : ""}Every Pokémon TCG release (sets, products, prereleases) worldwide and in Japan, month by month.`;
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
  /** a coming set's products on Amazon (French page only: the affiliate tag pays on amazon.fr) */
  const shopOf = (r: Release) => (fr && r.region === "intl" && r.setId ? shopOfSet(r.setId) : undefined);
  const region = (r: Release) => (r.region === "jp" ? t("Japon", "Japan") : t("France et monde", "Worldwide"));
  const day = (d: string) => new Date(`${d}T12:00:00Z`);
  const nextSet = upcoming.find((r) => r.kind === "set" && r.region === "intl");
  const lastSet = past.find((r) => r.kind === "set" && r.region === "intl");
  /** what comes first, if it isn't the next set (a prerelease, a product) */
  const sooner = upcoming.find((r) => r !== nextSet && (!nextSet || r.date < nextSet.date));
  // the coming releases by month ("Sorties Pokémon de novembre 2026": what "sortie novembre pokemon" looks for)
  const monthOf = (d: string) => day(d).toLocaleDateString(fr ? "fr-FR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const months = [...new Set(upcoming.map((r) => r.date.slice(0, 7)))].map((m) => ({ key: m, label: monthOf(`${m}-15`), items: upcoming.filter((r) => r.date.startsWith(m)) }));
  const ofMonth = (label: string) => (fr ? `Sorties Pokémon ${/^[aeiouy]/i.test(label) ? "d'" : "de "}${label}` : `Pokémon TCG releases in ${label}`);
  const listed = (rs: Release[]) => rs.map((r) => `${r.name} (${formatDate(r.date, lang)})`).join(fr ? " ; " : "; ");
  const nextYear = Number(new Date().getUTCFullYear()) + 1;
  const ofNextYear = upcoming.filter((r) => r.date.startsWith(String(nextYear)));
  const faq = [
    nextSet && {
      q: t("Quelle est la prochaine extension Pokémon ?", "What is the next Pokémon TCG set?"),
      a: t(
        `${nextSet.name}, qui sort le ${formatDate(nextSet.date, "fr")} en France (dans ${daysUntil(nextSet.date)} jours).`,
        `${nextSet.name}, out on ${formatDate(nextSet.date, "en")} (in ${daysUntil(nextSet.date)} days).`,
      ),
    },
    upcoming.length > 1 && {
      q: t("Quelles sont les prochaines sorties Pokémon ?", "What are the next Pokémon TCG releases?"),
      a: t(`Dans l'ordre : ${listed(upcoming.slice(0, 4))}.`, `In order: ${listed(upcoming.slice(0, 4))}.`),
    },
    ...months.slice(0, 2).map((m) => ({
      q: t(`Que sort-il en ${m.label} pour le JCC Pokémon ?`, `What comes out in ${m.label} for the Pokémon TCG?`),
      a: listed(m.items) + ".",
    })),
    {
      q: t(`Quelles extensions Pokémon sortent en ${nextYear} ?`, `Which Pokémon TCG sets come out in ${nextYear}?`),
      a: ofNextYear.length
        ? t(`Déjà annoncé : ${listed(ofNextYear)}.`, `Announced so far: ${listed(ofNextYear)}.`)
        : t(
            `Rien n'est encore annoncé officiellement pour ${nextYear}. Ce calendrier est mis à jour dès l'annonce de The Pokémon Company.`,
            `Nothing is officially announced for ${nextYear} yet. This calendar is updated as soon as The Pokémon Company announces it.`,
          ),
    },
    lastSet && {
      q: t("Quelle est la dernière extension Pokémon sortie ?", "What is the latest Pokémon TCG set?"),
      a: t(`${lastSet.name}, sortie le ${formatDate(lastSet.date, "fr")}.`, `${lastSet.name}, released on ${formatDate(lastSet.date, "en")}.`),
    },
    {
      q: t("Les extensions japonaises sortent-elles aussi en France ?", "Do Japanese sets come out in English too?"),
      a: t(
        "Oui, en général quelques mois plus tard, parfois regroupées dans une seule extension internationale. Ce calendrier montre les deux.",
        "Yes, usually a few months later, sometimes merged into one international set. This calendar shows both.",
      ),
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

      {/* the answer first: what "prochaine sortie pokemon" looks for, in one sentence */}
      {nextSet && (
        <p className={styles.answer}>
          <b>{t("En bref", "In short")}</b>
          {t("La prochaine extension Pokémon en France : ", "The next Pokémon TCG set: ")}
          <strong>{nextSet.name}</strong>
          {t(`, le ${formatDate(nextSet.date, "fr")} (dans ${daysUntil(nextSet.date)} jours).`, `, out ${formatDate(nextSet.date, "en")} (in ${daysUntil(nextSet.date)} days).`)}
          {sooner && t(` Avant elle : ${sooner.name}, le ${formatDate(sooner.date, "fr")}.`, ` Before it: ${sooner.name}, on ${formatDate(sooner.date, "en")}.`)}
          <small>{t(`Mis à jour le ${formatDate(updated, "fr")}.`, `Updated ${formatDate(updated, "en")}.`)}</small>
        </p>
      )}
      <p>
        {t(
          "Les prochaines extensions, coffrets et avant-premières du JCC Pokémon, en France et au Japon, mois par mois : seulement ce qui est annoncé officiellement, avec sa source.",
          "The next Pokémon TCG sets, products and prereleases, worldwide and in Japan, month by month: only what has been officially announced, with its source.",
        )}{" "}
        <Link prefetch={false} href={CALENDAR_PATH[fr ? "en" : "fr"]} hrefLang={fr ? "en" : "fr"}>
          {fr ? "EN · In English" : "FR · En français"}
        </Link>
      </p>
      {fr && (
        <p>
          <Link prefetch={false} href={SHOP_PATH} className={legal.cta}>
            Les invitations Amazon du moment ▶
          </Link>
        </p>
      )}

      {!upcoming.length && (
        <>
          <h2>{t("À venir", "Coming up")}</h2>
          <p>{t("Rien d'annoncé officiellement pour l'instant.", "Nothing officially announced yet.")}</p>
        </>
      )}
      {months.map((m) => (
        <section key={m.key}>
          <h2>{ofMonth(m.label)}</h2>
          <ol className={styles.upcoming}>
            {m.items.map((r) => {
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
                  <p className={styles.links}>
                    {r.post && <Link prefetch={false} href={`/blog/${r.post}`}>{t("Lire le guide →", "Read the guide →")}</Link>}
                    {/* its boosters and boxes to preorder (Amazon affiliate, lib/amazon: amazon.fr, amazon.com on the English page),
                        as cards below once known (French page) */}
                    {amazonOn(lang) && r.region === "intl" && r.kind !== "event" && !shopOf(r) && (
                      <span>
                        <a
                          href={amazonSearch(fr ? `Pokémon ${r.name}` : `Pokemon TCG ${r.name}`, "calendrier", lang)}
                          target="_blank"
                          rel="sponsored noopener"
                          data-amazon-place="calendrier"
                        >
                          {t("Voir les précommandes ↗", "See pre-orders on Amazon ↗")}
                        </a>{" "}
                        <small className={styles.affiliate}>{affiliateLabel(lang)}</small>
                      </span>
                    )}
                    {r.source && (
                      <a className={styles.source} href={r.source} target="_blank" rel="noopener">
                        {t("Source", "Source")} ↗
                      </a>
                    )}
                  </p>
                </div>
                {shopOf(r) && (
                  <div className={styles.shop}>
                    <ShopShelf group={shopOf(r)!} place="calendrier" max={4} />
                  </div>
                )}
              </li>
            );
          })}
          </ol>
        </section>
      ))}

      <h2>{t("Sorties de l'année", "This past year")}</h2>
      <ul className={styles.past}>
        {past.map((r) => (
          <li key={r.date + r.name}>
            <time dateTime={r.date}>{formatDate(r.date, lang)}</time>
            <span>
              {r.href ? <Link prefetch={false} href={r.href}>{r.name}</Link> : r.name}
              {r.code && <small> · {r.code}</small>}
              {r.post && (
                <small>
                  {" · "}
                  <Link prefetch={false} href={`/blog/${r.post}`}>{t("le guide", "the guide")}</Link>
                </small>
              )}
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
        <Link prefetch={false} href={SET_PAGES_ROOT[lang]}>{t("Toutes les extensions et leurs prix →", "Every set and its prices →")}</Link>
      </p>
    </LegalPage>
  );
}
