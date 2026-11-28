import type { Metadata } from "next";
import Link from "next/link";
import { WidePage } from "@/components/WidePage";
import { ShopHero } from "@/components/shop/ShopHero";
import s from "@/components/shop/Shop.module.css";
import styles from "@/components/NotFound.module.css";
import { sceneImg } from "@/lib/scene";
import { serverLang } from "@/lib/serverLang";
import { SITE_NAME } from "@/lib/site";

/**
 * The 404 (2026-11-28), for an unknown address and every notFound(): the shop pages' shell (drawn without the room), a
 * night hero where Warwick sits under the lamp by a card back stamped 404, the desk first, then the pages people came
 * for. Next adds the noindex. The pages that check their address before streaming (lib/pageGuards) send it with a real
 * 404 status.
 */
export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  return { title: en ? `Page not found · ${SITE_NAME}` : `Page introuvable · ${SITE_NAME}` };
}

export default async function NotFound() {
  const en = (await serverLang()) === "en";
  const t = (fr: string, english: string) => (en ? english : fr);
  const ways = [
    { href: t("/extensions", "/en/sets"), icon: "📚", label: t("Toutes les extensions", "Every set"), what: t("Leurs cartes et leurs prix du jour", "Their cards and today's prices") },
    { href: t("/calendrier-des-sorties", "/en/release-calendar"), icon: "📅", label: t("Les prochaines sorties", "Coming releases"), what: t("Le calendrier du JCC Pokémon", "The Pokémon TCG calendar") },
    { href: t("/marche", "/en/market"), icon: "📈", label: t("Le marché", "The market"), what: t("Les cartes qui montent cette semaine", "The cards rising this week") },
    { href: "/blog", icon: "📌", label: "Blog", what: t("Guides et actus des extensions", "Set guides and news") },
  ];
  return (
    <WidePage
      en={en}
      shop="/404"
      crumbs={[]}
      hero={
        <ShopHero
          head={
            <>
              {/* an unknown address takes generateMetadata's title, a notFound() thrown by a page its root layout's: this one wins there */}
              <title>{t(`Page introuvable · ${SITE_NAME}`, `Page not found · ${SITE_NAME}`)}</title>
              <p className={s.eyebrow}>{t("Erreur 404", "Error 404")}</p>
              <h1 className={s.title}>
                <span className={s.big}>{t("Carte égarée", "Lost card")}</span>
                <span className={s.rest}>{t("Cette page a glissé sous le bureau", "This page slipped under the desk")}</span>
              </h1>
              <p className={s.lede}>
                {t(
                  "Warwick a fouillé partout : rien à cette adresse. La page a peut-être changé de nom, ou le lien a perdu une lettre en route.",
                  "Warwick looked everywhere: nothing at this address. The page may have been renamed, or the link lost a letter on the way.",
                )}
              </p>
              <div className={styles.btns}>
                <Link prefetch={false} href={t("/", "/en")} className={`${s.btn} ${s.green}`}>
                  {t("Retour à mon bureau", "Back to my desk")} <span className={s.arr}>▸</span>
                </Link>
                <Link prefetch={false} href={t("/extensions", "/en/sets")} className={`${s.btn} ${s.alt}`}>
                  {t("Chercher dans les extensions", "Look through the sets")}
                </Link>
              </div>
            </>
          }
          stage={
            <div className={s.stageW}>
              <div className={`${s.stage} ${styles.stage}`}>
                <span className={s.glow} />
                <div className={styles.scene} aria-hidden>
                  <span className={styles.pocket} />
                  <span className={styles.card}>
                    <span className={styles.ball} />
                    <span className={styles.stamp}>404</span>
                  </span>
                  <img className={styles.cat} src={sceneImg("cat-awake.webp")} alt="" width={412} height={372} />
                  <span className={styles.what}>?</span>
                </div>
              </div>
              <div className={s.desk} />
            </div>
          }
        />
      }
    >
      <section className={styles.ways}>
        <h2>{t("Où aller ensuite ?", "Where to next?")}</h2>
        <ul>
          {ways.map((w) => (
            <li key={w.href}>
              <Link prefetch={false} href={w.href}>
                <span className={styles.icon} aria-hidden>
                  {w.icon}
                </span>
                <b>{w.label}</b>
                <span>{w.what}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </WidePage>
  );
}
