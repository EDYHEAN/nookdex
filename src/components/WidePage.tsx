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

/**
 * A full-width page over the room (the card pages, Johan 2026-10-18: a way in from search engines must be wide, clear
 * and readable for someone who has never seen the desk): a bar with the brand and « Ouvrir mon bureau », the content
 * on plain paper, readable type for the text (the pixel fonts for titles and prices), and what NookDex is at the end.
 * The room stays mounted underneath (app/(desk)/layout): the bar's button opens it without a reload.
 *
 * `shop` (the Amazon pages, Johan 2026-10-31, « Sous la lampe »): drawn without the room behind (lib/roomless), a night bar
 * with « Mon bureau » and the notebook's tabs, a full-width `hero` above the content, NookDex's own buttons green.
 */
export function WidePage({
  en = false,
  crumbs,
  shop,
  hero,
  children,
}: {
  en?: boolean;
  crumbs: { href: string; label: string }[];
  /** the page's path: its tab is up */
  shop?: string;
  hero?: ReactNode;
  children: ReactNode;
}) {
  const t = (fr: string, english: string) => (en ? english : fr);
  const home = t("/", "/en");
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

      <footer className={styles.foot} data-sticky-stop>
        <Link prefetch={false} href={t("/extensions", "/en/sets")}>{t("Toutes les extensions", "All sets")}</Link>
        <Link prefetch={false} href={t("/calendrier-des-sorties", "/en/release-calendar")}>{t("Calendrier des sorties", "Release calendar")}</Link>
        <Link prefetch={false} href="/blog">Blog</Link>
        <Link prefetch={false} href="/a-propos">{t("À propos", "About")}</Link>
        <Link prefetch={false} href="/mentions-legales">{t("Mentions légales", "Legal notice")}</Link>
        {/* the Amazon programs' sentences are there (Johan, 2026-10-31) */}
        {shop && <Link prefetch={false} href="/conditions#amazon">{t("Conditions d'utilisation", "Terms of use")}</Link>}
      </footer>
    </div>
  );
}
