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

const TITLE = "Invitations Amazon Pokémon : les produits du moment";
const DESCRIPTION =
  "Les coffrets Dresseur d'élite, displays, bundles et coffrets Pokémon vendus sur invitation par Amazon.fr, extension par extension, avec le lien pour demander ton invitation.";

export const metadata: Metadata = {
  title: `${TITLE} · ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: SHOP_PATH },
  openGraph: { type: "website", url: SHOP_PATH, siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, locale: "fr_FR" },
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

      <p className={cal.answer}>
        <b>En bref</b>
        Amazon vend les produits Pokémon scellés sur invitation : ouvre la fiche, demande ton invitation (c&apos;est gratuit), et Amazon t&apos;écrit si
        tu peux l&apos;acheter, au prix public. Voici les {count} produits du moment, extension par extension.
        <small>Mis à jour le {formatDate(shopUpdated, "fr")}.</small>
      </p>

      {/* a chip per set: straight to its products */}
      <p>
        {shopGroups.map((g, i) => (
          <span key={g.id}>
            {i > 0 && " · "}
            <a href={`#${g.id}`}>{g.name}</a>
          </span>
        ))}
      </p>

      {shopGroups.map((g) => {
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
            <ShopShelf group={g} notice={false} />
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
