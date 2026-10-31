import { affiliateLabel, amazonOn, amazonSearch, inShops } from "@/lib/amazon";
import { KIND_LABEL, byInterest, goLabel, productHref, productPic, shopOfSet, type ProductPic, type ShopKind } from "@/lib/amazonShop";
import { ProductArt } from "./ShopBits";
import s from "./Shop.module.css";
import cs from "./CardShop.module.css";

/**
 * A card page's Amazon (Johan, 2026-10-31): never the single card (that's Cardmarket's), only the sealed products of its
 * set while the set is in the shops, and sleeves for a card worth keeping safe. Server drawn, no script: these are
 * ~45,000 pages. After the desk's own green button, never before it.
 */

type Lang = "fr" | "en";
interface Item {
  href: string;
  name: string;
  kind: ShopKind;
  label: string;
  pic: ProductPic | null;
  go: string;
}

/** the set's searches by kind, drawn (an English page, or a French set with no products listed) */
const SEARCHES: { kind: ShopKind; fr: string; en: string }[] = [
  { kind: "bundle", fr: "Bundle", en: "Booster Bundle" },
  { kind: "etb", fr: "Coffret Dresseur d'élite", en: "Elite Trainer Box" },
  { kind: "display", fr: "Display", en: "Booster Box" },
];

/**
 * « Elle se cache dans les boosters <set> »: one product up front (the bundle, six boosters, when listed), two small ones;
 * amazon.fr's products of a French set, else searches by kind (amazon.com on an English page). No odds, no « instead of
 * N € » (teens read it, Johan 2026-10-31).
 */
export function SealedBlock({ lang, setId, setName, releaseDate }: { lang: Lang; setId: string; setName: string; releaseDate: string | null }) {
  if (!amazonOn(lang) || !inShops(releaseDate)) return null;
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const g = fr ? shopOfSet(setId) : undefined;
  let items: Item[];
  if (g) {
    const soon = !!g.date && g.date > new Date().toISOString().slice(0, 10);
    const all = byInterest(g.products);
    const first = all.find((x) => x.kind === "bundle") ?? all[0];
    items = [first, ...all.filter((x) => x !== first)].slice(0, 3).map((x) => ({
      href: productHref(x, "carte"),
      name: x.name,
      kind: x.kind,
      label: KIND_LABEL[x.kind],
      pic: productPic(x, g),
      go: goLabel(x, soon),
    }));
  } else {
    items = SEARCHES.map((k) => ({
      href: amazonSearch(fr ? `Pokémon ${setName} ${k.fr}` : `Pokemon TCG ${setName} ${k.en}`, "carte", lang),
      name: `${fr ? k.fr : k.en} ${setName}`,
      kind: k.kind,
      label: fr ? k.fr : k.en,
      pic: null,
      go: t("Voir sur Amazon", "See it on Amazon"),
    }));
  }
  const [feat, ...rest] = items;
  return (
    <aside className={cs.sealed} aria-label={t(`Les produits scellés ${setName}`, `${setName} sealed products`)}>
      <p className={s.eyebrow}>{t("Le scellé", "Sealed")}</p>
      <h2>{t(`Elle se cache dans les boosters ${setName}`, `It hides in ${setName} booster packs`)}</h2>
      <a className={cs.feat} href={feat.href} target="_blank" rel="sponsored noopener" data-amazon-place="carte">
        <span className={cs.ph}>
          <ProductArt pic={feat.pic} kind={feat.kind} alt={`${feat.label} ${setName}`} />
        </span>
        <span>
          <span className={cs.k}>{feat.label}</span>
          <b>{feat.name}</b>
        </span>
        <span className={`${s.btn} ${cs.go}`}>
          {feat.go} <span className={s.arr}>↗</span>
        </span>
      </a>
      {rest.length > 0 && (
        <ul className={cs.others}>
          {rest.map((x) => (
            <li key={x.href}>
              <a href={x.href} target="_blank" rel="sponsored noopener" data-amazon-place="carte">
                <ProductArt pic={x.pic} kind={x.kind} alt="" />
                <span>{x.name} ↗</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className={`${s.aff} ${cs.aff}`}>{affiliateLabel(lang, items.length > 1)}</p>
    </aside>
  );
}

/** « Protège-la »: sleeves and toploaders, for a card worth 20 €/$ or more (any set: always buyable, no invitation) */
export function ProtectIt({ lang, price }: { lang: Lang; price: number | null | undefined }) {
  if (!amazonOn(lang) || price == null || price < 20) return null;
  const fr = lang === "fr";
  return (
    <p className={cs.protect}>
      <b>{fr ? "Protège-la" : "Protect it"}</b>
      <span>{fr ? "Une pochette et un toploader, pour qu'elle garde sa cote." : "A sleeve and a toploader, so it keeps its value."}</span>
      <a
        href={amazonSearch(fr ? "protège-cartes toploader Pokémon" : "Pokemon card sleeves toploaders", "accessoires", lang)}
        target="_blank"
        rel="sponsored noopener"
        data-amazon-place="accessoires"
      >
        {fr ? "Sleeves et toploaders sur Amazon" : "Sleeves & toploaders on Amazon"} ↗
      </a>
      <small>{affiliateLabel(lang)}</small>
    </p>
  );
}
