# Réinitialisation de mot de passe — lien d'e-mail à coller dans Supabase

Le lien de récupération est vérifié **côté serveur** par `app/auth/confirm/route.ts`
(`verifyOtp({ token_hash, type })`). Il ne dépend donc plus du navigateur qui a
demandé le lien : c'est ce qui produisait `PKCE code verifier not found in storage`
quand le lien était ouvert depuis un webmail, l'application Gmail ou un téléphone.

Deux réglages sont à appliquer **dans le dashboard Supabase** (aucune migration).

## 1. Authentication → Email Templates → « Reset password »

```html
<h2>Réinitialise ton mot de passe</h2>

<p>Clique sur le lien ci-dessous pour choisir un nouveau mot de passe AthleX.
Le lien expire après une heure et ne fonctionne qu'une fois.</p>

<p>
  <a href="https://athlexapp.eu/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}">
    Choisir un nouveau mot de passe
  </a>
</p>

<p>Si tu n'as pas demandé ce changement, ignore cet e-mail : ton mot de passe
reste inchangé.</p>
```

Points importants :

- `{{ .TokenHash }}` remplace `{{ .ConfirmationURL }}` : c'est lui qui rend le
  lien vérifiable sans état local.
- `next={{ .RedirectTo }}` garde la cible de **chaque client**. Le template est
  partagé par tout le projet : le web (`/reset-password`) et l'application
  mobile (`AuthContext.resetPassword`) passent aujourd'hui le même
  `redirectTo` — `https://athlexapp.eu/update-password` (voir
  `src/lib/urls.ts` dans `athlex-app`, aucun deep link) — donc l'app continue
  de fonctionner sans build store.
- La route ne garde de `next` que le chemin, et seulement si l'origine est la
  sienne : un `redirectTo` étranger retombe sur `/update-password`.
- Si `next` est absent, la route redirige vers `/update-password` : le template
  fonctionne aussi sans ce paramètre.
- **Le domaine est écrit en clair, pas `{{ .SiteURL }}`.** Le « Site URL » du
  projet vaut aujourd'hui `https://athlexapp.eu/email-confirme` : un lien bâti
  sur `{{ .SiteURL }}` hérite de ce chemin et donne
  `https://athlexapp.eu/email-confirme/auth/confirm?token_hash=…`, donc un 404
  — la vérification vit sous `/auth/*`. Aucune règle du dépôt ne réécrit
  `/auth/*` : le préfixe vient de ce réglage.

## 2. Authentication → URL Configuration

- **Site URL** : `https://athlexapp.eu`, **sans `/email-confirme`**. Le suffixe
  n'a plus d'utilité : chaque envoi impose sa cible
  (`emailRedirectTo: ${SITE_URL}/email-confirme` dans `app/api/auth/signup` et
  `app/api/invitations/accept`, `UPDATE_PASSWORD_URL` côté mobile), donc la
  confirmation d'inscription atterrit toujours sur `/email-confirme`.
- **Redirect URLs** : conserver `https://athlexapp.eu/update-password` et
  `https://athlexapp.eu/email-confirme`, et ajouter
  `https://athlexapp.eu/auth/confirm` (plus, si les previews doivent être
  testées, `https://*.vercel.app/auth/confirm`).
- Les liens déjà partis avec le chemin hérité restent utilisables :
  `/email-confirme/auth/*` est redirigé vers `/auth/*`, paramètres intacts
  (`next.config.mjs`).

## 3. Protocole de test en production

Avec un compte de test `nbstylz+…@gmail.com` :

1. Depuis Chrome, demander un lien sur `/reset-password`.
2. Ouvrir le lien reçu **depuis un autre navigateur** : la page de nouveau mot
   de passe doit s'afficher directement (aucun « lien invalide »).
3. Refaire une demande et ouvrir le lien **depuis le téléphone** (application
   Gmail) : même résultat.
4. Changer le mot de passe, puis se reconnecter avec le nouveau.
5. Rouvrir le **même lien** : « Ce lien a expiré ou a déjà été utilisé », avec
   le bouton « Demander un nouveau lien » qui ramène sur `/reset-password`.
6. Ouvrir `/update-password` sans lien : même message d'expiration propre.
