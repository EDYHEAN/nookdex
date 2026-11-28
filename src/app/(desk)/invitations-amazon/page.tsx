import type { Metadata } from "next";
import Link from "next/link";
import { WidePage } from "@/components/WidePage";
import { Countdown } from "@/components/shop/Countdown";
import { OpenHash } from "@/components/shop/OpenHash";
import { Affiliate, AmazonButton, ProductCard, ProductRail, Stage } from "@/components/shop/ShopBits";
import { ReleaseAlert } from "@/components/shop/ReleaseAlert";
import { ShopHero } from "@/components/shop/ShopHero";
import { StickyBuy } from "@/components/shop/StickyBuy";
import s from "@/components/shop/Shop.module.css";
import { SetValue } from "@/components/shop/SetValue";
import {
  KIND_LABEL,
  SHOP_PATH,
  SHOP_PATH_EN,
  boosterPics,
  byInterest,
  kindLabel,
  goLabel,
  productHref,
  productPic,
  shopGroups,
  shopUpdated,
  shortSetName,
  stickyLabel,
  firstNow,
  GIFTS_PATH,
  giftSeason,
} from "@/lib/amazonShop";
import { formatDate } from "@/lib/blog";
import { kindArt } from "@/lib/kindArt";
import { daysLeft } from "@/lib/parisTime";
import { daysUntil, nextSetName } from "@/lib/releases";
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
  alternates: { canonical: SHOP_PATH, languages: { fr: SHOP_PATH, en: SHOP_PATH_EN } },
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
    q: "J'ai reçu mon invitation, comment acheter ?",
    a: "Ouvre la fiche du produit sur Amazon.fr, connecté au même compte que ta demande : le bouton « Acheter » a remplacé la demande d'invitation. L'e-mail d'Amazon dit jusqu'à quand.",
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
  /**
   * The most looked-for box under the lamp (its Elite Trainer Box, Johan 2026-11-22), and once the set is out what can be
   * bought straight away as the second button (Johan, 2026-11-15: Amazon's report gave nookdex-invit-21 134 clicks and no
   * sale; the invited buy days later from Amazon's own mail, out of our 24 h cookie). Product pages, never a search (a
   * search's resellers sold nothing); a box sold at once goes to nookdex-achat-21 (productHref).
   */
  const top = first ? byInterest(first.products)[0] : undefined;
  const pic = top ? productPic(top, first) : null;
  const fan = first ? boosterPics(first) : [];
  const buyNow = !soon && top?.buy === "now" && !!top.asin;
  const heroHref = top ? productHref(top, "invit") : null;
  // its quiet button beside the hero's: the set's first box sold at once, when the hero isn't
  const nowOfSet = first ? firstNow(first.products) : undefined;
  const second = !soon && nowOfSet && nowOfSet !== top ? nowOfSet : null;
  // what can be bought at once, every set's, newest first (the hero's apart): « Sans invitation, tout de suite »
  const nowAll = [...shopGroups]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .flatMap((g) => byInterest(g.products).filter((p) => p.buy === "now" && p.asin && !(g === first && p === top)).map((p) => ({ g, p })))
    .slice(0, 8);
  // « Invitation reçue ? »: the newest set's boxes by invitation, once it's out (the invited come back through our link)
  const invites = first && !soon ? byInterest(first.products).filter((p) => p.asin && p.buy === "invite") : [];
  const page = first?.setId ? setPagePath("fr", first.setId) : null;
  const days = first?.date ? daysUntil(first.date) : 0;
  // the h1 says the title, its set's name big
  // the newest set alone in big (« Règne Delta et 30e Anniversaire » wrapped on 3 lines): the second one on the line under it
  const big = newest ? newest.short : null;
  const [pre, post] = big && TITLE.includes(big) ? TITLE.split(big) : [TITLE, ""];

  const hero = first && top && (
    <ShopHero
      head={
        <>
          <p className={s.eyebrow}>Amazon.fr · sur invitation</p>
          <h1 className={s.title}>
            {pre && <span className={s.rest}>{pre.trim().replace(/ :$/, "\u00a0:")}</span>}
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
            <AmazonButton id="hero-cta" href={heroHref!} place={buyNow ? "invit-achat" : "invit"} size="lg" nudge>
              {goLabel(top, soon)}
            </AmazonButton>
            {second ? (
              <AmazonButton href={productHref(second, "invit")} place="invit-achat" alt>
                {kindLabel(second.kind)} sans invitation
              </AmazonButton>
            ) : (
              page && (
                <Link prefetch={false} href={page} className={`${s.btn} ${s.alt}`}>
                  Les cartes et leurs prix
                </Link>
              )
            )}
          </div>
          <ul className={s.reassure}>
            {soon || top.buy === "invite" ? (
              <>
                <li>Gratuit</li>
                <li>Sans engagement</li>
                <li>Au prix public</li>
              </>
            ) : (
              <>
                {top.buy === "now" && <li>Sans invitation</li>}
                <li>Vérifie « Expédié et vendu par Amazon »</li>
              </>
            )}
          </ul>
          {second && page && (
            <Link prefetch={false} href={page} className={s.alertJump}>
              Les cartes et leurs prix →
            </Link>
          )}
          <Affiliate lang="fr" />
          {invites.length > 0 && (
            <a href="#invitation-recue" className={s.alertJump}>
              ✉ Invitation reçue ? Ouvre ta fiche ↓
            </a>
          )}
          {/* the alert on the first screen, as a quiet link: one yellow button per screen */}
          <a href="#alerte" className={s.alertJump}>
            ✉ Préviens-moi à la prochaine sortie ↓
          </a>
        </>
      }
    />
  );

  return (
    <WidePage shop={SHOP_PATH} alt={{ href: SHOP_PATH_EN, label: "the Pokémon products on amazon.com, in English" }} crumbs={[{ href: SHOP_PATH, label: "Invitations Amazon" }]} hero={hero}>
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
        {nowAll.length > 0 || buyNow
          ? "Deux façons d'acheter : ce qui est marqué « Sans invitation » s'achète tout de suite. Le reste, tu demandes l'invitation (c'est gratuit) et Amazon t'écrit si c'est ton tour, au prix public."
          : "Demande ton invitation sur la fiche Amazon (c'est gratuit) : Amazon t'écrit si tu peux acheter, au prix public."}{" "}
        {count} produits, mis à jour le {formatDate(shopUpdated, "fr")}.
      </p>

      {nowAll.length > 0 && (
        <section id="sans-invitation">
          <h2>Sans invitation, tout de suite</h2>
          <ul className={s.rail}>
            {nowAll.map(({ g, p }) => (
              <li key={p.asin}>
                <ProductCard group={g} product={p} place="invit" soon={false} />
              </li>
            ))}
          </ul>
          <Affiliate lang="fr" many={nowAll.length > 1} />
        </section>
      )}

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

      {/* step 4 (Johan, 2026-11-22): practical only, never "buy through us" (the program forbids pushing clicks) */}
      {first && invites.length > 0 && (
        <section id="invitation-recue" className={s.recue}>
          <h2>✉ Invitation reçue ?</h2>
          <p>Ouvre la fiche depuis ici, connecté au même compte Amazon que ta demande : le bouton « Acheter » remplace la demande.</p>
          <ul>
            {invites.map((p) => {
              const ip = productPic(p, first);
              return (
                <li key={p.asin}>
                  <a href={productHref(p, "invit")} target="_blank" rel="sponsored noopener" data-amazon-place="invit-recue">
                    {ip && <img src={ip.src} width={ip.w} height={ip.h} alt="" loading="lazy" />}
                    <span>
                      <b>{KIND_LABEL[p.kind]}</b>
                      Ouvrir la fiche ↗
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          <Affiliate lang="fr" many={invites.length > 1} />
        </section>
      )}

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
          {/* right after the products: nothing to ask for now? we'll tell you */}
          <ReleaseAlert lang="fr" next={nextSetName("fr")} />
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
      {!first && <ReleaseAlert lang="fr" next={nextSetName("fr")} />}

      {rest.length > 0 && <h2>Les autres extensions sur Amazon</h2>}

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

      {giftSeason() && (
        <Link prefetch={false} href={GIFTS_PATH} className={s.giftStrip}>
          <span aria-hidden>🎁</span>
          <span>
            <b>Un cadeau sans attendre d&apos;invitation ?</b>
            Les idées à moins de 20 € et 50 €
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      {/* our own figures beside the shop's: the newest set out, its cards' prices (shop/SetValue) */}
      <SetValue lang="fr" setIds={shopGroups.map((g) => g.setId)} />

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
          place={buyNow ? "invit-achat-bar" : "invit-bar"}
          thumb={
            (pic ?? fan[0]) ? (
              <img src={(pic ?? fan[0])!.src} width={(pic ?? fan[0])!.w} height={(pic ?? fan[0])!.h} alt="" loading="lazy" />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: kindArt(top.kind) }} />
            )
          }
          title={days > 0 ? `${shortSetName(first.name)} · J-${days}` : shortSetName(first.name)}
          sub={top.name}
          label={stickyLabel(top, soon)}
        />
      )}
    </WidePage>
  );
}
