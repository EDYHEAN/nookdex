import type { Metadata } from "next";
import Link from "next/link";
import { WidePage } from "@/components/WidePage";
import { OpenHash } from "@/components/shop/OpenHash";
import { Affiliate, AmazonButton, ProductRail, Stage } from "@/components/shop/ShopBits";
import { ShopHero } from "@/components/shop/ShopHero";
import { StickyBuy } from "@/components/shop/StickyBuy";
import s from "@/components/shop/Shop.module.css";
import { SHOP_PATH, SHOP_PATH_EN, byInterest, goLabel, kindLabel, productHref, productPic, shopGroupsUs, shopUpdatedUs } from "@/lib/amazonShop";
import { formatDate } from "@/lib/blog";
import { kindArt } from "@/lib/kindArt";
import { setPagePath } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/** the groups, newest set first (the page's searches are about it) */
const groups = [...shopGroupsUs].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
const [newest, second] = groups;
/** the two newest sets by name: what people search (« delta reign amazon invite ») */
const TITLE = `Pokémon on Amazon: ${newest.name}${second ? ` and ${second.name}` : ""} invites`;
const DESCRIPTION = `${newest.name} Elite Trainer Box, booster box and bundle on Amazon.com: how invitations work, and every sealed set in one place.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: SHOP_PATH_EN, languages: { fr: SHOP_PATH, en: SHOP_PATH_EN } },
  openGraph: { type: "website", url: SHOP_PATH_EN, siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, locale: "en_US", images: ["/opengraph-image.jpg"] },
};

const FAQ = [
  {
    q: "How do I get an Amazon invite for Pokémon cards?",
    a: "Open the product's page on Amazon.com. When it shows “Request invitation”, click it. If you're picked, Amazon emails you and you get a limited time to buy it.",
  },
  {
    q: "Why does Amazon sell Pokémon boxes by invitation?",
    a: "To get sought-after boxes to collectors rather than to resellers who buy the stock in seconds. Not every listing uses it: some are simply in or out of stock.",
  },
  {
    q: "Does requesting an invitation cost anything?",
    a: "No. You only pay if you're invited and still decide to buy.",
  },
  {
    q: "How do I avoid overpaying?",
    a: "Check that the listing says “Ships from and sold by Amazon”. Other sellers often list the same box well above its normal price.",
  },
];

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

const longDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The sealed Pokémon products on amazon.com, set by set: the English twin of /invitations-amazon, its best page for clicks
 * (Johan, 2026-11-08). English packaging only (TCGplayer's pictures, src/data/amazon-products-us.json). The buttons promise
 * no invitation: amazon.com's listings aren't all sold that way.
 */
export default function AmazonInvites() {
  const count = groups.reduce((n, g) => n + g.products.length, 0);
  const today = new Date().toISOString().slice(0, 10);
  const [first, ...rest] = groups;
  const top = byInterest(first.products)[0];
  const pic = productPic(top, first);
  const heroHref = productHref(top, "invit", "en");
  const page = first.setId ? setPagePath("en", first.setId) : null;
  const soon = !!first.date && first.date > today;

  const hero = (
    <ShopHero
      head={
        <>
          <p className={s.eyebrow}>Amazon invites</p>
          <h1 className={s.title}>
            <span className={s.rest}>Pokémon on Amazon:</span>
            <span className={s.big}>{first.name}</span>
            <span className={s.rest}>{second ? `and ${second.name} invites` : "invites"}</span>
          </h1>
          {first.date && (
            <p className={s.when}>
              {first.code && `${first.code} · `}
              {soon ? "Out " : "Released "}
              <b>{longDay(first.date)}</b>
            </p>
          )}
        </>
      }
      stage={<Stage pic={pic} kind={top.kind} fan={[]} alt={`${kindLabel(top.kind, "en")} ${first.name}`} />}
      buy={
        <>
          <p className={s.what}>
            <b>{top.name}</b>
          </p>
          <div className={s.btns}>
            <AmazonButton id="hero-cta" href={heroHref} place="invit" size="lg" nudge>
              {goLabel(top, soon, "en")}
            </AmazonButton>
            {page && (
              <Link prefetch={false} href={page} className={`${s.btn} ${s.alt}`}>
                The cards and their prices
              </Link>
            )}
          </div>
          <ul className={s.reassure}>
            <li>Requesting an invite is free</li>
            <li>Check “Ships from and sold by Amazon”</li>
          </ul>
          <Affiliate lang="en" />
        </>
      }
    />
  );

  return (
    <WidePage
      en
      shop={SHOP_PATH_EN}
      alt={{ href: SHOP_PATH, label: "les produits Pokémon sur amazon.fr, en français" }}
      crumbs={[{ href: SHOP_PATH_EN, label: "Amazon invites" }]}
      hero={hero}
    >
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: "Amazon invites", item: `${SITE_URL}${SHOP_PATH_EN}` },
        ],
      })}
      {ld({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: "en",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })}
      <OpenHash />

      <p className={s.answer}>
        <b>In short</b>
        When an Amazon listing shows “Request invitation”, ask for one (it&apos;s free): Amazon emails you if you can buy. {count} products, updated{" "}
        {formatDate(shopUpdatedUs, "en")}.
      </p>

      <h2>How do Amazon invites work?</h2>
      <ol className={s.steps}>
        <li>
          <span>
            <b>Request it</b>
            A button on the product&apos;s page, on Amazon.com.
          </span>
        </li>
        <li>
          <span>
            <b>Amazon emails you</b>
            If you&apos;re picked, you get a limited time to buy.
          </span>
        </li>
        <li>
          <span>
            <b>Check the seller</b>
            “Ships from and sold by Amazon”: no reseller markup.
          </span>
        </li>
      </ol>

      <section id={first.id}>
        <h2>
          {first.name}
          {first.code ? ` (${first.code})` : ""}
        </h2>
        {(first.date || page) && (
          <p>
            {first.date && `${soon ? "Out" : "Released"} ${formatDate(first.date, "en")}. `}
            {page && <Link prefetch={false} href={page}>The set&apos;s cards and their prices →</Link>}
          </p>
        )}
        <ProductRail group={first} place="invit" lang="en" />
        <ul className={s.chips}>
          {rest.map((o) => (
            <li key={o.id}>
              <a href={`#${o.id}`}>{o.name}</a>
            </li>
          ))}
        </ul>
      </section>

      {rest.map((g) => {
        const gp = g.setId ? setPagePath("en", g.setId) : null;
        return (
          <details key={g.id} id={g.id} className={s.group}>
            <summary>
              <h2>
                {g.name}
                {g.code ? ` (${g.code})` : ""}
              </h2>
              <small>
                {g.products.length} product{g.products.length > 1 ? "s" : ""}
              </small>
            </summary>
            <div className={s.groupBody}>
              {(g.date || gp) && (
                <p>
                  {g.date && `Released ${formatDate(g.date, "en")}. `}
                  {gp && <Link prefetch={false} href={gp}>The set&apos;s cards and their prices →</Link>}
                </p>
              )}
              <ProductRail group={g} place="invit" lang="en" />
            </div>
          </details>
        );
      })}

      <section className={s.faq} data-sticky-stop>
        <h2>Frequently asked questions</h2>
        {FAQ.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <p className={s.small}>
        Links to Amazon are affiliate links: they don&apos;t change your price (<Link href="/conditions#amazon">terms</Link>). Product pictures: The Pokémon
        Company, via <a href="https://www.tcgplayer.com">TCGplayer</a>.
      </p>

      <StickyBuy
        target="hero-cta"
        href={heroHref}
        place="invit-bar"
        thumb={pic ? <img src={pic.src} width={pic.w} height={pic.h} alt="" loading="lazy" /> : <span dangerouslySetInnerHTML={{ __html: kindArt(top.kind) }} />}
        title={first.name}
        sub={top.name}
        label={soon ? "Pre-orders" : "On Amazon"}
      />
    </WidePage>
  );
}
