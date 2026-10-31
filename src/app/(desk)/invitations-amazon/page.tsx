import type { Metadata } from "next";
import Link from "next/link";
import { WidePage } from "@/components/WidePage";
import { Countdown } from "@/components/shop/Countdown";
import { OpenHash } from "@/components/shop/OpenHash";
import { Affiliate, AmazonButton, ProductRail, Stage } from "@/components/shop/ShopBits";
import { ShopHero } from "@/components/shop/ShopHero";
import { StickyBuy } from "@/components/shop/StickyBuy";
import s from "@/components/shop/Shop.module.css";
import {
  KIND_LABEL,
  SHOP_PATH,
  boosterPics,
  byInterest,
  goLabel,
  productHref,
  productPic,
  shopGroups,
  shopUpdated,
  shortSetName,
} from "@/lib/amazonShop";
import { formatDate } from "@/lib/blog";
import { kindArt } from "@/lib/kindArt";
import { daysLeft } from "@/lib/parisTime";
import { daysUntil } from "@/lib/releases";
import { setPagePath } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * The two newest sets by name, without the series ("Règne Delta", not "Méga-Évolution Règne Delta"): the searches that
 * find this page are « regne delta amazon » (report of 2026-10-26), a generic title got few of their clicks.
 */
const [newest, second] = shopGroups
  .filter((g) => g.date)
  .sort((a, b) => b.date!.localeCompare(a.date!))
  // « 30e » as people type it, not the superscript « 30ᵉ »
  .map((g) => ({ ...g, short: g.name.replace(/^Méga-Évolution /, "").replace(/ᵉ/g, "e") }));
const soon = !!newest && newest.date! > new Date().toISOString().slice(0, 10);
/** Under 60 characters, without the site name (Google cut the old one at 70): before the release the set leads, for
 * « regne delta amazon », the page's best query (GSC, October 2026) */
const TITLE = !newest
  ? "Invitations Amazon Pokémon : les produits du moment"
  : soon
    ? `${newest.short} sur Amazon : invitation Pokémon et précommande`
    : `Invitation Amazon Pokémon : ${newest.short}${second ? ` et ${second.short}` : ""}`;
/** Under 155 characters (the old one, 226, was cut) */
const DESCRIPTION = newest
  ? `ETB, display et bundle ${newest.short} (${newest.code ? `${newest.code}, ` : ""}${formatDate(newest.date!, "fr")}) sur Amazon.fr : demande ton invitation, c'est gratuit.${second ? ` Aussi ${second.short}.` : ""}`
  : "Les coffrets Dresseur d'élite, displays et bundles Pokémon vendus sur invitation par Amazon.fr : demande ton invitation, c'est gratuit.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: SHOP_PATH },
  // a page's openGraph replaces the root one: without its image the shares had none
  openGraph: { type: "website", url: SHOP_PATH, siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, locale: "fr_FR", images: ["/opengraph-image.jpg"] },
};

const FAQ = [
  {
    q: "Comment avoir une invitation Amazon pour les cartes Pokémon ?",
    a: "Ouvre la fiche du produit sur Amazon.fr et clique sur « Demander une invitation ». Si tu es retenu, Amazon t'envoie un e-mail et tu as un temps limité pour l'acheter, au prix public.",
  },
  {
    q: "Pourquoi Amazon vend les produits Pokémon sur invitation ?",
    a: "Pour que les coffrets partent chez des collectionneurs et pas chez des revendeurs qui achètent tout le stock en quelques secondes pour le revendre plus cher.",
  },
  {
    q: "Demander une invitation, c'est payant ?",
    a: "Non, c'est gratuit et ça ne t'engage à rien : tu achètes seulement si tu es invité et que tu le veux toujours.",
  },
  {
    q: "Comment éviter de payer trop cher ?",
    a: "Vérifie que le produit est « Expédié et vendu par Amazon » : d'autres vendeurs proposent souvent le même coffret bien au-dessus de son prix.",
  },
];

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

const longDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The sealed Pokémon products Amazon.fr sells (mostly by invitation), set by set: a French page (lib/amazonShop). A shop
 * page (« Sous la lampe », WidePage shop, drawn without the room): the newest set in the hero, its products, how the
 * invitation works, the other sets folded.
 */
