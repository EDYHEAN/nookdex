import type { Metadata } from "next";
import Link from "next/link";
import { serverLang } from "@/lib/serverLang";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL, MANAGED_PAYMENTS, SITE_NAME } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  return en ? { title: `Terms of sale · ${SITE_NAME}`, alternates: { canonical: "/conditions-de-vente" } } : { title: `Conditions de vente · ${SITE_NAME}`, alternates: { canonical: "/conditions-de-vente" } };
}

// The shop (docs/skins.md), two ways of selling (lib/site MANAGED_PAYMENTS): with Stripe Managed Payments the buyer
// pays Link, the merchant of record (taxes, receipts, refunds, withdrawal rights) and these terms say what the player gets
// on NookDex's side; without it Johan sells (VAT-exempt), the buyer waives withdrawal before paying, a mediator is named.

function Fr() {
  return (
    <LegalPage path="/conditions-de-vente" title="Conditions de vente" updated="16 octobre 2026">
      <p>
        {SITE_NAME} reste gratuit. La boutique vend en option des objets de décoration pour ton bureau : tout ce qui touche à tes cartes et à
        Pokémon reste gratuit.
      </p>

      <h2>Ce que tu achètes</h2>
      <p>
        Des objets numériques pour le bureau {SITE_NAME} (une fenêtre, une déco, un chapeau pour Warwick, une lumière, une radio…), à l&apos;unité ou
        en pack. Chaque achat est unique : pas d&apos;abonnement, rien qui se renouvelle. Tu peux essayer un objet sur ton bureau avant de
        l&apos;acheter.
      </p>

      <h2>Prix et paiement</h2>
      <p>
        Les prix sont affichés dans la boutique, en euros, toutes taxes comprises ; la page de paiement peut les convertir dans ta monnaie.{" "}
        {MANAGED_PAYMENTS ? (
          <>
            Le paiement se fait sur une page sécurisée de Stripe : la vente est faite via Link, le service de paiement de Stripe, qui encaisse le
            paiement, applique la TVA de ton pays et t&apos;envoie le reçu par e-mail. Sur ton relevé, l&apos;achat apparaît comme « LINK.COM*
            NOOKDEX ».
          </>
        ) : (
          <>
            Le vendeur est {LEGAL.name}, entrepreneur individuel (voir les <Link href="/mentions-legales">mentions légales</Link>) : TVA non
            applicable, article 293 B du CGI. Le paiement se fait sur une page sécurisée de Stripe, qui t&apos;envoie le reçu par e-mail ; sur ton
            relevé, l&apos;achat apparaît comme « NOOKDEX ».
          </>
        )}{" "}
        {SITE_NAME} ne voit jamais tes coordonnées bancaires.
      </p>

      <h2>Livraison</h2>
      <p>
        Il faut un compte {SITE_NAME} pour acheter. L&apos;objet arrive dans ton casier tout de suite après le paiement, gardé avec ton compte : tu le
        retrouves sur tous tes appareils une fois connecté. S&apos;il n&apos;est pas arrivé après quelques minutes, écris-nous.
      </p>

      <h2>Remboursement et rétractation</h2>
      <p>
        Un souci avec un achat ? Écris-nous à <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>, on regarde chaque demande.{" "}
        {MANAGED_PAYMENTS ? (
          <>
            Tu peux aussi demander un remboursement à Link (<a href="https://support.link.com/topics/sold-through-link">support.link.com</a>), qui
            applique les règles de rétractation de ton pays.
          </>
        ) : (
          <>
            L&apos;objet est un contenu numérique livré dès le paiement : en cliquant sur « Acheter », tu demandes sa livraison immédiate et tu
            renonces à ton droit de rétractation de 14 jours (article L221-28 du Code de la consommation), comme l&apos;indique la page de
            paiement. Un objet qui
            ne marche pas est remboursé.
          </>
        )}{" "}
        Un objet remboursé quitte ton casier.
      </p>

      {!MANAGED_PAYMENTS && LEGAL.mediator && (
        <>
          <h2>Médiation</h2>
          <p>
            En cas de litige que nous n&apos;arrivons pas à régler ensemble, tu peux saisir gratuitement le médiateur de la consommation :{" "}
            <a href={LEGAL.mediator.url}>{LEGAL.mediator.name}</a> ({LEGAL.mediator.address}), en déposant ta demande sur son site.
          </p>
        </>
      )}

      <h2>Tes objets</h2>
      <p>
        Un objet acheté te donne le droit de l&apos;utiliser sur ton bureau {SITE_NAME}, pour toi : il ne se revend pas et ne se transfère pas à un
        autre compte. Les illustrations restent la propriété de {SITE_NAME}. Un objet en édition limitée quitte la boutique après sa date, mais reste
        à ceux qui l&apos;ont acheté. Si tu supprimes ton compte, tes objets partent avec lui. Si {SITE_NAME} devait fermer un jour, on te
        préviendrait à l&apos;avance.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL.name}, {SITE_NAME} : <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> ou le <Link href="/contact">formulaire de contact</Link>.
        Voir aussi les <Link href="/mentions-legales">mentions légales</Link> et les <Link href="/conditions">conditions d&apos;utilisation</Link>.
        Ces conditions relèvent du droit français.
      </p>
    </LegalPage>
  );
}

