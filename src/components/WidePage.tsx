import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import shopStyles from "./shop/Shop.module.css";
import styles from "./WidePage.module.css";

/** the shop pages' tabs (the notebook's, for the pages drawn wide): [French, English] address, "": none */
const SHOP_TABS = [
  { href: ["/extensions", "/en/sets"], label: ["Extensions", "Sets"] },
  { href: ["/calendrier-des-sorties", "/en/release-calendar"], label: ["Sorties", "Releases"] },
  { href: ["/invitations-amazon", ""], label: ["Invitations", ""] },
  { href: ["/marche", "/en/market"], label: ["Marché", "Market"] },
  { href: ["/blog", "/blog"], label: ["Blog", "Blog"] },
] as const;
/** the footer says them in full (the tabs are short) */
const FOOT_LABEL: Record<string, string> = {
  "/extensions": "Toutes les extensions",
  "/en/sets": "All sets",
  "/calendrier-des-sorties": "Calendrier des sorties",
  "/en/release-calendar": "Release calendar",
  "/invitations-amazon": "Invitations Amazon",
};

/**
 * A full-width page over the room (the card pages, Johan 2026-10-18: a way in from search engines must be wide, clear
 * and readable for someone who has never seen the desk): a bar with the brand and « Ouvrir mon bureau », the content
 * on plain paper, readable type for the text (the pixel fonts for titles and prices), and what NookDex is at the end.
 * The room stays mounted underneath (app/(desk)/layout): the bar's button opens it without a reload.
 *
 * `shop` (the Amazon pages, Johan 2026-10-31, « Sous la lampe »): drawn without the room behind (lib/roomless), a night bar
 * with « Mon bureau » and the notebook's tabs, a full-width `hero` above the content, NookDex's own buttons green.
 *
 * `alt`: the same page in the other language, the bar's « FR | EN » switch (Johan, 2026-11-01: a line of text under the
 * green button was one call too many). Letters, never flags: a language isn't a country, and the English page isn't a
 * translation (English cards, TCGplayer dollars). It stays a real link with hreflang, on every such page, so search
 * engines still walk from one twin to the other (on top of the hreflang in <head>); its label says what's there.
 */
export function WidePage({
  en = false,
  crumbs,
  shop,
  alt,
  hero,
  children,
}: {
  en?: boolean;
  crumbs: { href: string; label: string }[];
  /** the page's path: its tab is up */
  shop?: string;
  /** the twin page, and what it holds in its own language ("the English card and its TCGplayer price"); none: no switch */
  alt?: { href: string; label: string } | null;
  hero?: ReactNode;
  children: ReactNode;
}) {
  const t = (fr: string, english: string) => (en ? english : fr);
  const home = t("/", "/en");
  const here = en ? "en" : "fr";
  const there = en ? "fr" : "en";
  const code = (l: string) => l.toUpperCase();
  // in the order FR, EN whichever page it is: the switch doesn't move under the thumb from one twin to the other
  const langSwitch = alt && (
    <nav className={styles.lang} aria-label={t("Langue de la page", "Page language")}>
      {(["fr", "en"] as const).map((l) =>
        l === here ? (
          <span key={l} lang={l} className={styles.langOn} aria-current="true">
            {code(l)}
          </span>
        ) : (
          <Link key={l} prefetch={false} href={alt.href} hrefLang={there} lang={there} aria-label={`${code(there)} · ${alt.label}`} title={alt.label}>
            {code(l)}
          </Link>
        ),
      )}
    </nav>
  );
  return (
    <div className={shop ? `${styles.page} ${styles.shopPage} ${shopStyles.shop}` : styles.page}>
      <header className={styles.bar}>
        <Link prefetch={false} href={home} className={styles.brand}>
          <img src="/email/warwick.png" alt="" width={40} height={40} />
          <span>{SITE_NAME}</span>
        </Link>
        <nav className={styles.crumbs} aria-label={t("Fil d'Ariane", "Breadcrumb")}>
          {crumbs.map((c, i) => (
            <span key={c.href}>
              {i > 0 && <i aria-hidden> › </i>}
              <Link prefetch={false} href={c.href}>{c.label}</Link>
            </span>
          ))}
        </nav>
        {langSwitch}
        <Link prefetch={false} href={home} className={styles.open}>
          {shop ? t("Mon bureau", "My desk") : t("Ouvrir mon bureau", "Open my desk")} ▶
        </Link>
      </header>
      {shop && (
        <nav className={styles.tabs} aria-label="Pages">
          {SHOP_TABS.map((tab) => {
            const href = t(tab.href[0], tab.href[1]);
            if (!href) return null;
            const on = shop === href || shop.startsWith(`${href}/`);
            return (
              <Link key={href} prefetch={false} href={href} className={on ? styles.tabOn : undefined} aria-current={on ? "page" : undefined}>
                {t(tab.label[0], tab.label[1])}
              </Link>
            );
          })}
        </nav>
      )}
      {hero}

      <main className={styles.main}>{children}</main>

      <aside className={styles.about}>
        <img src="/opengraph-image.jpg" alt={t(`Le bureau ${SITE_NAME}`, `The ${SITE_NAME} desk`)} width={1200} height={630} loading="lazy" />
        <div>
          <h2>{t(`${SITE_NAME}, c'est quoi ?`, `What is ${SITE_NAME}?`)}</h2>
          <p>
            {t(
              "Ta collection Pokémon rangée dans des classeurs, sur un bureau cosy dessiné à la main. Coche tes cartes, suis leur cote chaque jour, prépare tes échanges en salon. Gratuit, sans pub, sur ordinateur comme sur téléphone.",
              "Your Pokémon collection in binders, on a cosy hand-painted desk. Tick your cards, follow their value every day, check your trades at card shows. Free, no ads, on computer and phone.",
            )}
          </p>
          <Link prefetch={false} href={home} className={styles.open}>
            {t("Commencer ma collection", "Start my collection")} ▶
          </Link>
        </div>
      </aside>

      {/* the same two rows on every page (Johan, 2026-11-01): the shell's pages, then the site's own (the Amazon programs'
          sentences are in the terms of use) */}
      <footer className={styles.foot} data-sticky-stop>
        <nav aria-label={t("Les pages", "Pages")}>
          {SHOP_TABS.map((tab) => {
            const href = t(tab.href[0], tab.href[1]);
            return href ? (
              <Link key={href} prefetch={false} href={href}>
                {FOOT_LABEL[href] ?? t(tab.label[0], tab.label[1])}
              </Link>
            ) : null;
          })}
        </nav>
        <nav aria-label={t("Le site", "The site")}>
          <Link prefetch={false} href="/a-propos">{t("À propos", "About")}</Link>
          <Link prefetch={false} href="/contact">Contact</Link>
          <Link prefetch={false} href="/conditions">{t("Conditions d'utilisation", "Terms of use")}</Link>
          <Link prefetch={false} href="/confidentialite">{t("Confidentialité", "Privacy")}</Link>
          <Link prefetch={false} href="/conditions-de-vente">{t("Conditions de vente", "Terms of sale")}</Link>
          <Link prefetch={false} href="/mentions-legales">{t("Mentions légales", "Legal notice")}</Link>
        </nav>
      </footer>
    </div>
  );
}
