import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { ShopShelf } from "@/components/ShopShelf";
import { AMAZON_NOTICE } from "@/lib/amazon";
import { SHOP_PATH, shopGroups, shopUpdated } from "@/lib/amazonShop";
import { formatDate } from "@/lib/blog";
import { setPagePath } from "@/lib/setPath";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import cal from "@/components/ReleaseCalendar.module.css";

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

/** The sealed Pokémon products Amazon.fr sells (mostly by invitation), set by set: a French page (lib/amazonShop). */
export default function InvitationsAmazon() {
  const count = shopGroups.reduce((n, g) => n + g.products.length, 0);
  const today = new Date().toISOString().slice(0, 10);
  // the newest set first (the page's searches are about it), then the file's order
  const groups = newest ? [shopGroups.find((g) => g.id === newest.id)!, ...shopGroups.filter((g) => g.id !== newest.id)] : shopGroups;
  return (
    <LegalPage path={SHOP_PATH} title={TITLE}>
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

      {/* one sentence, then the buttons: on a phone the first one sat at 1 154 px, under the summary and the set chips */}
      <p className={cal.answer}>
        <b>En bref</b>
        Demande ton invitation sur la fiche Amazon (c&apos;est gratuit) : Amazon t&apos;écrit si tu peux acheter, au prix public. {count} produits,
        mis à jour le {formatDate(shopUpdated, "fr")}.
      </p>

      {groups.map((g, i) => {
        const page = g.setId ? setPagePath("fr", g.setId) : null;
        return (
          <div key={g.id} id={g.id}>
            <h2>
              {g.name}
              {g.code ? ` (${g.code})` : ""}
            </h2>
            {(g.date || page) && (
              <p>
                {g.date && `${g.date > today ? "Sort le" : "Sortie le"} ${formatDate(g.date, "fr")}. `}
                {page && <Link href={page}>Les cartes de l&apos;extension et leurs prix →</Link>}
              </p>
            )}
            <ShopShelf group={g} place="invit" notice={false} />
            {/* a chip per set, once the newest set's buttons are on screen: straight to the others' products */}
            {i === 0 && (
              <p>
                {groups.slice(1).map((o, j) => (
                  <span key={o.id}>
                    {j > 0 && " · "}
                    <a href={`#${o.id}`}>{o.name}</a>
                  </span>
                ))}
              </p>
            )}
          </div>
        );
      })}

      <h2>Questions fréquentes</h2>
      {FAQ.map((f) => (
        <div key={f.q}>
          <h3 className={cal.q}>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <p className={cal.updated}>
        Les liens vers Amazon sont des liens affiliés : ils ne changent rien à ton prix. {AMAZON_NOTICE} Visuels des produits : The Pokémon Company, via{" "}
        <a href="https://www.pokepedia.fr">Poképédia</a>.
      </p>
    </LegalPage>
  );
}
