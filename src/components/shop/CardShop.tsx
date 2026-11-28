import { affiliateLabel, amazonOn, amazonProduct, amazonSearch, inShops } from "@/lib/amazon";
import { byInterest, goLabel, kindLabel, productArt, productHref, productPic, setBoxPic, shopFor, type ProductPic, type ShopKind } from "@/lib/amazonShop";
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
  /** its box drawn with the set's logo while its picture is missing */
  art?: string;
  go: string;
}

/** the set's search, drawn (a set with no products listed) */
const SEARCH = { kind: "bundle" as ShopKind, fr: "Bundle", en: "Booster Bundle" };

/**
 * « Elle se cache dans les boosters <set> »: one product, the bundle (six boosters) when listed. Two small ones stood beside
 * it until 2026-11-28 (a card page is about the card: Google had dropped the site's affiliate-heavy pages). The set's
 * products on amazon.fr or amazon.com, else a search. No odds, no « instead of N € » (teens read it, Johan 2026-10-31).
 */
export function SealedBlock({ lang, setId, setName, releaseDate }: { lang: Lang; setId: string; setName: string; releaseDate: string | null }) {
  if (!amazonOn(lang) || !inShops(releaseDate)) return null;
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const g = shopFor(setId, lang);
  let feat: Item;
  if (g) {
    const soon = !!g.date && g.date > new Date().toISOString().slice(0, 10);
    const all = byInterest(g.products);
    const x = all.find((p) => p.kind === "bundle") ?? all[0];
    feat = {
      href: productHref(x, "carte", lang),
      name: x.name,
      kind: x.kind,
      label: kindLabel(x.kind, lang),
      pic: productPic(x, g),
      art: productArt(x, g, lang),
      go: goLabel(x, soon, lang),
    };
  } else {
    const k = SEARCH;
    feat = {
      href: amazonSearch(fr ? `Pokémon ${setName} ${k.fr}` : `Pokemon TCG ${setName} ${k.en}`, "carte", lang),
      name: `${fr ? k.fr : k.en} ${setName}`,
      kind: k.kind,
      label: fr ? k.fr : k.en,
      pic: setBoxPic(setId, k.kind),
      go: t("Voir sur Amazon", "See it on Amazon"),
    };
  }
  return (
    <aside className={cs.sealed} aria-label={t(`Les produits scellés ${setName}`, `${setName} sealed products`)}>
      <p className={s.eyebrow}>{t("Le scellé", "Sealed")}</p>
      <h2>{t(`Elle se cache dans les boosters ${setName}`, `It hides in ${setName} booster packs`)}</h2>
      <a className={cs.feat} href={feat.href} target="_blank" rel="sponsored noopener" data-amazon-place="carte">
        <span className={cs.ph}>
          <ProductArt pic={feat.pic} kind={feat.kind} art={feat.art} alt={`${feat.label} ${setName}`} />
        </span>
        <span>
          <span className={cs.k}>{feat.label}</span>
          <b>{feat.name}</b>
        </span>
        <span className={`${s.btn} ${cs.go}`}>
          {feat.go} <span className={s.arr}>↗</span>
        </span>
      </a>
      <p className={`${s.aff} ${cs.aff}`}>{affiliateLabel(lang, false)}</p>
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
      {/* amazon.fr: our pick's page (AccessoriesPage, Johan 2026-11-22: a product sells better than a search) */}
      <a
        href={fr ? amazonProduct("B00095M5C2", "accessoires", lang) : amazonSearch("Pokemon card sleeves toploaders", "accessoires", lang)}
        target="_blank"
        rel="sponsored noopener"
        data-amazon-place="accessoires"
      >
        {fr ? "Des toploaders Ultra PRO 35 pt sur Amazon" : "Sleeves & toploaders on Amazon"} ↗
      </a>
      <small>
        {affiliateLabel(lang)} ·{" "}
        <a href={fr ? "/accessoires-pokemon" : "/en/card-accessories"}>{fr ? "Le guide du matériel" : "The gear guide"}</a>
      </small>
    </p>
  );
}
