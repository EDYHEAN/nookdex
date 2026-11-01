import type { ReactNode } from "react";
import { WidePage } from "./WidePage";
import { ShopHero } from "./shop/ShopHero";
import s from "./shop/Shop.module.css";
import styles from "./ShellTextPage.module.css";

/**
 * A text page in the shop pages' shell (Johan, 2026-11-01: terms, legal notice, privacy, terms of sale, contact: reached
 * from the shell's footer, they jumped back to the notebook over the desk and loaded the room): the night bar and tabs, a
 * short title band, no picture, the words in a readable column. Drawn without the room (lib/roomless). Same props as the
 * notebook's LegalPage, which keeps « À propos » (the desk's notebook opens it).
 */
export function ShellTextPage({
  path,
  title,
  updated,
  en = false,
  children,
}: {
  path: string;
  title: string;
  updated?: string;
  en?: boolean;
  children: ReactNode;
}) {
  return (
    <WidePage
      en={en}
      shop={path}
      crumbs={[{ href: path, label: title }]}
      hero={
        <ShopHero
          head={
            <>
              <h1 className={styles.title}>{title}</h1>
              {updated && (
                <p className={s.lede}>
                  {en ? "Updated" : "Mis à jour le"} {updated}
                </p>
              )}
            </>
          }
        />
      }
    >
      <div className={styles.column}>{children}</div>
    </WidePage>
  );
}
