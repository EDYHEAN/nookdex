import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import Link from "next/link";
import { SITE_DOMAIN, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Confidentialité · ${SITE_NAME}`,
  alternates: { canonical: "/confidentialite" },
};

export default function Privacy() {
  return (
    <LegalPage title="Règles de confidentialité" updated="30 septembre 2026">
      <p>
        {SITE_NAME} ({SITE_DOMAIN}) est un projet personnel pour ranger sa collection de cartes Pokémon. On collecte le moins de choses possible, et
        rien n&apos;est vendu ni utilisé pour de la publicité.
      </p>

      <h2>Sans compte</h2>
      <p>
        Ta collection (classeurs, cartes, état, prix payés) et ton pseudo restent <b>dans ton navigateur</b> (localStorage). Ils ne sont envoyés
        nulle part.
      </p>

      <h2>Avec un compte en ligne</h2>
      <p>Si tu te connectes (lien par e-mail ou Google), on enregistre :</p>
      <ul>
        <li>ton adresse e-mail, et avec Google ton nom et ta photo de profil, pour te reconnaître ;</li>
        <li>ta collection, ton pseudo et tes classeurs, pour les retrouver sur tous tes appareils.</li>
      </ul>
      <p>
        Ces données sont hébergées par <a href="https://supabase.com/privacy">Supabase</a>. Chaque joueur ne peut lire que sa propre sauvegarde. Elles
        sont gardées tant que ton compte existe.
      </p>

      <h2>Mesure d&apos;audience</h2>
      <p>
        Le site utilise <a href="https://vercel.com/docs/analytics/privacy-policy">Vercel Web Analytics</a> pour compter les visites : sans cookie et
        sans suivi d&apos;une visite à l&apos;autre.
      </p>

      <h2>Formulaire de contact</h2>
      <p>
        Les messages envoyés depuis le formulaire (ton e-mail et ton message) passent par <a href="https://formsubmit.co/privacy.pdf">FormSubmit</a>{" "}
        qui nous les transmet par e-mail. Ils ne servent qu&apos;à te répondre.
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux à tout moment demander une copie de tes données ou la suppression de ton compte et de ta sauvegarde via le{" "}
        <Link href="/contact">formulaire de contact</Link>. Ta collection peut aussi être exportée à tout moment depuis NookDex OS → Sauvegarde.
      </p>
    </LegalPage>
  );
}