export default function InvitationsAmazon() {
  const count = shopGroups.reduce((n, g) => n + g.products.length, 0);
  const today = new Date().toISOString().slice(0, 10);
  // the newest set first (the page's searches are about it), then the file's order
  const first = newest ? shopGroups.find((g) => g.id === newest.id)! : shopGroups[0];
  const rest = shopGroups.filter((g) => g !== first);
  const top = first ? byInterest(first.products)[0] : undefined;
  const pic = top ? productPic(top, first) : null;
  const fan = first ? boosterPics(first) : [];
  const heroHref = top ? productHref(top, "invit") : null;
  const page = first?.setId ? setPagePath("fr", first.setId) : null;
  const days = first?.date ? daysUntil(first.date) : 0;
  // the h1 says the title, its set's name big
  const big = newest ? (soon ? newest.short : `${newest.short}${second ? ` et ${second.short}` : ""}`) : null;
  const [pre, post] = big && TITLE.includes(big) ? TITLE.split(big) : [TITLE, ""];

  const hero = first && top && (
    <ShopHero
      head={
        <>
          <p className={s.eyebrow}>Invitations Amazon</p>
          <h1 className={s.title}>
            {pre && <span className={s.rest}>{pre.trim()}</span>}
            {big && <span className={s.big}>{big}</span>}
            {post && <span className={s.rest}>{post.trim()}</span>}
          </h1>
          {first.date && (
            <p className={s.when}>
              {first.code && `${first.code} · `}
              {first.date > today ? "Sort le " : "Sorti le "}
              <b>{longDay(first.date)}</b>
            </p>
          )}
          {first.date && days > 0 && <Countdown day={first.date} days={daysLeft(first.date)} lang="fr" />}
        </>
      }
      stage={<Stage pic={pic} kind={top.kind} fan={fan} alt={pic ? `${KIND_LABEL[top.kind]} ${first.name}` : `Boosters ${first.name}`} />}
      buy={
        <>
          <p className={s.what}>
            <b>{top.name}</b>
            {/* its kind, unless its name says it */}
            {!top.name.startsWith(KIND_LABEL[top.kind]) && ` · ${KIND_LABEL[top.kind]}`}
          </p>
          <div className={s.btns}>
            <AmazonButton id="hero-cta" href={heroHref!} place="invit" size="lg" nudge>
              {goLabel(top, soon)}
            </AmazonButton>
            {page && (
              <Link prefetch={false} href={page} className={`${s.btn} ${s.alt}`}>
                Les cartes et leurs prix
              </Link>
            )}
          </div>
          <ul className={s.reassure}>
            <li>Gratuit</li>
            <li>Sans engagement</li>
            <li>Au prix public</li>
          </ul>
          <Affiliate lang="fr" />
        </>
      }
    />
  );

  return (
    <WidePage shop={SHOP_PATH} crumbs={[{ href: SHOP_PATH, label: "Invitations Amazon" }]} hero={hero}>
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Invitations Amazon", item: `${SITE_URL}${SHOP_PATH}` },
        ],
      })}
      {ld({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: "fr",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })}
      <OpenHash />
      {!hero && <h1>{TITLE}</h1>}

      <p className={s.answer}>
        <b>En bref</b>
        Demande ton invitation sur la fiche Amazon (c&apos;est gratuit) : Amazon t&apos;écrit si tu peux acheter, au prix public. {count} produits,
        mis à jour le {formatDate(shopUpdated, "fr")}.
      </p>

      <h2>Comment marche l&apos;invitation ?</h2>
      <ol className={s.steps}>
        <li>
          <span>
            <b>Tu la demandes</b>
            Un bouton sur la fiche du produit, sur Amazon.fr.
          </span>
        </li>
        <li>
          <span>
            <b>Amazon t&apos;écrit</b>
            Si tu es retenu, un e-mail t&apos;invite à l&apos;acheter, pour un temps limité.
          </span>
        </li>
        <li>
          <span>
            <b>Tu paies le prix public</b>
            Vérifie « Expédié et vendu par Amazon » : pas de revendeur au-dessus.
          </span>
        </li>
      </ol>

      {first && (
        <section id={first.id}>
          <h2>
            {first.name}
            {first.code ? ` (${first.code})` : ""}
          </h2>
          {(first.date || page) && (
            <p>
              {first.date && `${first.date > today ? "Sort le" : "Sortie le"} ${formatDate(first.date, "fr")}. `}
              {page && <Link prefetch={false} href={page}>Les cartes de l&apos;extension et leurs prix →</Link>}
            </p>
          )}
          <ProductRail group={first} place="invit" />
          {/* a chip per set: straight to the others' products */}
          <ul className={s.chips}>
            {rest.map((o) => (
              <li key={o.id}>
                <a href={`#${o.id}`}>{shortSetName(o.name)}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rest.map((g) => {
        const gp = g.setId ? setPagePath("fr", g.setId) : null;
        return (
          <details key={g.id} id={g.id} className={s.group}>
            <summary>
              <h2>
                {g.name}
                {g.code ? ` (${g.code})` : ""}
              </h2>
              <small>
                {g.products.length} produit{g.products.length > 1 ? "s" : ""}
              </small>
            </summary>
            <div className={s.groupBody}>
              {(g.date || gp) && (
                <p>
                  {g.date && `${g.date > today ? "Sort le" : "Sortie le"} ${formatDate(g.date, "fr")}. `}
                  {gp && <Link prefetch={false} href={gp}>Les cartes de l&apos;extension et leurs prix →</Link>}
                </p>
              )}
              <ProductRail group={g} place="invit" />
            </div>
          </details>
        );
      })}

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
        Les liens vers Amazon sont des liens affiliés : ils ne changent rien à ton prix (<Link href="/conditions#amazon">conditions</Link>). Visuels
        des produits : The Pokémon Company, via <a href="https://www.pokepedia.fr">Poképédia</a>.
      </p>

      {first && top && heroHref && (
        <StickyBuy
          target="hero-cta"
          href={heroHref}
          place="invit-bar"
          thumb={
            (pic ?? fan[0]) ? (
              <img src={(pic ?? fan[0])!.src} width={(pic ?? fan[0])!.w} height={(pic ?? fan[0])!.h} alt="" loading="lazy" />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: kindArt(top.kind) }} />
            )
          }
          title={days > 0 ? `${shortSetName(first.name)} · J-${days}` : shortSetName(first.name)}
          sub={top.name}
          label={soon ? "Précommandes" : top.asin ? "L'invitation" : "Sur Amazon"}
        />
      )}
    </WidePage>
  );
}
