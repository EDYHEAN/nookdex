import Link from "next/link";
import { AMAZON_NOTICE } from "@/lib/amazon";
import { KIND_LABEL, SHOP_PATH, byInterest, productHref, productPic, type ShopGroup } from "@/lib/amazonShop";
import styles from "./ShopShelf.module.css";

/**
 * A set's (or a line's) sealed products on amazon.fr, as cards: the official picture, what it is, and a big button
 * (Johan, 2026-10-19: put the products forward, a call to action wherever they show). The whole card is the link.
 * French pages only. `max` shows the first few (the most looked for) and a link to the full page.
 */
export function ShopShelf({ group, max, title, notice = true }: { group: ShopGroup; max?: number; title?: string; notice?: boolean }) {
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
              <a className={styles.card} href={productHref(p)} target="_blank" rel="sponsored noopener">
                <span className={styles.pic}>
                  {pic ? <img src={pic.src} width={pic.w} height={pic.h} alt={`${KIND_LABEL[p.kind]} ${group.name}`} loading="lazy" /> : null}
                </span>
                <span className={styles.kind}>{KIND_LABEL[p.kind]}</span>
                <span className={styles.name}>{p.name}</span>
                {/* Amazon sells the sealed Pokémon products by invitation; before they're listed, a search */}
                <span className={styles.go}>{soon ? "Précommander" : p.asin ? "Demander l'invitation" : "Voir sur Amazon"}</span>
              </a>
            </li>
          );
        })}
      </ul>
      {max && all.length > max && (
        <p className={styles.more}>
          <Link href={`${SHOP_PATH}#${group.id}`}>
            Les {all.length} produits {group.name} sur Amazon →
          </Link>
        </p>
      )}
      {notice && <p className={styles.notice}>{AMAZON_NOTICE}</p>}
    </section>
  );
}
