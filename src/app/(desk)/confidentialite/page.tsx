import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { SITE_DOMAIN, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Confidentialité · ${SITE_NAME}`,
  alternates: { canonical: "/confidentialite" },
};

export default function Privacy() {
  return (
    <LegalPage path="/confidentialite" title="Règles de confidentialité" updated="30 septembre 2026">
      <p>
        {SITE_NAME} ({SITE_DOMAIN}) est un site gratuit pour ranger et suivre sa collection de cartes Pokémon dans des classeurs virtuels. Cette page
        explique quelles données le site collecte, pourquoi, avec qui elles sont partagées, combien de temps elles sont gardées et comment les
        supprimer. On collecte le moins de choses possible, et rien n&apos;est vendu ni utilisé pour de la publicité.
      </p>

      <h2>1. Qui est responsable</h2>
      <p>
        {SITE_NAME} est un projet personnel édité par un particulier, Johan (responsable du traitement). Pour toute question sur tes données, utilise
        le <Link href="/contact">formulaire de contact</Link>.
      </p>

      <h2>2. Les données collectées</h2>
      <p>
        <b>Sans compte.</b> Tu peux jouer sans compte : ta collection et ton pseudo restent alors uniquement dans ton navigateur (localStorage) et ne
        sont envoyés nulle part.
      </p>
      <p>
        <b>Avec un compte.</b> Si tu te connectes, on enregistre :
      </p>
      <ul>
        <li>ton adresse e-mail, pour te reconnaître et t&apos;envoyer le lien de connexion ;</li>
        <li>la date de création du compte et de ta dernière connexion ;</li>
        <li>
          ta sauvegarde : ton pseudo, tes classeurs et ta collection (cartes possédées, variante, état, quantité, prix payé que tu as saisi).
        </li>
      </ul>
      <p>
        <b>Formulaire de contact.</b> Si tu nous écris : ton e-mail, le sujet et ton message.
      </p>
      <p>
        <b>Mesure d&apos;audience.</b> Des statistiques de visite anonymes (pages vues, pays, type d&apos;appareil), sans cookie et sans suivi
        d&apos;une visite à l&apos;autre.
      </p>
      <p>
        Le site ne collecte aucune donnée de paiement, de localisation précise, ni aucun contact de ton carnet d&apos;adresses.
      </p>

      <h2>3. Connexion avec Google</h2>
      <p>Si tu choisis « Continuer avec Google », Google nous transmet, avec ton accord, uniquement :</p>
      <ul>
        <li>ton adresse e-mail ;</li>
        <li>ton nom et ta photo de profil (informations de profil publiques).</li>
      </ul>
      <p>
        Ces informations servent seulement à créer ton compte {SITE_NAME}, à te reconnaître quand tu reviens et à te proposer un pseudo (ton prénom).
        {SITE_NAME} n&apos;accède à rien d&apos;autre de ton compte Google : ni tes e-mails, ni tes contacts, ni tes fichiers, ni ton agenda.
      </p>
      <p>
        Les données reçues de Google ne sont ni vendues, ni partagées avec des tiers (en dehors de l&apos;hébergeur technique ci-dessous), ni
        utilisées pour de la publicité, ni pour entraîner des modèles d&apos;intelligence artificielle. L&apos;utilisation des informations reçues
        des API Google respecte les{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">règles relatives aux données utilisateur des services d&apos;API Google</a>
        , y compris les exigences d&apos;utilisation limitée (Limited Use).
      </p>
      <p>
        Tu peux retirer l&apos;accès de {SITE_NAME} à ton compte Google à tout moment depuis{" "}
        <a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a>.
      </p>

      <h2>4. Pourquoi ces données sont utilisées</h2>
      <ul>
        <li>faire fonctionner ton compte et la connexion (exécution du service) ;</li>
        <li>sauvegarder ta collection et la synchroniser entre tes appareils (exécution du service) ;</li>
        <li>répondre à tes messages (ta demande) ;</li>
        <li>savoir combien de personnes visitent le site, de façon anonyme (intérêt légitime).</li>
      </ul>
      <p>Aucune décision automatisée, aucun profilage, aucune publicité.</p>

      <h2>5. Avec qui elles sont partagées</h2>
      <p>Tes données ne sont jamais vendues. Elles passent uniquement par les prestataires techniques nécessaires au site :</p>
      <ul>
        <li>
          <a href="https://supabase.com/privacy">Supabase</a> : comptes, sauvegardes et messages du formulaire de contact (base de données et connexion) ;
        </li>
        <li>
          <a href="https://vercel.com/legal/privacy-policy">Vercel</a> : hébergement du site et statistiques de visite anonymes ;
        </li>
        <li>
          <a href="https://formsubmit.co/privacy.pdf">FormSubmit</a> : copie par e-mail des messages du formulaire de contact ;
        </li>
        <li>Google : uniquement si tu choisis la connexion avec Google.</li>
      </ul>
      <p>
        Ces prestataires peuvent traiter des données hors de l&apos;Union européenne, avec les garanties prévues par le RGPD (clauses contractuelles
        types).
      </p>

      <h2>6. Sécurité</h2>
      <p>
        Les échanges avec le site sont chiffrés (HTTPS). Dans la base de données, chaque joueur ne peut lire et modifier que sa propre sauvegarde
        (règles d&apos;accès par ligne). La connexion se fait sans mot de passe : aucun mot de passe n&apos;est stocké.
      </p>

      <h2>7. Combien de temps elles sont gardées</h2>
      <ul>
        <li>compte et sauvegarde : tant que ton compte existe, supprimés sous 30 jours après ta demande ;</li>
        <li>messages de contact : le temps de te répondre, puis au plus un an ;</li>
        <li>données dans ton navigateur : jusqu&apos;à ce que tu les effaces (données du site dans ton navigateur).</li>
      </ul>

      <h2>8. Tes droits</h2>
      <p>
        Tu peux à tout moment accéder à tes données, les corriger, les récupérer, t&apos;opposer à leur traitement ou demander la suppression de ton
        compte et de ta sauvegarde, via le <Link href="/contact">formulaire de contact</Link> (sujet « Supprimer mon compte / mes données »). Ta
        collection peut aussi être exportée à tout moment depuis NookDex OS → Sauvegarde. Si tu estimes que tes droits ne sont pas respectés, tu peux
        saisir la <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
      </p>

      <h2>9. Enfants</h2>
      <p>
        Le site s&apos;adresse à tous les collectionneurs. Si tu as moins de 15 ans, demande à un parent avant de créer un compte.
      </p>

      <h2>10. Changements</h2>
      <p>Si cette page change, la date en haut est mise à jour. Pour un changement important, on te prévient sur le site.</p>
    </LegalPage>
  );
}
