import Link from "next/link";
import { affiliateLabel, type AmazonPlace } from "@/lib/amazon";
import { kindArt } from "@/lib/kindArt";
import { KIND_LABEL, SHOP_PATH, byInterest, goLabel, productHref, productPic, type ShopGroup } from "@/lib/amazonShop";
import styles from "./ShopShelf.module.css";

/**
 * A set's (or a line's) sealed products on amazon.fr, as cards: the official picture, what it is, and a big button
 * (Johan, 2026-10-19: put the products forward, a call to action wherever they show). The whole card is the link.
 * French pages only. `max` shows the first few (the most looked for) and a link to the full page. « Liens affiliés » under
 * them (the program's sentence is on /conditions and /a-propos).
 */
export function ShopShelf({
  group,
  place,
  max,
  title,
}: {
  group: ShopGroup;
  /** where it shows: its Amazon tracking id */
  place: AmazonPlace;
  max?: number;
  title?: string;
}) {
  const all = byInterest(group.products);
  const shown = max ? all.slice(0, max) : all;
  const today = new Date().toISOString().slice(0, 10);
  const soon = !!group.date && group.date > today;
  return (
    <section className={styles.shelf} aria-label={title ?? group.name}>
      {title && <h2>{title}</h2>}
      <ul className={styles.grid}>
        {shown.map((p) => {
          const pic = productPic(p, group);
          return (
            <li key={p.asin ?? p.name}>
              <a className={styles.card} href={productHref(p, place)} target="_blank" rel="sponsored noopener" data-amazon-place={place}>
                <span className={styles.pic}>
                  {/* no picture of it yet: its kind, drawn (never a booster for a box) */}
                  {pic ? (
                    <img src={pic.src} width={pic.w} height={pic.h} alt={`${KIND_LABEL[p.kind]} ${group.name}`} loading="lazy" />
                  ) : (
                    <span className={styles.art} dangerouslySetInnerHTML={{ __html: kindArt(p.kind) }} />
                  )}
                </span>
                <span className={styles.kind}>{KIND_LABEL[p.kind]}</span>
                <span className={styles.name}>{p.name}</span>
                <span className={styles.go}>{goLabel(p, soon)}</span>
              </a>
            </li>
          );
        })}
      </ul>
      {/* always there with a cap, even when all show (me04-me06 have 4): the set pages' link to the invitations page */}
      {max && (
        <p className={styles.more}>
          <Link prefetch={false} href={`${SHOP_PATH}#${group.id}`}>
            {all.length > max ? `Les ${all.length} produits ${group.name} sur Amazon →` : `Toutes les invitations Amazon ${group.name} →`}
          </Link>
        </p>
      )}
      <p className={styles.notice}>{affiliateLabel("fr", shown.length > 1)}</p>
    </section>
  );
}
