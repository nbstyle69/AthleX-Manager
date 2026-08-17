'use client';

import { useLanguage } from '@/components/language-provider';
import { LandingHeader } from '@/components/landing/header';
import { LandingFooter } from '@/components/landing/footer';
import { LanguageToggle } from '@/components/landing/language-toggle';

const CONTACT = 'contact@athlexapp.eu';
const EDITOR = 'NBS INNOVATION';
const RCS = '932 035 819';
const CAPITAL = '3 000';
const HEADQUARTERS = "66 Allée d'Italie, 69007 Lyon, France";
const PUBLICATION_DIRECTOR = 'Nabil Selmane';

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

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-foreground underline underline-offset-4 hover:no-underline">
      {children}
    </a>
  );
}

/* ─────────────────────────────── FR ─────────────────────────────── */

function PrivacyFr() {
  return (
    <>
      <H2 id="confidentialite">Politique de confidentialité</H2>

      <H3>1. Qui sommes-nous ?</H3>
      <P>
        L&apos;application AthleX et le back-office AthleX Manager (ci-après « AthleX ») sont édités par {EDITOR} (voir
        les <Link href="#mentions-legales">mentions légales complètes</Link> en bas de page). {EDITOR} est responsable du
        traitement de vos données personnelles. Pour toute question relative à vos données : <Mail />.
      </P>

      <H3>2. Les données que nous collectons</H3>
      <UL
        items={[
          <>
            <strong className="font-semibold text-foreground">Données de compte :</strong> adresse e-mail, pseudo, prénom
            et nom, genre (facultatif), niveau de pratique, photo de profil (facultative).
          </>,
          <>
            <strong className="font-semibold text-foreground">Données sportives :</strong> scores de WOD (temps,
            répétitions, RX/Scaled/CAP), records personnels, historique de classement ELO, participations et résultats de
            tournois, badges.
          </>,
          <>
            <strong className="font-semibold text-foreground">Contenus que vous publiez :</strong> messages dans les
            groupes de votre box, commentaires et réactions sur les scores, images partagées.
          </>,
          <>
            <strong className="font-semibold text-foreground">Données d&apos;adhésion à une box :</strong> box rejointe,
            formule d&apos;abonnement souscrite, statut de l&apos;abonnement, réservations de cours et présences.
            Lorsqu&apos;un paiement est encaissé directement à la salle, le gérant enregistre le montant et la date de
            l&apos;encaissement.
          </>,
          <>
            <strong className="font-semibold text-foreground">Données d&apos;invitation :</strong> lorsqu&apos;un gérant
            de box vous invite à rejoindre AthleX, il renseigne votre prénom, votre nom et votre adresse e-mail avant même
            la création de votre compte. Ces données ne servent qu&apos;à vous adresser l&apos;invitation et à préparer
            votre adhésion ; une invitation non utilisée expire automatiquement.
          </>,
          <>
            <strong className="font-semibold text-foreground">Données techniques :</strong> jeton de notifications push
            (si vous les activez), préférences de notifications, rapports d&apos;erreur et de performance de
            l&apos;application (via Sentry) rattachés à votre compte.
          </>,
        ]}
      />
      <P>
        Nous ne collectons ni géolocalisation, ni contacts, ni historique de navigation. AthleX ne contient aucune
        publicité et n&apos;utilise aucun traceur publicitaire.
      </P>

      <H3>3. Vos données bancaires ne passent jamais par AthleX</H3>
      <P>
        Les paiements d&apos;abonnement (carte bancaire ou prélèvement SEPA) sont traités directement par Stripe, sur les
        pages de paiement de Stripe, pour le compte de votre box. Votre numéro de carte ou votre IBAN ne transitent jamais
        par nos serveurs. AthleX ne reçoit de Stripe que le statut du paiement (payé, en attente, échoué).
      </P>

      <H3>4. Pourquoi nous utilisons vos données</H3>
      <UL
        items={[
          'Fournir le service (compte, scores, classements, tournois, réservations, messagerie) — exécution du contrat.',
          "Gestion de votre box (adhésion, abonnement, présences) — exécution du contrat.",
          "Invitations — démarches précontractuelles / intérêt légitime du gérant.",
          "Notifications — selon vos préférences, réglables et désactivables dans l'app (consentement).",
          "E-mails de service (invitation, récapitulatif hebdomadaire du gérant, désactivable) — intérêt légitime.",
          'Fiabilité, sécurité, prévention de la triche et modération — intérêt légitime.',
        ]}
      />

      <H3>5. Qui voit vos données dans l&apos;app ?</H3>
      <P>
        AthleX est une application communautaire : vos scores, votre pseudo, votre niveau, vos badges et votre position
        dans les classements sont visibles des autres membres de votre box, et des participants des tournois auxquels vous
        vous inscrivez. Votre adresse e-mail n&apos;est jamais visible des autres membres ; le gérant de votre box y a
        accès pour la gestion de votre adhésion. Vous pouvez bloquer un utilisateur et signaler tout contenu inapproprié ;
        les signalements sont traités sous 24 heures.
      </P>

      <H3>6. Nos sous-traitants</H3>
      <P>
        Supabase (hébergement de la base de données et authentification), Vercel (hébergement du site et du back-office),
        Stripe (paiements), Resend (envoi des e-mails), Sentry (rapports d&apos;erreur), Expo (notifications push) et
        Tenor (recherche de GIF — seule votre requête lui est transmise, jamais votre identité). Les transferts éventuels
        hors Union européenne sont encadrés par les garanties du RGPD (clauses contractuelles types).
      </P>

      <H3>7. Durées de conservation</H3>
      <P>
        Vos données sont conservées tant que votre compte est actif. À la suppression de votre compte, vos données
        personnelles sont supprimées ou anonymisées ; les données comptables liées aux paiements peuvent être conservées
        par votre box et par Stripe pendant les durées légales. Les invitations non utilisées expirent automatiquement.
        Les rapports d&apos;erreur sont conservés pour une durée limitée.
      </P>

      <H3>8. Vos droits</H3>
      <P>
        Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de
        portabilité. Concrètement : rectifiez vos informations dans votre profil ; supprimez votre compte à tout moment
        (Profil → Compte → Supprimer mon compte) ; réglez chacune de vos notifications ; les gérants disposent d&apos;un
        export complet des données de leur box (Réglages → Exporter mes données). Pour toute autre demande : <Mail /> —
        réponse sous un mois. Vous pouvez saisir la CNIL (<Link href="https://www.cnil.fr">cnil.fr</Link>).
      </P>

      <H3>9. Mineurs</H3>
      <P>
        L&apos;inscription est ouverte aux mineurs avec l&apos;autorisation d&apos;un titulaire de l&apos;autorité
        parentale. Les parents ou tuteurs peuvent exercer les droits ci-dessus pour le compte du mineur : <Mail />.
      </P>

      <H3>10. Sécurité</H3>
      <P>
        Données chiffrées en transit (HTTPS), accès cloisonné par box et par rôle, frontières d&apos;accès testées
        régulièrement.
      </P>

      <H3>11. Évolutions</H3>
      <P>
        Cette politique peut évoluer avec l&apos;application ; en cas de changement substantiel, nous vous en informerons
        dans l&apos;app.
      </P>
    </>
  );
}

