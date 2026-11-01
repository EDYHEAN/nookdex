import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/blog";
import { amazonOn, amazonSearch, inShops } from "@/lib/amazon";
import { KIND_LABEL, SHOP_PATH, boosterPics, byInterest, goLabel, productHref, productPic, shopOfSet, shortSetName } from "@/lib/amazonShop";
import { kindArt } from "@/lib/kindArt";
import { daysLeft } from "@/lib/parisTime";
import { daysUntil, type Release, releases } from "@/lib/releases";
import { SET_PAGES_ROOT, type PageLang } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { Countdown } from "./shop/Countdown";
import { Affiliate, AmazonButton, KindTiles, ProductRail, Stage } from "./shop/ShopBits";
import { ShopHero } from "./shop/ShopHero";
import { StickyBuy } from "./shop/StickyBuy";
import s from "./shop/Shop.module.css";
import { WidePage } from "./WidePage";

/**
 * The release calendar: French page /calendrier-des-sorties, English one /en/release-calendar (hreflang twins). A shop page
 * (« Sous la lampe », WidePage shop, drawn without the room): the next set in the hero with its countdown and its products.
 */
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

  // the hero: the next set (the latest once it's out), its products, the countdown (« Sous la lampe », Johan 2026-10-31)
  const heroSet = nextSet ?? lastSet;
  const coming = !!nextSet && heroSet === nextSet;
  const group = heroSet?.setId ? shopOfSet(heroSet.setId) : undefined;
  const top = fr && group ? byInterest(group.products)[0] : undefined;
  const heroName = heroSet ? shortSetName(heroSet.name) : "";
  const series = heroSet && /\s?:\s/.test(heroSet.name) ? heroSet.name.split(/\s?:\s/)[0] : null;
  const longDay = (d: string) =>
    day(d).toLocaleDateString(fr ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const heroHref = !heroSet || !amazonOn(lang)
    ? null
    : top && group
      ? productHref(top, "calendrier")
      : amazonSearch(fr ? `Pokémon ${heroSet.name}` : `Pokemon TCG ${heroName}`, "calendrier", lang);
  const heroLabel = top ? goLabel(top, coming) : coming ? t("Voir les précommandes", "See pre-orders on Amazon") : t("Voir sur Amazon", "See it on Amazon");
  const pic = top && group ? productPic(top, group) : null;
  // the set's French boosters on the French page only: the English one draws the box (Johan, 2026-10-31: no French
  // packaging on the English pages)
  const fan = group && fr ? boosterPics(group) : [];
  const thumb = pic ?? fan[0] ?? null;
  const days = heroSet ? daysUntil(heroSet.date) : 0;
  const heroPost = heroSet?.post;

  const hero = heroSet && (
    <ShopHero
      head={
        <>
          <h1 className={s.eyebrow}>{t("Calendrier des sorties du JCC Pokémon", "Pokémon TCG release calendar")}</h1>
          {/* a set out already (the hero shows the latest once the next is out): its logo, in the page's language */}
          {heroSet.logo && <img className={s.setLogo} src={heroSet.logo} alt="" />}
          <p className={s.big}>{heroName}</p>
          <p className={s.when}>
            {coming ? t("Prochaine sortie", "Next release") : t("Dernière sortie", "Latest release")}
            {series && ` · ${series}`}
            {heroSet.code && ` · ${heroSet.code}`} · <b>{longDay(heroSet.date)}</b>
          </p>
          {coming && days > 0 && <Countdown day={heroSet.date} days={daysLeft(heroSet.date)} lang={lang} />}
        </>
      }
      stage={
        <Stage pic={pic} kind={top?.kind ?? (fan.length ? null : "etb")} fan={fan} alt={t(`Boosters ${heroName}`, `${heroName} Elite Trainer Box`)} />
      }
      buy={
        <>
          {top && (
            <p className={s.what}>
              <b>{top.name}</b>
              {/* its kind, unless its name says it */}
              {!top.name.startsWith(KIND_LABEL[top.kind]) && ` · ${KIND_LABEL[top.kind]}`}
            </p>
          )}
          <div className={s.btns}>
            {heroHref && (
              <AmazonButton id="hero-cta" href={heroHref} place="calendrier" size="lg" nudge>
                {heroLabel}
              </AmazonButton>
            )}
            {heroPost && (
              <Link prefetch={false} href={`/blog/${heroPost}`} className={`${s.btn} ${s.alt}`}>
                {t("Lire le guide", "Read the guide")}
              </Link>
            )}
          </div>
          <ul className={s.reassure}>
            <li>{t("Date officielle, avec sa source", "Official date, with its source")}</li>
            {group && fr && <li>Sur invitation, au prix public</li>}
            <li>{t("Vérifie « Expédié et vendu par Amazon »", "Check “Ships from and sold by Amazon”")}</li>
          </ul>
          {heroHref && <Affiliate lang={lang} />}
        </>
      }
    />
  );

  /** a set out this past year, on its own shelf (logo, date, page, Amazon); the rest (events, Japan) as a list */
  const shelf = past.filter((r) => r.region === "intl" && r.kind === "set" && r.href);
  const others = past.filter((r) => !shelf.includes(r));

  return (
    <WidePage
      en={!fr}
      shop={CALENDAR_PATH[lang]}
      alt={{ href: CALENDAR_PATH[fr ? "en" : "fr"], label: fr ? "the Pokémon TCG release calendar in English" : "le calendrier des sorties en français" }}
      crumbs={[{ href: CALENDAR_PATH[lang], label: t("Calendrier des sorties", "Release calendar") }]}
      hero={hero}
    >
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
      {/* no hero (nothing coming, nothing out this year): the page's title on the paper */}
      {!hero && <h1>{t("Calendrier des sorties du JCC Pokémon", "Pokémon TCG release calendar")}</h1>}

      {/* the answer first: what "prochaine sortie pokemon" looks for, in one sentence */}
      {nextSet && (
        <p className={s.answer}>
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
        )}
      </p>

      {!upcoming.length && (
        <>
          <h2>{t("À venir", "Coming up")}</h2>
          <p>{t("Rien d'annoncé officiellement pour l'instant.", "Nothing officially announced yet.")}</p>
        </>
      )}
      {months.map((m) => (
        <section key={m.key}>
          <h2 className={s.month}>{ofMonth(m.label)}</h2>
          <ol className={s.events}>
            {m.items.map((r) => {
              const d = daysUntil(r.date);
              const g = shopOf(r);
              // its boosters and boxes on Amazon (lib/amazon): amazon.fr's products as cards on the French page (a search
              // while none is known), amazon.com searches by kind on the English one
              const onAmazon = amazonOn(lang) && r.region === "intl" && r.kind !== "event";
              return (
                <li key={r.date + r.name} className={s.ev} id={r.setId ? `sortie-${r.setId}` : undefined}>
                  <time className={s.date} dateTime={r.date}>
                    <small>{day(r.date).toLocaleDateString(fr ? "fr-FR" : "en-GB", { month: "short", timeZone: "UTC" })}</small>
                    <b>{day(r.date).getUTCDate()}</b>
                    <i>{day(r.date).getUTCFullYear()}</i>
                  </time>
                  <div>
                    <p className={s.tags}>
                      <span className={`${s.tag} ${r.kind === "set" ? s.tagSet : ""}`}>{kind(r)}</span>
                      <span className={s.tag}>{region(r)}</span>
                      <span className={`${s.tag} ${s.tagSoon}`}>
                        {d === 0 ? t("aujourd'hui !", "today!") : d === 1 ? t("demain", "tomorrow") : t(`dans ${d} jours`, `in ${d} days`)}
                      </span>
                    </p>
                    <h3>{r.name}</h3>
                    {r.note && <p>{r.note}</p>}
                    <p className={s.links}>
                      {r.post && <Link prefetch={false} href={`/blog/${r.post}`}>{t("Lire le guide →", "Read the guide →")}</Link>}
                      {r.source && (
                        <a href={r.source} target="_blank" rel="noopener">
                          {t("Source officielle", "Official source")} ↗
                        </a>
                      )}
                      {g && (
                        <Link prefetch={false} href={`${SHOP_PATH}#${g.id}`}>
                          Toutes les invitations {shortSetName(g.name)} →
                        </Link>
                      )}
                    </p>
                    {onAmazon && g && <ProductRail group={g} place="calendrier" max={4} />}
                    {onAmazon && !g && !fr && r.kind === "set" && <KindTiles name={shortSetName(r.name)} place="calendrier" soon />}
                    {onAmazon && !g && (fr || r.kind !== "set") && (
                      <div className={s.btns}>
                        <AmazonButton href={amazonSearch(fr ? `Pokémon ${r.name}` : `Pokemon TCG ${r.name}`, "calendrier", lang)} place="calendrier" alt>
                          {t("Voir les précommandes", "See pre-orders on Amazon")}
                        </AmazonButton>
                        <Affiliate lang={lang} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <h2 className={s.month}>{t("Sorties de l'année", "This past year")}</h2>
      {shelf.length > 0 && (
        <>
          <ul className={s.shelf}>
            {shelf.map((r) => (
              <li key={r.date + r.name}>
                <Link prefetch={false} href={r.href!} className={s.logo}>
                  {r.logo ? <img src={r.logo} alt={r.name} loading="lazy" /> : r.name}
                </Link>
                <small>
                  <time dateTime={r.date}>{formatDate(r.date, lang)}</time>
                  {r.post && (
                    <>
                      {" · "}
                      <Link prefetch={false} href={`/blog/${r.post}`}>{t("le guide", "the guide")}</Link>
                    </>
                  )}
                </small>
                {amazonOn(lang) && inShops(r.date) && (
                  <AmazonButton href={amazonSearch(fr ? `Pokémon ${r.name}` : `Pokemon TCG ${r.name}`, "calendrier", lang)} place="calendrier" size="sm" alt>
                    {t("Sur Amazon", "On Amazon")}
                  </AmazonButton>
                )}
              </li>
            ))}
          </ul>
          {amazonOn(lang) && <Affiliate lang={lang} many />}
        </>
      )}
      {others.length > 0 && (
        <ul className={s.others}>
          {others.map((r) => (
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
      )}

      {faq.length > 0 && (
        <section className={s.faq} data-sticky-stop>
          <h2>{t("Questions fréquentes", "FAQ")}</h2>
          {faq.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </section>
      )}

      <p className={s.small}>
        {t(`Calendrier mis à jour le ${formatDate(updated, "fr")}.`, `Calendar updated ${formatDate(updated, "en")}.`)}{" "}
        <Link prefetch={false} href={SET_PAGES_ROOT[lang]}>{t("Toutes les extensions et leurs prix →", "Every set and its prices →")}</Link>
      </p>

      {heroSet && heroHref && (
        <StickyBuy
          target="hero-cta"
          href={heroHref}
          place="calendrier-bar"
          thumb={thumb ? <img src={thumb.src} width={thumb.w} height={thumb.h} alt="" loading="lazy" /> : <span dangerouslySetInnerHTML={{ __html: kindArt("etb") }} />}
          title={coming ? t(`${heroName} · J-${days}`, `${heroName} · in ${days} days`) : heroName}
          sub={coming ? t(`Sort le ${formatDate(heroSet.date, "fr")}`, `Out ${formatDate(heroSet.date, "en")}`) : t("Sur Amazon", "On Amazon")}
          label={coming ? t("Précommandes", "Pre-orders") : top?.asin ? "L'invitation" : t("Sur Amazon", "On Amazon")}
        />
      )}
    </WidePage>
  );
}
