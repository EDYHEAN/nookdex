import type { Metadata } from "next";
import Link from "next/link";
import rawEn from "@/data/catalog-en.json";
import rawFr from "@/data/catalog.json";
import { amazonSearch, inShops } from "@/lib/amazon";
import { formatDate } from "@/lib/blog";
import { type GearKind, gearArt } from "@/lib/gearArt";
import { type PageLang, setPagePath } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { CatalogSet } from "@/lib/types";
import { Affiliate, AmazonButton } from "./shop/ShopBits";
import { ShopHero } from "./shop/ShopHero";
import { StickyBuy } from "./shop/StickyBuy";
import s from "./shop/Shop.module.css";
import { WidePage } from "./WidePage";

/**
 * The collector's gear (Johan, 2026-11-10: a page that sells between two releases, the invitations only sell around
 * them): binders, sleeves, toploaders, magnetic cases, storage boxes. Amazon searches, any brand (no ASIN to keep up to
 * date, always buyable, no invitation), place `accessoires`. What no shop page says: how many binder pages each set takes,
 * from our own catalogs. French page /accessoires-pokemon (amazon.fr), English /en/card-accessories (amazon.com).
 */
export const GEAR_PATH: Record<PageLang, string> = { fr: "/accessoires-pokemon", en: "/en/card-accessories" };

const TITLE = {
  fr: "Classeur, sleeves, toploader : le matériel pour ranger ses cartes Pokémon",
  en: "Pokémon card binder, sleeves, toploaders: the collector's gear",
};
const DESCRIPTION = {
  fr: "Quel classeur pour ranger une extension Pokémon, quelle taille de sleeves, quand passer au toploader : le guide, et le nombre de pages qu'il faut pour chaque set.",
  en: "Which binder fits a Pokémon set, what size sleeves, when to use a toploader: the guide, and how many binder pages each set takes.",
};

export function gearMetadata(lang: PageLang): Metadata {
  return {
    title: { absolute: TITLE[lang] },
    description: DESCRIPTION[lang],
    alternates: { canonical: GEAR_PATH[lang], languages: { fr: GEAR_PATH.fr, en: GEAR_PATH.en } },
    openGraph: {
      type: "website",
      url: GEAR_PATH[lang],
      siteName: SITE_NAME,
      title: TITLE[lang],
      description: DESCRIPTION[lang],
      locale: lang === "fr" ? "fr_FR" : "en_US",
      images: ["/opengraph-image.jpg"],
    },
  };
}

interface Gear {
  kind: GearKind;
  name: [string, string];
  /** what it's for, in one line */
  what: [string, string];
  tips: [string, string][];
  q: [string, string];
}

const GEAR: Gear[] = [
  {
    kind: "binder",
    name: ["Classeur 9 cases", "9-pocket binder"],
    what: ["Pour ranger un set entier et le feuilleter.", "To keep a whole set and leaf through it."],
    tips: [
      ["Chargement latéral : la carte ne glisse pas dehors.", "Side-loading pockets: cards don't slide out."],
      ["Sans anneaux : ils marquent les cartes près de la reliure.", "No rings: they dent the cards by the spine."],
      ["Une fermeture zip contre la poussière.", "A zip keeps the dust out."],
    ],
    q: ["classeur pokemon 9 cases zip", "pokemon 9 pocket binder side loading zipper"],
  },
  {
    kind: "sleeves",
    name: ["Sleeves (pochettes)", "Card sleeves"],
    what: ["La première protection, dès qu'une carte vaut quelques euros.", "The first layer, as soon as a card is worth a few dollars."],
    tips: [
      ["Taille standard 66 × 91 mm : celle des cartes Pokémon.", "Standard size, 66 × 91 mm: Pokémon cards' size."],
      ["Les « penny sleeves » fines avant un toploader.", "Thin penny sleeves before a toploader."],
      ["Une « perfect fit » dessous pour un double sleeve.", "A perfect fit underneath to double-sleeve."],
    ],
    q: ["sleeves pokemon 66x91", "pokemon card sleeves 66x91"],
  },
  {
    kind: "toploader",
    name: ["Toploader", "Toploaders"],
    what: ["Rigide : pour les cartes de plus de 20 €, ou à envoyer.", "Rigid: for cards worth over $20, or to mail one."],
    tips: [
      ["35 pt : l'épaisseur d'une carte normale.", "35 pt: the thickness of a regular card."],
      ["Toujours avec une penny sleeve dedans.", "Always with a penny sleeve inside."],
      ["Indispensable pour envoyer une carte par la poste.", "A must to ship a card."],
    ],
    q: ["toploader 35pt cartes pokemon", "toploaders 35pt card holders"],
  },
  {
    kind: "magnet",
    name: ["Étui magnétique", "Magnetic holder"],
    what: ["Pour exposer les plus belles : la carte ne bouge plus.", "To show off the best ones: the card can't move."],
    tips: [
      ["35 pt pour une carte normale, plus épais pour une carte jumbo.", "35 pt for a regular card, thicker for a jumbo."],
      ["Filtre UV : les couleurs ne passent pas au soleil.", "UV protection keeps the colours from fading."],
    ],
    q: ["étui magnétique 35pt carte pokemon", "magnetic card holder 35pt one touch"],
  },
  {
    kind: "box",
    name: ["Boîte de rangement", "Storage box"],
    what: ["Pour les doubles et les cartes communes, par centaines.", "For doubles and commons, by the hundred."],
    tips: [
      ["Une boîte de 800 à 1 000 cartes par extension.", "An 800-1,000 count box per set."],
      ["Des intercalaires pour les ranger par type ou par numéro.", "Dividers to sort them by type or number."],
    ],
    q: ["boite rangement cartes pokemon 1000", "trading card storage box 800 count"],
  },
];