function LegalFr() {
  return (
    <>
      <H2 id="mentions-legales">Mentions légales</H2>
      <P>
        <strong className="font-semibold text-foreground">Éditeur :</strong> {EDITOR}, société par actions simplifiée
        unipersonnelle (SASU) au capital de {CAPITAL} €, immatriculée au RCS de Lyon sous le numéro {RCS}.
      </P>
      <P>
        <strong className="font-semibold text-foreground">Siège social :</strong> {HEADQUARTERS}.
      </P>
      <P>
        <strong className="font-semibold text-foreground">Directeur de la publication :</strong>{' '}
        {PUBLICATION_DIRECTOR}.
      </P>
      <P>
        <strong className="font-semibold text-foreground">Contact :</strong> <Mail />.
      </P>
      <P>
        <strong className="font-semibold text-foreground">Hébergement :</strong> Vercel Inc. (site web) et Supabase
        (données).
      </P>
    </>
  );
}

/* ─────────────────────────────── EN ─────────────────────────────── */

function PrivacyEn() {
  return (
    <>
      <H2 id="confidentialite">Privacy policy</H2>

      <H3>1. Who we are</H3>
      <P>
        The AthleX app and the AthleX Manager back office (“AthleX”) are published by {EDITOR} (see the{' '}
        <Link href="#mentions-legales">full legal notice</Link> at the bottom of this page). {EDITOR} is the data
        controller. For any question about your data: <Mail />.
      </P>

      <H3>2. Data we collect</H3>
      <UL
        items={[
          <>
            <strong className="font-semibold text-foreground">Account data:</strong> email address, username, first and
            last name, gender (optional), training level, profile photo (optional).
          </>,
          <>
            <strong className="font-semibold text-foreground">Sports data:</strong> WOD scores (time, reps,
            RX/Scaled/CAP), personal records, ELO ranking history, tournament participations and results, badges.
          </>,
          <>
            <strong className="font-semibold text-foreground">Content you post:</strong> messages in your gym&apos;s
            groups, comments and reactions on scores, shared images.
          </>,
          <>
            <strong className="font-semibold text-foreground">Gym membership data:</strong> the gym you joined, your
            membership plan and its status, class bookings and attendance. When a payment is collected directly at the
            gym, the owner records the amount and date of collection.
          </>,
          <>
            <strong className="font-semibold text-foreground">Invitation data:</strong> when a gym owner invites you to
            join AthleX, they enter your first name, last name and email address before your account exists. This data is
            only used to send you the invitation and prepare your membership; unused invitations expire automatically.
          </>,
          <>
            <strong className="font-semibold text-foreground">Technical data:</strong> push notification token (if
            enabled), notification preferences, crash and performance reports (via Sentry) linked to your account.
          </>,
        ]}
      />
      <P>
        We collect no location data, no contacts, no browsing history. AthleX contains no advertising and uses no
        advertising trackers.
      </P>

      <H3>3. Your banking details never touch AthleX</H3>
      <P>
        Membership payments (card or SEPA direct debit) are processed directly by Stripe, on Stripe&apos;s payment pages,
        on behalf of your gym. Your card number or IBAN never transit through or get stored on our servers. AthleX only
        receives the payment status from Stripe (paid, pending, failed).
      </P>

      <H3>4. Why we use your data</H3>
      <UL
        items={[
          'Providing the service (account, scores, leaderboards, tournaments, bookings, messaging) — performance of contract.',
          'Gym management (membership, plan, attendance) — performance of contract.',
          "Invitations — pre-contractual steps / gym owner's legitimate interest.",
          'Notifications — according to your in-app preferences, all adjustable and deactivatable (consent).',
          "Service emails (invitation, owner's weekly digest, opt-out available) — legitimate interest.",
          'Reliability, security, anti-cheat and moderation — legitimate interest.',
        ]}
      />

      <H3>5. Who sees your data in the app</H3>
      <P>
        AthleX is a community app: your scores, username, level, badges and leaderboard positions are visible to other
        members of your gym and to participants of tournaments you join. Your email address is never visible to other
        members; your gym&apos;s owner can access it to manage your membership. You can block users and report
        inappropriate content; reports are handled within 24 hours.
      </P>

      <H3>6. Our processors</H3>
      <P>
        Supabase (database hosting and authentication), Vercel (website and back-office hosting), Stripe (payments),
        Resend (email delivery), Sentry (error reports), Expo (push notification delivery) and Tenor (GIF search — only
        your search query is sent, never your identity). Any transfer outside the European Union is covered by GDPR
        safeguards (standard contractual clauses).
      </P>

      <H3>7. Retention</H3>
      <P>
        Your data is kept while your account is active. Upon account deletion, your personal data is deleted or
        anonymized; accounting data related to payments may be kept by your gym and Stripe for the applicable legal
        periods. Unused invitations expire automatically. Error reports are kept for a limited period.
      </P>

      <H3>8. Your rights</H3>
      <P>
        Under the GDPR you have rights of access, rectification, erasure, restriction, objection and portability. In
        practice: edit your information in your profile; delete your account at any time (Profile → Account → Delete my
        account); adjust every notification; gym owners have a full export of their gym&apos;s data (Settings → Export my
        data). For any other request: <Mail /> — we reply within one month. You may also lodge a complaint with the French
        supervisory authority (CNIL, <Link href="https://www.cnil.fr">cnil.fr</Link>).
      </P>

      <H3>9. Minors</H3>
      <P>
        Registration is open to minors with the authorization of a parent or legal guardian. Parents or guardians may
        exercise the rights above on behalf of the minor: <Mail />.
      </P>

      <H3>10. Security</H3>
      <P>
        Data is encrypted in transit (HTTPS); access is partitioned per gym and per role; these access boundaries are
        tested regularly.
      </P>

      <H3>11. Changes</H3>
      <P>This policy may evolve with the app; we will inform you in the app of any substantial change.</P>
    </>
  );
}

