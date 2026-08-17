# Backlog infrastructure — dettes à déclencheur

Chaque entrée porte sa **condition de déclenchement** : elle ne se traite pas « quand on aura
le temps », mais quand la condition est vérifiée. Une dette d'infrastructure sans condition
finit exécutée trop tôt (et casse) ou jamais.

---

## Renommer le projet Vercel `the-hub` → `athlex-manager`

L'URL `the-hub-rho.vercel.app` reste servie tant que le projet porte ce nom. Elle est
invisible pour les utilisateurs depuis la bascule sur `athlexapp.eu`, mais elle est encore
la valeur écrite dans des artefacts déjà distribués.

**Condition de déclenchement — les quatre doivent être vraies :**

- [ ] L'OTA qui porte `WEB_URL = https://athlexapp.eu` est adoptée par le parc installé
      (les versions antérieures ouvrent encore l'URL Vercel depuis le paywall gérant).
- [ ] Aucun endpoint Stripe (webhooks compte plateforme **et** comptes connectés) ne pointe
      sur `*.vercel.app`.
- [ ] Aucune edge function ni job `pg_cron` ne construit d'URL sur `APP_WEB_URL` héritée.
- [ ] Les e-mails déjà partis contenant un lien `the-hub-rho.vercel.app` sont hors de leur
      fenêtre d'usage (invitations expirées, relances traitées).

Renommer avant cela transforme des liens vivants en 404 sans trace : le projet renommé ne
conserve pas l'ancien domaine `*.vercel.app`.

**Note** : le dépôt GitHub, lui, est déjà renommé (`AthleX-Manager`). L'intégration Vercel
référence le dépôt par `repoId` numérique, pas par nom — le renommage du dépôt n'a donc
aucun effet sur les déploiements, et ne vaut pas déclenchement de celui du projet.

---

## Traduction anglaise des CGU

`/privacy` est bilingue pour la politique de confidentialité et les mentions légales, mais la
section CGU reste en français dans les deux langues, avec en mode EN la mention
« The terms of use below are the binding French version. »

C'est un choix, pas un oubli : les CGU sont un contrat soumis au droit français, le marché de
lancement est français, et la pièce que la review Apple consulte est la politique de
confidentialité — elle, bilingue.

**Condition de déclenchement** : arrivée de box non francophones (ou d'un marché de lancement
hors France). Traduire avant cela produirait deux versions contractuelles à maintenir, dont
une non opposable, pour zéro lecteur.

---

## Liens universels Android sur `athlexapp.eu`

`app.json` déclare l'`intentFilter` sur le nouveau domaine, mais c'est de la configuration
native : elle n'entre en vigueur qu'au prochain build boutique, pas par OTA. D'ici là, un
lien `athlexapp.eu` ouvert sur Android reste dans le navigateur.

**Condition** : prochain build store de l'app (aucune action intermédiaire utile).