const FAQ: { q: [string, string]; a: (n: { name: string; cards: number; sheets: number } | null) => [string, string] }[] = [
  {
    q: ["Quel classeur pour ranger une extension Pokémon ?", "Which binder fits a Pokémon set?"],
    a: (n) => [
      `Un classeur 9 cases à chargement latéral, sans anneaux. Une feuille tient 18 cartes (recto verso) : ${
        n ? `${n.name}, ${n.cards} cartes, demande ${n.sheets} feuilles, ` : ""
      }un classeur de 20 feuilles (360 cartes) suffit pour un set entier, secrètes comprises.`,
      `A 9-pocket, side-loading binder with no rings. A sheet holds 18 cards (both sides): ${
        n ? `${n.name}, ${n.cards} cards, takes ${n.sheets} sheets, so ` : ""
      }a 20-sheet binder (360 cards) holds a whole set, secret rares included.`,
    ],
  },
  {
    q: ["Quelle taille de sleeves pour les cartes Pokémon ?", "What size sleeves for Pokémon cards?"],
    a: () => [
      "La taille standard, 66 × 91 mm (les cartes font 63 × 88 mm). La « petite taille » japonaise (62 × 89 mm) est faite pour Yu-Gi-Oh!, pas pour Pokémon.",
      "Standard size, 66 × 91 mm (the cards are 63 × 88 mm). The Japanese “small size” (62 × 89 mm) is for Yu-Gi-Oh!, not Pokémon.",
    ],
  },
  {
    q: ["Faut-il mettre ses cartes Pokémon en sleeves ?", "Should I sleeve my Pokémon cards?"],
    a: () => [
      "Celles qui valent plus de quelques euros, oui : une rayure ou un coin abîmé fait perdre une bonne part de sa cote à une carte. Au-dessus de 20 €, ajoute un toploader.",
      "Any card worth more than a few dollars, yes: a scratch or a dinged corner takes a good part of its value. Over $20, add a toploader.",
    ],
  },
  {
    q: ["Toploader ou étui magnétique ?", "Toploader or magnetic holder?"],
    a: () => [
      "Le toploader pour ranger et envoyer (léger, pas cher), l'étui magnétique pour exposer une carte qui compte : elle ne bouge plus et le plastique est plus clair.",
      "A toploader to store and ship (light, cheap), a magnetic holder to display a card that matters: it can't move and the plastic is clearer.",
    ],
  },
  {
    q: ["Un classeur à anneaux, c'est une bonne idée ?", "Is a ring binder a good idea?"],
    a: () => [
      "Pas pour des cartes de valeur : les anneaux appuient sur les cartes près de la reliure et les marquent avec le temps. Préfère un classeur à pochettes cousues.",
      "Not for valuable cards: the rings press on the cards by the spine and dent them over time. Pick a binder with stitched-in pages.",
    ],
  },
];