function En() {
  return (
    <LegalPage path="/conditions-de-vente" title="Terms of sale" updated="16 October 2026" en>
      <p>
        {SITE_NAME} stays free. The shop sells optional decorations for your desk: everything about your cards and Pokémon stays free.
      </p>

      <h2>What you buy</h2>
      <p>
        Digital items for the {SITE_NAME} desk (a window, decorations, a hat for Warwick, a light, a radio…), one by one or in a pack. Each purchase
        is a one-off: no subscription, nothing renews. You can try an item on your desk before buying it.
      </p>

      <h2>Prices and payment</h2>
      <p>
        Prices are shown in the shop, in euros, taxes included; the payment page may convert them into your currency.{" "}
        {MANAGED_PAYMENTS ? (
          <>
            You pay on a secure Stripe page: the sale is made through Link, Stripe&apos;s payment service, which takes the payment, applies your
            country&apos;s VAT or sales tax and e-mails you the receipt. On your statement, the purchase shows as &laquo; LINK.COM* NOOKDEX &raquo;.
          </>
        ) : (
          <>
            The seller is {LEGAL.name}, sole trader (see the <Link href="/mentions-legales">legal notice</Link>): VAT not applicable, article 293 B
            of the French tax code. You pay on a secure Stripe page, which e-mails you the receipt; on your statement, the purchase shows as &laquo;
            NOOKDEX &raquo;.
          </>
        )}{" "}
        {SITE_NAME} never sees your card details.
      </p>

      <h2>Delivery</h2>
      <p>
        You need a {SITE_NAME} account to buy. The item reaches your locker right after the payment, kept with your account: you find it on all your
        devices once signed in. If it hasn&apos;t arrived after a few minutes, write to us.
      </p>

      <h2>Refunds and withdrawal</h2>
      <p>
        A problem with a purchase? Write to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>, we look at every request.{" "}
        {MANAGED_PAYMENTS ? (
          <>
            You can also ask Link for a refund (<a href="https://support.link.com/topics/sold-through-link">support.link.com</a>), which applies
            your country&apos;s withdrawal rules.
          </>
        ) : (
          <>
            The item is digital content delivered as soon as you pay: by clicking &laquo; Buy &raquo;, you ask for it at once and waive your 14-day
            right of withdrawal (article L221-28 of the French consumer code), as the payment page says. An item that doesn&apos;t work is refunded.
          </>
        )}{" "}
        A refunded item leaves your locker.
      </p>

      {!MANAGED_PAYMENTS && LEGAL.mediator && (
        <>
          <h2>Mediation</h2>
          <p>
            For a dispute we can&apos;t settle together, you can turn to the consumer mediator, free of charge:{" "}
            <a href={LEGAL.mediator.url}>{LEGAL.mediator.name}</a> ({LEGAL.mediator.address}), by filing your request on its site.
          </p>
        </>
      )}

      <h2>Your items</h2>
      <p>
        A purchased item lets you use it on your own {SITE_NAME} desk: it can&apos;t be resold or moved to another account. The pictures remain{" "}
        {SITE_NAME}&apos;s property. A limited-edition item leaves the shop after its date, but stays with those who bought it. If you delete your
        account, your items go with it. Should {SITE_NAME} ever close, we would let you know in advance.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL.name}, {SITE_NAME}: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> or the <Link href="/contact">contact form</Link>. See also
        the <Link href="/mentions-legales">legal notice</Link> and the <Link href="/conditions">terms of use</Link>. These terms are governed by
        French law.
      </p>
    </LegalPage>
  );
}

export default async function TermsOfSale() {
  return (await serverLang()) === "en" ? <En /> : <Fr />;
}
