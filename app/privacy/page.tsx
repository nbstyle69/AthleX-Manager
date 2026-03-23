export const metadata = {
  title: 'Mentions légales – AthleX',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif', color: '#222', lineHeight: 1.7 }}>

      {/* ════════════════════════════════════════ */}
      {/*  CGU                                     */}
      {/* ════════════════════════════════════════ */}
      <h1>Conditions Générales d&apos;Utilisation</h1>
      <p><em>Dernière mise à jour : 23 mars 2026</em></p>

      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;utilisation de l&apos;application mobile AthleX,
        éditée par AthleX SAS. En créant un compte, vous acceptez ces CGU dans leur intégralité.
      </p>

      <h2>2. Inscription</h2>
      <p>
        L&apos;inscription est gratuite et ouverte à toute personne physique majeure ou mineure avec autorisation parentale.
        Vous devez fournir un email valide, un pseudo unique et un mot de passe sécurisé (6 caractères minimum).
        Vous êtes responsable de la confidentialité de vos identifiants.
      </p>

      <h2>3. Services</h2>
      <p>AthleX propose les services suivants :</p>
      <ul>
        <li>Suivi de performances sportives (scores WOD, PR)</li>
        <li>Système de classement ELO</li>
        <li>Participation à des tournois et compétitions</li>
        <li>Minuteur vidéo pour l&apos;enregistrement de WODs</li>
        <li>Partage de scores sur les réseaux sociaux (Instagram, WhatsApp, etc.)</li>
        <li>Système de badges et gamification</li>
        <li>Code de parrainage pour inviter d&apos;autres athlètes</li>
        <li>Messagerie et communication entre membres d&apos;une box</li>
        <li>Gestion de box pour les gérants</li>
      </ul>

      <h2>4. Comportement</h2>
      <p>
        L&apos;utilisateur s&apos;engage à ne pas tricher, falsifier ses scores ou adopter un comportement nuisible.
        Tout faux score entraîne une disqualification et perte d&apos;ELO. AthleX se réserve le droit de suspendre
        ou supprimer tout compte enfreignant ces règles.
      </p>

      <h2>5. Propriété intellectuelle</h2>
      <p>
        L&apos;application, son design, code et contenu sont la propriété exclusive d&apos;AthleX SAS.
        Toute reproduction est interdite sans autorisation préalable.
      </p>

      <h2>6. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans notre Politique de Confidentialité ci-dessous.
      </p>

      <h2>7. Suppression de compte</h2>
      <p>
        Vous pouvez supprimer votre compte à tout moment depuis Profil → Compte → Supprimer mon compte.
        La suppression est irréversible et entraîne l&apos;effacement définitif de toutes vos données.
      </p>

      <h2>8. Limitation de responsabilité</h2>
      <p>
        AthleX est fourni &quot;tel quel&quot;. Nous ne garantissons pas la disponibilité permanente du service.
        AthleX ne peut être tenu responsable des blessures survenues lors d&apos;entraînements.
      </p>

      <h2>9. Modifications</h2>
      <p>
        AthleX se réserve le droit de modifier les CGU. Les utilisateurs seront informés des changements
        significatifs via l&apos;application.
      </p>

      <h2>10. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français. Tout litige sera porté devant les tribunaux compétents de Paris.
      </p>

      <h2>11. Contact</h2>
      <p>Pour toute question : <a href="mailto:contact@athlex.app">contact@athlex.app</a></p>

      <hr style={{ margin: '3rem 0', borderColor: '#ddd' }} />

      {/* ════════════════════════════════════════ */}
      {/*  POLITIQUE DE CONFIDENTIALITÉ             */}
      {/* ════════════════════════════════════════ */}
      <h1>Politique de Confidentialité</h1>
      <p><em>Dernière mise à jour : 23 mars 2026</em></p>

      <h2>1. Introduction</h2>
      <p>
        AthleX (« nous », « notre ») est une application mobile de compétition functional fitness &amp; hybrid.
        Cette politique décrit comment nous collectons, utilisons et protégeons vos données personnelles.
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li>Informations de compte : email, pseudo, mot de passe (chiffré), niveau</li>
        <li>Données de profil : photo, bio, personal records (PR)</li>
        <li>Données de performance : scores WOD, classement ELO, vidéos</li>
        <li>Données de compétition : participations, résultats</li>
        <li>Communications : messages dans les chats de box</li>
        <li>Données techniques : type d&apos;appareil, OS, token push</li>
        <li>Données de gamification : badges obtenus, streaks, compteurs d&apos;activité</li>
      </ul>

      <h2>3. Utilisation des données</h2>
      <ul>
        <li>Fournir et améliorer les fonctionnalités</li>
        <li>Gérer votre compte et profil athlète</li>
        <li>Calculer et afficher les classements ELO</li>
        <li>Permettre la participation aux compétitions</li>
        <li>Envoyer des notifications push (si autorisées)</li>
        <li>Attribuer des badges et suivre votre progression</li>
        <li>Analyser l&apos;usage de l&apos;application de manière anonyme</li>
      </ul>

      <h2>4. Stockage et sécurité</h2>
      <p>
        Vos données sont stockées via Supabase, hébergé sur des serveurs conformes aux standards de sécurité.
        Les mots de passe sont chiffrés. Les communications utilisent le protocole HTTPS.
      </p>

      <h2>5. Caméra et galerie</h2>
      <p>
        L&apos;application peut accéder à votre caméra pour enregistrer vos performances et à votre galerie
        pour sauvegarder les vidéos ou choisir une photo de profil. Ces accès nécessitent votre autorisation.
      </p>

      <h2>6. Notifications push</h2>
      <p>
        Les notifications vous informent des résultats et rappels. Vous pouvez les désactiver dans les paramètres.
      </p>

      <h2>7. Partage des données</h2>
      <p>
        Nous ne vendons jamais vos données. Sont visibles par les membres de votre box :
        pseudo, niveau, scores, classement. Le gérant a accès aux données de ses membres.
      </p>
      <p>
        Lorsque vous partagez un score via la fonctionnalité de partage, une image contenant votre pseudo,
        score et nom de box est générée localement et partagée via le système natif de votre appareil.
        Aucune donnée n&apos;est envoyée à nos serveurs lors du partage.
      </p>

      <h2>8. Services tiers</h2>
      <p>Nous utilisons les services tiers suivants :</p>
      <ul>
        <li>Supabase : hébergement des données et authentification</li>
        <li>Mixpanel : statistiques d&apos;usage anonymisées</li>
        <li>Sentry : détection et correction des erreurs techniques (données anonymisées)</li>
        <li>Expo : distribution des mises à jour de l&apos;application</li>
      </ul>

      <h2>9. Vos droits (RGPD)</h2>
      <ul>
        <li>Accéder à vos données personnelles</li>
        <li>Rectifier vos informations via votre profil</li>
        <li>Supprimer votre compte et toutes vos données</li>
        <li>Exporter vos données sur demande</li>
        <li>Retirer votre consentement aux notifications</li>
      </ul>

      <h2>10. Conservation</h2>
      <p>
        Vos données sont conservées tant que votre compte est actif. En cas de suppression,
        vos données sont effacées immédiatement.
      </p>

      <h2>11. Contact</h2>
      <p>Pour toute question : <a href="mailto:contact@athlex.app">contact@athlex.app</a></p>

      <p style={{ marginTop: '3rem', color: '#888', fontSize: '0.9rem' }}>© 2026 AthleX. Tous droits réservés.</p>
    </main>
  );
}