const nb = (s: string) => s.replace(/ ([?!:;»])/g, "\u202f$1").replace(/« /g, "«\u202f");

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
const Art = ({ kind }: { kind: GearKind }) => <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: gearArt(kind) }} />;

export function AccessoriesPage({ lang }: { lang: PageLang }) {
  const fr = lang === "fr";
  const i = fr ? 0 : 1;
  const t = (f: string, e: string) => (fr ? f : e);
  const today = new Date().toISOString().slice(0, 10);
  // the sets in the shops (two years), newest first: how many binder sheets each takes
  const sets = ((fr ? rawFr : rawEn) as CatalogSet[])
    .filter((x) => !x.extra && x.total && x.releaseDate && x.releaseDate <= today && inShops(x.releaseDate))
    .sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!))
    .map((x) => ({ id: x.id, name: x.name, date: x.releaseDate!, cards: x.total, pages: Math.ceil(x.total / 9), sheets: Math.ceil(x.total / 18) }));
  const newest = sets[0] ? { name: sets[0].name, cards: sets[0].cards, sheets: sets[0].sheets } : null;
  const faq = FAQ.map((f) => ({ q: nb(f.q[i]), a: nb(f.a(newest)[i]) }));
  const binder = GEAR[0];
  const heroHref = amazonSearch(binder.q[i], "accessoires", lang);

  const hero = (
    <ShopHero
      head={
        <>
          <p className={s.eyebrow}>{t("Le matériel du collectionneur", "The collector's gear")}</p>
          <h1 className={s.title}>
            <span className={s.rest}>{t("Classeur, sleeves, toploader\u00a0:", "Binder, sleeves, toploaders:")}</span>
            <span className={s.big}>{t("ranger ses cartes", "keep your cards")}</span>
            <span className={s.rest}>{t("pour qu'elles gardent leur cote", "so they keep their value")}</span>
          </h1>
        </>
      }
      stage={
        <div className={s.stageW}>
          <div className={s.stage}>
            <span className={s.glow} />
            <div className={s.solo}>
              <span role="img" aria-label={binder.name[i]} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: gearArt("binder") }} />
            </div>
          </div>
          <div className={s.desk} />
        </div>
      }
      buy={
        <>
          <p className={s.what}>
            <b>{binder.name[i]}</b> · {binder.what[i]}
          </p>
          <div className={s.btns}>
            <AmazonButton id="hero-cta" href={heroHref} place="accessoires" size="lg" nudge>
              {t("Les classeurs sur Amazon", "Binders on Amazon")}
            </AmazonButton>
          </div>
          <ul className={s.reassure}>
            <li>{t("Toujours en stock, sans invitation", "Always in stock, no invite")}</li>
            <li>{t("Toutes les marques", "Every brand")}</li>
          </ul>
          <Affiliate lang={lang} />
        </>
      }
    />
  );

  return (
    <WidePage
      en={!fr}
      shop={GEAR_PATH[lang]}
      alt={{ href: GEAR_PATH[fr ? "en" : "fr"], label: fr ? "the collector's gear, in English" : "le matériel du collectionneur, en français" }}
      crumbs={[{ href: GEAR_PATH[lang], label: t("Le matériel", "Gear") }]}
      hero={hero}
    >
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: fr ? SITE_URL : `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: t("Le matériel du collectionneur", "The collector's gear"), item: `${SITE_URL}${GEAR_PATH[lang]}` },
        ],
      })}
      {ld({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: lang,
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })}

      <p className={s.answer}>
        <b>{t("En bref", "In short")}</b>
        {t(
          "Un classeur 9 cases à chargement latéral pour ton set, des sleeves 66 × 91 mm pour les cartes qui valent plus que quelques euros, un toploader au-dessus de 20 €.",
          "A 9-pocket side-loading binder for your set, 66 × 91 mm sleeves for any card worth more than a few dollars, a toploader over $20.",
        )}
      </p>

      {/* the desk first, green: the binder they're about to buy, also on the desk */}
      <div className={s.app}>
        <p>{t("Ton classeur, aussi sur NookDex : coche tes cartes, vois celles qui manquent et leur cote du jour.", "Your binder, on NookDex too: tick your cards, see the ones missing and today's value.")}</p>
        <Link prefetch={false} href={fr ? "/" : "/en"} className={`${s.btn} ${s.green}`}>
          {t("Ouvrir mon bureau ▶", "Open my desk ▶")}
        </Link>
      </div>

      <h2>{t("Ce qu'il faut pour ranger ses cartes Pokémon", "What you need to keep Pokémon cards")}</h2>
      <ul className={`${s.rail} ${s.gearRail}`}>
        {GEAR.map((g) => (
          <li key={g.kind} id={g.kind}>
            <a className={s.pcard} href={amazonSearch(g.q[i], "accessoires", lang)} target="_blank" rel="sponsored noopener" data-amazon-place="accessoires">
              <span className={s.pic}>
                <span role="img" aria-label={g.name[i]} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: gearArt(g.kind) }} />
              </span>
              <span className={s.body}>
                <span className={`${s.name} ${s.gearName}`}>{g.name[i]}</span>
                <span className={s.gearWhat}>{nb(g.what[i])}</span>
                <span className={s.tips}>
                  {g.tips.map((tip) => (
                    <span key={tip[0]}>{nb(tip[i])}</span>
                  ))}
                </span>
                <span className={`${s.btn} ${s.sm} ${s.block}`}>
                  {t("Voir sur Amazon", "See on Amazon")} <span className={s.arr}>↗</span>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <Affiliate lang={lang} many />

      {sets.length > 0 && (
        <section>
          <h2>{t("Combien de pages de classeur pour chaque extension ?", "How many binder pages for each set?")}</h2>
          <p>
            {t(
              "Une page de classeur 9 cases tient 9 cartes, une feuille 18 (recto verso). Le compte de chaque set, secrètes comprises :",
              "A 9-pocket page holds 9 cards, a sheet 18 (both sides). Each set's count, secret rares included:",
            )}
          </p>
          <div className={s.tableW}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">{t("Extension", "Set")}</th>
                  <th scope="col" className={s.wideOnly}>{t("Sortie", "Released")}</th>
                  <th scope="col">{t("Cartes", "Cards")}</th>
                  <th scope="col">{t("Pages", "Pages")}</th>
                  <th scope="col">{t("Feuilles", "Sheets")}</th>
                </tr>
              </thead>
              <tbody>
                {sets.map((x) => {
                  const href = setPagePath(lang, x.id);
                  return (
                    <tr key={x.id}>
                      <th scope="row">{href ? <Link prefetch={false} href={href}>{x.name}</Link> : x.name}</th>
                      <td className={s.wideOnly}>{formatDate(x.date, lang)}</td>
                      <td>{x.cards}</td>
                      <td>{x.pages}</td>
                      <td>{x.sheets}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* said only while it's true: a set past 360 cards would need a bigger one */}
          {Math.max(...sets.map((x) => x.cards)) <= 360 && (
            <p className={s.small}>
              {t(
                "Un classeur de 20 feuilles (360 cartes) tient n'importe lequel de ces sets.",
                "A 20-sheet binder (360 cards) holds any of these sets.",
              )}
            </p>
          )}
        </section>
      )}

      <section className={s.faq} data-sticky-stop>
        <h2>{t("Questions fréquentes", "Frequently asked questions")}</h2>
        {faq.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <p className={s.small}>
        {t("Les liens vers Amazon sont des liens affiliés : ils ne changent pas ton prix", "Links to Amazon are affiliate links: they don't change your price")} (
        <Link prefetch={false} href="/conditions#amazon">{t("conditions", "terms")}</Link>).{" "}
        <Link prefetch={false} href={fr ? "/invitations-amazon" : "/en/amazon-invites"}>
          {t("Les coffrets et displays sur invitation →", "Sealed boxes and invites →")}
        </Link>
      </p>

      <StickyBuy
        target="hero-cta"
        href={heroHref}
        place="accessoires-bar"
        thumb={<Art kind="binder" />}
        title={binder.name[i]}
        sub={t("Chargement latéral, sans anneaux", "Side-loading, no rings")}
        label={t("Sur Amazon", "On Amazon")}
      />
    </WidePage>
  );
}
