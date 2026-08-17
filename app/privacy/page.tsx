import type { Metadata } from 'next';
import { LandingHeader } from '@/components/landing/header';
import { LandingFooter } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Confidentialité, CGU & mentions légales – AthleX',
  description:
    "Conditions générales d'utilisation, politique de confidentialité et mentions légales d'AthleX, éditée par NBS Innovation.",
};

const UPDATED = '23 mars 2026';
const CONTACT = 'contact@athlexapp.eu';
const EDITOR = 'NBS Innovation';

const SECTIONS = [
  { id: 'cgu', label: "Conditions générales d'utilisation" },
  { id: 'confidentialite', label: 'Politique de confidentialité' },
  { id: 'mentions-legales', label: 'Mentions légales' },
] as const;

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-16 scroll-mt-24 border-b border-border pb-3 font-display text-2xl font-bold uppercase tracking-wide text-foreground md:text-3xl"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 text-base font-semibold text-foreground">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT}`} className="text-foreground underline underline-offset-4 hover:no-underline">
      {CONTACT}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Informations légales
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide md:text-4xl">
          Confidentialité, CGU &amp; mentions légales
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Dernière mise à jour : {UPDATED}</p>

        <nav aria-label="Sommaire" className="mt-8 rounded-lg border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Sommaire</p>
          <ul className="mt-3 space-y-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* ─────────────────────────── CGU ─────────────────────────── */}
        <H2 id="cgu">Conditions générales d&apos;utilisation</H2>

        <H3>1. Objet</H3>
        <P>
          Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;utilisation de
          l&apos;application mobile AthleX et de la console web AthleX Manager, éditées par {EDITOR}. En créant un
          compte, vous acceptez ces CGU dans leur intégralité.
        </P>

        <H3>2. Inscription</H3>
        <P>
          L&apos;inscription est gratuite et ouverte à toute personne physique majeure ou mineure avec autorisation
          parentale. Vous devez fournir un email valide, un pseudo unique et un mot de passe sécurisé (6 caractères
          minimum). Vous êtes responsable de la confidentialité de vos identifiants.
        </P>

        <H3>3. Services</H3>
        <P>AthleX propose les services suivants :</P>
        <UL
          items={[
            'Suivi de performances sportives (scores WOD, records personnels)',
            'Système de classement ELO',
            'Participation à des tournois et compétitions',
            "Minuteur vidéo pour l'enregistrement de WODs",
            'Partage de scores sur les réseaux sociaux (Instagram, WhatsApp, etc.)',
            'Système de badges et gamification',
            "Code de parrainage pour inviter d'autres athlètes",
            "Messagerie et communication entre membres d'une box",
            'Gestion de box pour les gérants (AthleX Manager)',
          ]}
        />

        <H3>4. Comportement</H3>
        <P>
          L&apos;utilisateur s&apos;engage à ne pas tricher, falsifier ses scores ou adopter un comportement nuisible.
          Tout faux score entraîne une disqualification et une perte d&apos;ELO. AthleX se réserve le droit de suspendre
          ou de supprimer tout compte enfreignant ces règles.
        </P>

        <H3>5. Propriété intellectuelle</H3>
        <P>
          L&apos;application, son design, son code et son contenu sont la propriété exclusive de {EDITOR}. Toute
          reproduction est interdite sans autorisation préalable.
        </P>

        <H3>6. Données personnelles</H3>
        <P>
          Le traitement des données personnelles est décrit dans la{' '}
          <a href="#confidentialite" className="text-foreground underline underline-offset-4 hover:no-underline">
            politique de confidentialité
          </a>{' '}
          ci-dessous.
        </P>

        <H3>7. Suppression de compte</H3>
        <P>
          Vous pouvez supprimer votre compte à tout moment depuis Profil → Compte → Supprimer mon compte. La suppression
          est irréversible et entraîne l&apos;effacement définitif de toutes vos données.
        </P>

        <H3>8. Limitation de responsabilité</H3>
        <P>
          AthleX est fourni « tel quel ». Nous ne garantissons pas la disponibilité permanente du service. AthleX ne peut
          être tenu responsable des blessures survenues lors d&apos;entraînements.
        </P>

        <H3>9. Modifications</H3>
        <P>
          {EDITOR} se réserve le droit de modifier les CGU. Les utilisateurs seront informés des changements
          significatifs via l&apos;application.
        </P>

        <H3>10. Droit applicable</H3>
        <P>
          Les présentes CGU sont soumises au droit français. Tout litige sera porté devant les tribunaux compétents.
        </P>

        <H3>11. Contact</H3>
        <P>
          Pour toute question : <Mail />
        </P>

        {/* ──────────────── POLITIQUE DE CONFIDENTIALITÉ ──────────────── */}
        <H2 id="confidentialite">Politique de confidentialité</H2>

        <H3>1. Introduction</H3>
        <P>
          AthleX (« nous », « notre ») est une plateforme de compétition functional fitness &amp; hybrid. Cette politique
          décrit comment nous collectons, utilisons et protégeons vos données personnelles. Le responsable de traitement
          est {EDITOR}.
        </P>

        <H3>2. Données collectées</H3>
        <UL
          items={[
            'Informations de compte : email, pseudo, mot de passe (chiffré), niveau',
            'Données de profil : photo, bio, records personnels',
            'Données de performance : scores WOD, classement ELO, vidéos',
            'Données de compétition : participations, résultats',
            'Communications : messages dans les chats de box',
            "Données techniques : type d'appareil, système d'exploitation, jeton de notification",
            "Données de gamification : badges obtenus, séries, compteurs d'activité",
          ]}
        />

        <H3>3. Utilisation des données</H3>
        <UL
          items={[
            'Fournir et améliorer les fonctionnalités',
            'Gérer votre compte et votre profil athlète',
            'Calculer et afficher les classements ELO',
            'Permettre la participation aux compétitions',
            'Envoyer des notifications push (si autorisées)',
            'Attribuer des badges et suivre votre progression',
            "Analyser l'usage de l'application de manière anonyme",
          ]}
        />

        <H3>4. Stockage et sécurité</H3>
        <P>
          Vos données sont stockées via Supabase, hébergé sur des serveurs conformes aux standards de sécurité. Les mots
          de passe sont chiffrés et les communications utilisent le protocole HTTPS.
        </P>

        <H3>5. Caméra et galerie</H3>
        <P>
          L&apos;application peut accéder à votre caméra pour enregistrer vos performances et à votre galerie pour
          sauvegarder les vidéos ou choisir une photo de profil. Ces accès nécessitent votre autorisation.
        </P>

        <H3>6. Notifications push</H3>
        <P>
          Les notifications vous informent des résultats et des rappels. Chaque famille de notification est gouvernée par
          un réglage dédié, désactivable à tout moment depuis les paramètres de l&apos;application.
        </P>

        <H3>7. Partage des données</H3>
        <P>
          Nous ne vendons jamais vos données. Sont visibles par les membres de votre box : pseudo, niveau, scores et
          classement. Le gérant a accès aux données de ses membres, et à celles de sa box uniquement.
        </P>
        <P>
          Lorsque vous partagez un score via la fonctionnalité de partage, une image contenant votre pseudo, votre score
          et le nom de votre box est générée localement puis partagée via le système natif de votre appareil. Aucune
          donnée n&apos;est envoyée à nos serveurs lors du partage.
        </P>

        <H3>8. Services tiers</H3>
        <UL
          items={[
            'Supabase : hébergement des données et authentification',
            "Stripe : paiement des abonnements, des offres et des programmes",
            'Resend : envoi des emails transactionnels',
            "Mixpanel : statistiques d'usage anonymisées",
            'Sentry : détection et correction des erreurs techniques (données anonymisées)',
            "Expo : distribution des mises à jour de l'application",
            'Vercel : hébergement du site et de la console web',
          ]}
        />

        <H3>9. Vos droits (RGPD)</H3>
        <UL
          items={[
            'Accéder à vos données personnelles',
            'Rectifier vos informations via votre profil',
            'Supprimer votre compte et toutes vos données',
            'Exporter vos données sur demande',
            'Retirer votre consentement aux notifications',
          ]}
        />
        <P>
          Pour exercer ces droits, écrivez à <Mail />.
        </P>

        <H3>10. Conservation</H3>
        <P>
          Vos données sont conservées tant que votre compte est actif. En cas de suppression, vos données sont effacées
          immédiatement.
        </P>

        <H3>11. Contact</H3>
        <P>
          Pour toute question : <Mail />
        </P>

        {/* ─────────────────── MENTIONS LÉGALES ─────────────────── */}
        <H2 id="mentions-legales">Mentions légales</H2>

        <H3>Éditeur</H3>
        <P>
          Le site athlexapp.eu, l&apos;application mobile AthleX et la console AthleX Manager sont édités par {EDITOR}.
          Contact : <Mail />.
        </P>

        <H3>Hébergement</H3>
        <P>
          Site et console web : Vercel Inc. — Données applicatives, authentification et fichiers : Supabase, sur
          infrastructure européenne.
        </P>

        <H3>Propriété intellectuelle</H3>
        <P>
          L&apos;ensemble des contenus du site et des applications (marque AthleX, logo, textes, interfaces, code) est la
          propriété de {EDITOR}. Toute reproduction, même partielle, est interdite sans autorisation écrite.
        </P>

        <H3>Protection des données</H3>
        <P>
          Le responsable de traitement est {EDITOR}. Les modalités de collecte et vos droits sont détaillés dans la{' '}
          <a href="#confidentialite" className="text-foreground underline underline-offset-4 hover:no-underline">
            politique de confidentialité
          </a>
          .
        </P>

        <p className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {EDITOR}. Tous droits réservés.
        </p>
      </main>

      <LandingFooter />
    </div>
  );
}
