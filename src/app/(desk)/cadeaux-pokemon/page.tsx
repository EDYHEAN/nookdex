import type { Metadata } from "next";
import Link from "next/link";
import { WidePage } from "@/components/WidePage";
import { Affiliate, AmazonButton } from "@/components/shop/ShopBits";
import { ShopHero } from "@/components/shop/ShopHero";
import { StickyBuy } from "@/components/shop/StickyBuy";
import s from "@/components/shop/Shop.module.css";
import gifts from "@/data/amazon-gifts.json";
import pics from "@/data/amazon-pics.json";
import { amazonProduct } from "@/lib/amazon";
import { GIFTS_PATH, SHOP_PATH } from "@/lib/amazonShop";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Pokémon gifts under 20 € and 50 € (Johan, 2026-11-22: December is the month, the buyers are often the parents): only
 * what amazon.fr sells at once (an invitation's click never pays, our 24 h cookie is gone when Amazon's mail comes), by
 * budget, who it's for, no price (they move). src/data/amazon-gifts.json; nothing without its real picture (a box's
 * Poképédia one, the gear's maker's: Johan 2026-11-22, a drawing holds the sale back). French only, a shop page (« Sous la
 * lampe », drawn without the room).
 */
interface Gift {
  asin: string;
  kind: string;
  name: string;
  pic?: string;
  buy?: "now" | "invite";
  for: string;
  why: string;
}
const PICS = pics as Record<string, { src: string; w: number; h: number }>;
const picOf = (g: Gift) => (g.pic ? PICS[g.pic] : undefined);
/** shown: sold at once, with its picture */
const shown = (g: Gift) => g.buy === "now" && !!picOf(g);
const budgets = gifts.budgets.map((b) => ({ ...b, products: (b.products as Gift[]).filter(shown) })).filter((b) => b.products.length > 0);
// under the lamp: the dearer budget's first (a binder, a box), the most giftable
const star = budgets.at(-1)?.products[0];
const year = new Date().getUTCFullYear();

const TITLE = `Cadeaux Pokémon à moins de 20 € et 50 € : idées pour Noël ${year}`;
const DESCRIPTION =
  "Idées de cadeaux Pokémon pour Noël à moins de 20 € et 50 € : coffrets, decks, classeurs et pochettes qu'Amazon.fr vend tout de suite, sans invitation.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: GIFTS_PATH },
  openGraph: { type: "website", url: GIFTS_PATH, siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, locale: "fr_FR", images: ["/opengraph-image.jpg"] },
};

const FAQ = [
  {
    q: "Quel cadeau Pokémon pour un enfant qui débute ?",
    a: "Un coffret pour apprendre à jouer (Académie de Combat : 3 decks, un tapis et les règles) ou un petit classeur et une mini-boîte de boosters : de quoi ouvrir ses premières cartes et les ranger.",
  },
  {
    q: "Faut-il une invitation Amazon pour ces cadeaux ?",
    a: "Non : cette page ne montre que ce qu'Amazon.fr vend tout de suite. Les coffrets Dresseur d'élite et les displays des nouvelles extensions, eux, sont souvent vendus sur invitation.",
  },
  {
    q: "Comment éviter de payer trop cher ?",
    a: "Vérifie « Expédié et vendu par Amazon » sur la fiche : d'autres vendeurs proposent parfois le même produit bien au-dessus de son prix public.",
  },
];

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

function GiftArt({ g, eager, alt = g.name }: { g: Gift; eager?: boolean; alt?: string }) {
  const p = picOf(g)!;
  return <img src={p.src} width={p.w} height={p.h} alt={alt} loading={eager ? undefined : "lazy"} fetchPriority={eager ? "high" : undefined} />;
}

