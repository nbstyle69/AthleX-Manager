export const metadata = {
  title: 'Politique de confidentialité – AthleX',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif', color: '#222' }}>
      <h1>Politique de confidentialité – AthleX</h1>
      <p><strong>Dernière mise à jour :</strong> 23 mars 2026</p>

      <h2>1. Responsable du traitement</h2>
      <p>
        L&apos;application <strong>AthleX</strong> est éditée par NBS Innovation.
        Pour toute question : <a href="mailto:contact@athlex-app.com">contact@athlex-app.com</a>
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li><strong>Compte utilisateur :</strong> adresse e-mail, nom d&apos;utilisateur, genre (optionnel), niveau sportif.</li>
        <li><strong>Scores &amp; performances :</strong> scores de WOD, classements, historique ELO.</li>
        <li><strong>Caméra &amp; microphone :</strong> utilisés uniquement pour l&apos;enregistrement vidéo de vos performances sportives. Les vidéos restent sur votre appareil sauf partage volontaire.</li>
        <li><strong>Galerie photo :</strong> accès pour sauvegarder ou soumettre des vidéos de performance.</li>
        <li><strong>Notifications push :</strong> token de notification pour les alertes (WOD, tournois, badges).</li>
      </ul>

      <h2>3. Utilisation des données</h2>
      <p>Vos données sont utilisées pour :</p>
      <ul>
        <li>Gérer votre compte et authentification.</li>
        <li>Afficher vos scores, classements et badges.</li>
        <li>Permettre l&apos;enregistrement vidéo de vos entraînements.</li>
        <li>Envoyer des notifications liées à votre activité sportive.</li>
        <li>Améliorer l&apos;expérience utilisateur via des statistiques anonymes (Mixpanel).</li>
      </ul>

      <h2>4. Partage des données</h2>
      <p>
        Vos données ne sont <strong>jamais vendues</strong>. Elles sont partagées uniquement avec :
      </p>
      <ul>
        <li><strong>Supabase</strong> (hébergement base de données, authentification).</li>
        <li><strong>Sentry</strong> (suivi des erreurs techniques, données anonymisées).</li>
        <li><strong>Mixpanel</strong> (analytics d&apos;usage, données anonymisées).</li>
      </ul>

      <h2>5. Stockage &amp; sécurité</h2>
      <p>
        Les données sont hébergées par Supabase (serveurs AWS, région EU).
        Les communications sont chiffrées via HTTPS/TLS.
        Les mots de passe sont hashés et ne sont jamais stockés en clair.
      </p>

      <h2>6. Vos droits</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li>Droit d&apos;accès, de rectification et de suppression de vos données.</li>
        <li>Droit à la portabilité de vos données.</li>
        <li>Droit d&apos;opposition au traitement.</li>
      </ul>
      <p>
        Pour exercer vos droits : <a href="mailto:contact@athlex-app.com">contact@athlex-app.com</a>
      </p>

      <h2>7. Conservation</h2>
      <p>
        Vos données sont conservées tant que votre compte est actif.
        En cas de suppression de compte, vos données sont effacées sous 30 jours.
      </p>

      <h2>8. Modifications</h2>
      <p>
        Cette politique peut être mise à jour. Vous serez notifié en cas de changement significatif.
      </p>
    </main>
  );
}
