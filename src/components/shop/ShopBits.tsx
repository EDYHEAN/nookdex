import type { ReactNode } from "react";
import { affiliateLabel, amazonSearch, type AmazonPlace } from "@/lib/amazon";
import { KIND_LABEL, byInterest, goLabel, productHref, productPic, type ProductPic, type ShopGroup, type ShopKind } from "@/lib/amazonShop";
import { kindArt } from "@/lib/kindArt";
import s from "./Shop.module.css";

/**
 * The pieces of the Amazon pages (« Sous la lampe », Shop.module.css): the button, the product card, the rail of cards,
 * the English pages' drawn kinds, the affiliate line. Every Amazon link: a new tab, sponsored, its place for the click
 * count (lib/funnel watchAmazonClicks).
 */

type Lang = "fr" | "en";

/** a link to Amazon, as a button (yellow; `alt`: the quiet one) */
export function AmazonButton({
  href,
  place,
  children,
  size,
  alt,
  nudge,
  block,
  id,
}: {
  href: string;
  /** its place for the click count: an AmazonPlace, or `<place>-bar` for the phone's sticky bar */
  place: string;
  children: ReactNode;
  size?: "lg" | "sm";
  alt?: boolean;
  nudge?: boolean;
  block?: boolean;
  id?: string;
}) {
  const cls = [s.btn, size && s[size], alt && s.alt, nudge && s.nudge, block && s.block].filter(Boolean).join(" ");
  return (
    <a id={id} className={cls} href={href} target="_blank" rel="sponsored noopener" data-amazon-place={place}>
      {children} <span className={s.arr}>↗</span>
    </a>
  );
}

/** « Lien affilié », by a group of Amazon links */
export const Affiliate = ({ lang, many }: { lang: Lang; many?: boolean }) => <p className={s.aff}>{affiliateLabel(lang, many)}</p>;

/** a picture, or its kind drawn (lib/kindArt: never a booster for a box) */
export function ProductArt({ pic, kind, alt, eager }: { pic: ProductPic | null; kind: ShopKind; alt: string; eager?: boolean }) {
  return pic ? (
    <img src={pic.src} width={pic.w} height={pic.h} alt={alt} loading={eager ? undefined : "lazy"} fetchPriority={eager ? "high" : undefined} />
  ) : (
    <span role="img" aria-label={alt} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: kindArt(kind) }} />
  );
}

/** a sealed product of a set on amazon.fr: the whole card is the link */
export function ProductCard({ group, product: p, place, soon }: { group: ShopGroup; product: ShopGroup["products"][number]; place: AmazonPlace; soon: boolean }) {
  return (
    <a className={s.pcard} href={productHref(p, place)} target="_blank" rel="sponsored noopener" data-amazon-place={place}>
      {soon && <span className={s.ribbon}>Précommande</span>}
      <span className={s.pic}>
        <ProductArt pic={productPic(p, group)} kind={p.kind} alt={`${KIND_LABEL[p.kind]} ${group.name}`} />
      </span>
      <span className={s.body}>
        <span className={s.kind}>{KIND_LABEL[p.kind]}</span>
        <span className={s.name}>{p.name}</span>
        <span className={`${s.btn} ${s.sm} ${s.block}`}>
          {goLabel(p, soon)} <span className={s.arr}>↗</span>
        </span>
      </span>
    </a>
  );
}

/** a set's products, the most looked-for first: sideways on a phone, a grid on a computer; « Liens affiliés » under them */
export function ProductRail({ group, place, max }: { group: ShopGroup; place: AmazonPlace; max?: number }) {
  const all = byInterest(group.products);
  const shown = max ? all.slice(0, max) : all;
  const soon = !!group.date && group.date > new Date().toISOString().slice(0, 10);
  return (
    <>
      <ul className={s.rail}>
        {shown.map((p) => (
          <li key={p.asin ?? p.name}>
            <ProductCard group={group} product={p} place={place} soon={soon} />
          </li>
        ))}
      </ul>
      <Affiliate lang="fr" many={shown.length > 1} />
    </>
  );
}

/** what people look for, drawn: no product pictures of ours on amazon.com (nor for an older French set), a search each */
const KINDS: { kind: ShopKind; fr: string; en: string; q: { fr: string; en: string } }[] = [
  { kind: "etb", fr: "Coffret Dresseur d'élite", en: "Elite Trainer Box", q: { fr: "Coffret Dresseur d'élite", en: "Elite Trainer Box" } },
  { kind: "display", fr: "Display", en: "Booster Box", q: { fr: "Display", en: "Booster Box" } },
  { kind: "bundle", fr: "Bundle", en: "Booster Bundle", q: { fr: "Bundle", en: "Booster Bundle" } },
  { kind: "tripack", fr: "Tripack", en: "3-Pack Blister", q: { fr: "Tripack", en: "3 Pack Blister" } },
];

/** a set's four kinds of products, drawn, each a search on amazon.fr (amazon.com on an English page) */
export function KindTiles({ name, place, soon, lang = "en" }: { name: string; place: AmazonPlace; soon: boolean; lang?: Lang }) {
  const fr = lang === "fr";
  return (
    <>
      <ul className={s.kinds}>
        {KINDS.map((k) => (
          <li key={k.kind}>
            <a
              href={amazonSearch(fr ? `Pokémon ${name} ${k.q.fr}` : `Pokemon TCG ${name} ${k.q.en}`, place, lang)}
              target="_blank"
              rel="sponsored noopener"
              data-amazon-place={place}
            >
              <span dangerouslySetInnerHTML={{ __html: kindArt(k.kind) }} style={{ display: "contents" }} />
              <b>{fr ? k.fr : k.en}</b>
              <span className={`${s.btn} ${s.sm}`}>
                {soon ? (fr ? "Précommandes" : "Pre-orders") : fr ? "Sur Amazon" : "On Amazon"} <span className={s.arr}>↗</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <Affiliate lang={lang} many />
    </>
  );
}

/** the hero's stage with a card standing under the lamp (a set page: its dearest card, what its boosters hide) */
export function CardStage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className={s.stageW}>
      <div className={s.stage}>
        <span className={s.glow} />
        <div className={`${s.solo} ${s.scan}`}>
          <img src={`${src}/high.webp`} width={600} height={837} alt={alt} fetchPriority="high" />
        </div>
      </div>
      <div className={s.desk} />
    </div>
  );
}

/** the hero's stage: the product under the lamp (its picture or its drawn kind), else the set's boosters fanned out */
export function Stage({ pic, kind, fan, alt }: { pic: ProductPic | null; kind: ShopKind | null; fan: ProductPic[]; alt: string }) {
  // a box without its picture: the set's boosters say more than a drawing (they're the set's own, named so)
  const boosters = !pic && fan.length ? fan.slice(0, 3) : null;
  // the middle one (the second, drawn bigger) is the set's main booster
  const fanned = boosters && boosters.length > 1 ? [boosters[1], boosters[0], ...boosters.slice(2)] : boosters;
  const main = fanned && fanned.length > 1 ? 1 : 0;
  return (
    <div className={s.stageW}>
      <div className={s.stage}>
        <span className={s.glow} />
        {fanned ? (
          <div className={s.fan}>
            {fanned.map((b, i) => (
              <img key={b.src} src={b.src} width={b.w} height={b.h} alt={i === main ? alt : ""} fetchPriority={i === main ? "high" : undefined} />
            ))}
          </div>
        ) : (
          <div className={s.solo}>{kind && <ProductArt pic={pic} kind={kind} alt={alt} eager />}</div>
        )}
      </div>
      <div className={s.desk} />
    </div>
  );
}