export default function CadeauxPokemon() {
  const heroHref = star ? amazonProduct(star.asin, "cadeaux") : null;
  const hero = (
    <ShopHero
      head={
        <>
          <p className={s.eyebrow}>Noël {year} · Amazon.fr</p>
          <h1 className={s.title}>
            <span className={s.rest}>Cadeaux Pokémon à moins de</span>
            <span className={s.big}>20 € et 50 €</span>
            <span className={s.rest}>sans invitation</span>
          </h1>
        </>
      }
      stage={
        star && (
          <div className={s.stageW}>
            <div className={s.stage}>
              <span className={s.glow} />
              <div className={s.solo}>
                <GiftArt g={star} eager />
              </div>
            </div>
            <div className={s.desk} />
          </div>
        )
      }
      buy={
        star &&
        heroHref && (
          <>
            <p className={s.what}>
              <b>{star.name}</b> · {star.why}
            </p>
            <div className={s.btns}>
              <AmazonButton id="hero-cta" href={heroHref} place="cadeaux" size="lg" nudge>
                Voir le prix sur Amazon
              </AmazonButton>
            </div>
            <ul className={s.reassure}>
              <li>Sans invitation</li>
              <li>Vérifie « Expédié et vendu par Amazon »</li>
            </ul>
            <Affiliate lang="fr" />
          </>
        )
      }
    />
  );

  return (
    <WidePage shop={GIFTS_PATH} crumbs={[{ href: GIFTS_PATH, label: "Cadeaux" }]} hero={hero}>
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Cadeaux Pokémon", item: `${SITE_URL}${GIFTS_PATH}` },
        ],
      })}
      {ld({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: "fr",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })}

      {/* the two budgets as a shop's aisles: their products fanned on the shelf, the price band big, how many ideas */}
      <ul className={s.budgets}>
        {budgets.map((b) => (
          <li key={b.id}>
            <a href={`#${b.id}`}>
              <span className={s.budgetShelf}>
                {b.products.slice(0, 3).map((g) => (
                  <GiftArt key={g.asin} g={g} alt="" />
                ))}
              </span>
              <span className={s.budgetText}>
                <small>Moins de</small>
                <b>{b.max} €</b>
                <span>
                  {b.products.length} idée{b.products.length > 1 ? "s" : ""} ↓
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className={s.answer}>
        <b>En bref</b>
        Que des cadeaux qu&apos;Amazon.fr vend tout de suite, sans invitation : de quoi ouvrir des boosters, jouer ou ranger sa collection. Le budget suit le
        prix public : vérifie-le sur la fiche.
      </p>

      {budgets.map((b) => (
        <section key={b.id} id={b.id}>
          <h2>Cadeaux Pokémon à moins de {b.max} €</h2>
          <ul className={s.rail}>
            {b.products.map((g) => (
              <li key={g.asin}>
                <a className={s.pcard} href={amazonProduct(g.asin, "cadeaux")} target="_blank" rel="sponsored noopener" data-amazon-place="cadeaux">
                  <span className={s.pic}>
                    <GiftArt g={g} />
                  </span>
                  <span className={s.body}>
                    <span className={s.kind}>{g.for}</span>
                    <span className={s.name}>{g.name}</span>
                    <span className={s.gearWhat}>{g.why}</span>
                    <span className={`${s.btn} ${s.sm} ${s.block}`}>
                      Voir le prix <span className={s.arr}>↗</span>
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <Affiliate lang="fr" many={b.products.length > 1} />
        </section>
      ))}

      {/* the desk, green: their new cards, ticked in a binder */}
      <div className={s.app}>
        <p>Offre-lui aussi son classeur NookDex : il coche ses nouvelles cartes et voit leur cote du jour. Gratuit.</p>
        <Link prefetch={false} href="/" className={`${s.btn} ${s.green}`}>
          Ouvrir mon bureau ▶
        </Link>
      </div>

      <section className={s.faq} data-sticky-stop>
        <h2>Questions fréquentes</h2>
        {FAQ.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <p className={s.small}>
        Les liens vers Amazon sont des liens affiliés : ils ne changent rien à ton prix (<Link href="/conditions#amazon">conditions</Link>).{" "}
        <Link prefetch={false} href={SHOP_PATH}>Les coffrets et displays sur invitation →</Link>
      </p>

      {star && heroHref && (
        <StickyBuy
          target="hero-cta"
          href={heroHref}
          place="cadeaux-bar"
          thumb={<GiftArt g={star} />}
          title="Cadeaux Pokémon"
          sub={star.name}
          label="Voir le prix"
        />
      )}
    </WidePage>
  );
}