function LegalEn() {
  return (
    <>
      <H2 id="mentions-legales">Legal notice</H2>
      <P>
        <strong className="font-semibold text-foreground">Publisher:</strong> {EDITOR}, a French single-shareholder
        simplified joint-stock company (SASU) with a share capital of €{CAPITAL}, registered with the Lyon Trade and
        Companies Register under number {RCS}.
      </P>
      <P>
        <strong className="font-semibold text-foreground">Registered office:</strong> {HEADQUARTERS}.
      </P>
      <P>
        <strong className="font-semibold text-foreground">Publication director:</strong> {PUBLICATION_DIRECTOR}.
      </P>
      <P>
        <strong className="font-semibold text-foreground">Contact:</strong> <Mail />.
      </P>
      <P>
        <strong className="font-semibold text-foreground">Hosting:</strong> Vercel Inc. (website) and Supabase (data).
      </P>
    </>
  );
}

/* ─────────────────────────────── CGU (FR) ─────────────────────────────── */

function TermsFr({ english }: { english: boolean }) {
  return (
    <>
      <H2 id="cgu">Conditions générales d&apos;utilisation</H2>
      {english && (
        <P>
          <em>The terms of use below are the binding French version.</em>
        </P>
      )}

      <H3>1. Objet</H3>
      <P>
        Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;utilisation de l&apos;application
        mobile AthleX et du back-office AthleX Manager, édités par {EDITOR}. En créant un compte, vous acceptez ces CGU
        dans leur intégralité.
      </P>

      <H3>2. Inscription</H3>
      <P>
        L&apos;inscription est gratuite et ouverte à toute personne physique majeure, ou mineure avec l&apos;autorisation
        d&apos;un titulaire de l&apos;autorité parentale. Vous devez fournir un e-mail valide, un pseudo unique et un mot
        de passe sécurisé (6 caractères minimum). Vous êtes responsable de la confidentialité de vos identifiants.
      </P>

      <H3>3. Services</H3>
      <P>AthleX propose les services suivants :</P>
      <UL
        items={[
          'Suivi de performances sportives (scores de WOD, records personnels)',
          'Système de classement ELO',
          'Participation à des tournois et compétitions',
          "Minuteur vidéo pour l'enregistrement de WOD",
          'Partage de scores sur les réseaux sociaux',
          'Système de badges et gamification',
          "Code de parrainage pour inviter d'autres athlètes",
          "Messagerie et communication entre membres d'une box",
          'Gestion de box pour les gérants (AthleX Manager)',
        ]}
      />

      <H3>4. Comportement</H3>
      <P>
        L&apos;utilisateur s&apos;engage à ne pas tricher, falsifier ses scores ou adopter un comportement nuisible. Tout
        faux score entraîne une disqualification et une perte d&apos;ELO. AthleX se réserve le droit de suspendre ou de
        supprimer tout compte enfreignant ces règles.
      </P>

      <H3>5. Propriété intellectuelle</H3>
      <P>
        L&apos;application, son design, son code et son contenu sont la propriété exclusive de {EDITOR}. Toute
        reproduction est interdite sans autorisation préalable.
      </P>

      <H3>6. Données personnelles</H3>
      <P>
        Le traitement des données personnelles est décrit dans la{' '}
        <Link href="#confidentialite">politique de confidentialité</Link> ci-dessus.
      </P>

      <H3>7. Suppression de compte</H3>
      <P>
        Vous pouvez supprimer votre compte à tout moment depuis Profil → Compte → Supprimer mon compte. La suppression est
        irréversible et entraîne l&apos;effacement définitif de vos données, sous réserve des durées légales de
        conservation applicables aux données comptables.
      </P>

      <H3>8. Limitation de responsabilité</H3>
      <P>
        AthleX est fourni « tel quel ». Nous ne garantissons pas la disponibilité permanente du service. AthleX ne peut
        être tenu responsable des blessures survenues lors d&apos;entraînements.
      </P>

      <H3>9. Modifications</H3>
      <P>
        {EDITOR} se réserve le droit de modifier les CGU. Les utilisateurs seront informés des changements significatifs
        via l&apos;application.
      </P>

      <H3>10. Droit applicable</H3>
      <P>Les présentes CGU sont soumises au droit français. Tout litige sera porté devant les tribunaux compétents.</P>

      <H3>11. Contact</H3>
      <P>
        Pour toute question : <Mail />.
      </P>
    </>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */

const COPY = {
  fr: {
    tag: 'Informations légales',
    title: 'Politique de confidentialité',
    updated: 'Dernière mise à jour',
    toc: 'Sommaire',
    sections: [
      { id: 'confidentialite', label: 'Politique de confidentialité' },
      { id: 'cgu', label: "Conditions générales d'utilisation" },
      { id: 'mentions-legales', label: 'Mentions légales' },
    ],
    rights: 'Tous droits réservés.',
  },
  en: {
    tag: 'Legal information',
    title: 'Privacy policy',
    updated: 'Last updated',
    toc: 'Contents',
    sections: [
      { id: 'confidentialite', label: 'Privacy policy' },
      { id: 'cgu', label: 'Terms of use (French)' },
      { id: 'mentions-legales', label: 'Legal notice' },
    ],
    rights: 'All rights reserved.',
  },
} as const;

export function PrivacyContent({ updatedFr, updatedEn }: { updatedFr: string; updatedEn: string }) {
  const { lang } = useLanguage();
  const copy = COPY[lang];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {copy.tag}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide md:text-4xl">{copy.title}</h1>
          </div>
          <LanguageToggle />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {copy.updated} : {lang === 'fr' ? updatedFr : updatedEn}
        </p>

        <nav aria-label={copy.toc} className="mt-8 rounded-lg border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{copy.toc}</p>
          <ul className="mt-3 space-y-2">
            {copy.sections.map((s) => (
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

        {lang === 'fr' ? <PrivacyFr /> : <PrivacyEn />}
        <TermsFr english={lang === 'en'} />
        {lang === 'fr' ? <LegalFr /> : <LegalEn />}

        <p className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {EDITOR}. {copy.rights}
        </p>
      </main>

      <LandingFooter />
    </div>
  );
}
