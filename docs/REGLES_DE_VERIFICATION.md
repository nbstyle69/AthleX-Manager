# Règles de vérification — « la valeur plausible qui ment »

Neuf bugs de la même famille ont été attrapés sur six chantiers (invitations, présences,
statistiques, formats de tournoi, portabilité, sécurité des profils et des paiements).
Aucun n'était visible à l'écran : chacun affichait un chiffre ou un état **crédible, stable
et faux**. Un plantage se voit ; une
valeur plausible se croit, et se croit longtemps.

Ce document liste les règles qui en sortent. Il ne prescrit pas un style de code : il
prescrit **ce qu'il faut aller vérifier avant de dire qu'une chose marche**.

---

## Les neuf occurrences, en une ligne chacune

| Chantier | Ce qui s'affichait | Ce qui était vrai |
|---|---|---|
| Abonnés / cartes | `0 membre` | requête refusée par la RLS (`select('*')` sur des colonnes révoquées) |
| Stats — impayés | `0 impayé`, montant compté dans le MRR | les impayés sont en `subscription_status='past_due'`, jamais lus |
| Stats — formules | `Illimité : 0 abonné / 9 900 €` | ligne fantôme d'un `LEFT JOIN`, repli sur le prix affiché |
| Stats — assiduité | synthèse `16`, heatmap `17` | la heatmap comptait les cours du jour, pas la synthèse |
| Stats — funnel | `167 %` de conversion | abonnés hors cohorte de la période |
| Tournois — formats | « cette box n'a droit qu'au Classique » | colonne absente de la liste de `select`, repli `?? ['simple']` |
| Profils — fermeture de colonnes | migration « REVOKE » appliquée, catalogue à jour | le grant de **table** rendait le revoke de colonne sans effet |
| Provenance d'inscription | `UPDATE` refusé, « succès » renvoyé | zéro ligne visible : PostgREST rend 200 sans rien écrire |
| OTA avant révocation | « l'app se charge, OTA constaté » | l'update n'était pas publié ; l'ancien code marchait encore, la coupe n'était pas passée |

---

## 1. Un repli (`??`, `||`, `?.`) sur une donnée qui vient de la base est un mensonge par défaut

`allowedFormats = box.allowed_tournament_formats ?? ['simple']` a masqué le bug pendant
des semaines : la colonne manquait dans la liste de `select`, l'écran recevait `undefined`,
et le repli **inventait une valeur plausible** au lieu de laisser l'erreur remonter.

- Un repli est légitime sur une donnée **facultative par nature** (`logo_url`, `bio`).
- Il est interdit sur une donnée **qui décide d'un droit, d'un montant ou d'un compte**.
  Là, l'absence doit être visible : bandeau d'erreur, log, ou plantage franc.
- « Zéro » ne doit jamais pouvoir signifier « la requête a échoué ». Si l'erreur Supabase
  n'est pas remontée, le zéro n'est pas une information.

## 2. Une liste de colonnes explicite est une dette : elle se met à jour

`select('*')` est interdit sur les tables à colonnes révoquées (`boxes`, `box_members`,
`profiles`) — mais la liste explicite qui le remplace **s'oublie**. Toute colonne ajoutée à
une table lue par une liste explicite doit être ajoutée à cette liste, ou l'écran lira
`undefined` (voir règle 1). Le seul contre-poison connu : chercher les autres appelants
de la table quand on ajoute une colonne.

Symétrique, côté export : une étoile ne produirait pas un zéro mais **une fuite**
(`box_invitations.token_hash`, `box_members.stripe_*`). Le test doit inspecter les
**colonnes demandées**, pas seulement le résultat.

## 3. Les fixtures se construisent depuis les états que le webhook produit réellement

Le bug des impayés a survécu à son protocole parce que le fixture reproduisait l'erreur de
la synthèse : il posait un impayé en `subscription_status='active'`, comme le code le
supposait, alors que Stripe écrit `'past_due'`.

- Un fixture d'abonnement se construit depuis ce que **le webhook écrit**, pas depuis ce
  que l'écran attend.
- Quand un état existe en prod, on rejoue **sur les vraies données après application de la
  migration** — c'est ce qui a attrapé la ligne fantôme du `LEFT JOIN` et l'écart 16/17.

## 4. Une assertion qui ne peut pas échouer n'est pas une assertion

« Aucun `token_hash` dans le pack exporté » est vert sur une base sans invitation. Le
protocole doit donc **prouver d'abord que la donnée dangereuse existe**, puis vérifier son
absence :

```js
const hash = (await svc.from('box_invitations').select('token_hash')…)?.token_hash;
check('un token_hash existe bien en base (le test a du sens)', !!hash);
check('aucun token_hash dans le pack', hash ? !all.includes(hash) : false);
```

Même motif pour un rapport d'import : on ne vérifie pas qu'il contient des lignes, on
vérifie qu'il en contient **autant que le fichier envoyé** — sinon on valide un décompte de
survivants, pas un rapport.

## 5. Deux chiffres du même écran qui parlent de la même chose doivent être égaux, et le test doit l'exiger

La synthèse disait 16, la heatmap 17. Aucun des deux n'était absurde. Quand un écran
affiche deux vues d'un même ensemble, l'égalité est une **assertion**, pas une évidence.

## 6. Un taux n'a de sens que sur une cohorte, et pas sur trois personnes

167 % de conversion venaient d'un numérateur hors cohorte. Deux règles :
- le numérateur est un **sous-ensemble** du dénominateur, et le protocole le verrouille ;
- pas de pourcentage tant que l'effectif de départ est petit (< 10) : on affiche `1/3`.

## 7. Un refus silencieux différé est un bug, pas une variante

Une invitation vers un membre exclu était acceptée, envoyée, ouverte, et ne se refusait
qu'à la création du compte : le gérant ne l'apprenait jamais. Une garde doit se poser **au
plus tôt** (à l'écriture), et dans la RPC plutôt que dans l'écran — tous les chemins en
héritent alors mécaniquement, y compris ceux qu'on écrira plus tard.

---

## 8. Un ordre SQL peut répondre « fait » sans rien faire : le grant de table court-circuite le revoke de colonne

```sql
REVOKE SELECT (email) ON public.profiles FROM authenticated;   -- répond « REVOKE »
```

L'e-mail restait lu par n'importe quel compte connecté. Postgres **additionne** les
privilèges : tant que `authenticated` garde le `SELECT` de **table**, un revoke de colonne
ne retire rien. Pire, le catalogue confirme le mensonge — la ligne disparaît bien de
`information_schema.column_privileges` — donc une vérification par inspection du catalogue
valide une fermeture qui n'existe pas. Seule une lecture au vrai JWT la contredit.

Le levier juste est un basculement en liste blanche :

```sql
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT  SELECT (id, username, avatar_url, elo, …) ON public.profiles TO authenticated;
```

Deux conséquences qui se paient plus tard si elles ne sont pas écrites tout de suite :

- la liste devient la **source de vérité** : toute colonne ajoutée ensuite à la table est
  invisible aux clients jusqu'à son ajout explicite. Ça s'écrit **en tête de la migration**,
  là où le prochain lecteur de cette table passera ;
- un droit de colonne révoqué fait échouer **toute** la requête qui la mentionne, pas
  seulement la colonne. Donc l'app se déploie **avant** la coupe (OTA d'abord, révocation
  ensuite), sinon un client installé ne charge plus son propre profil.

## 9. « Aucune ligne touchée » se lit « succès » : un code de retour n'est pas un résultat

Le protocole affirmait qu'un client ne pouvait pas requalifier sa `provenance`, et
l'`UPDATE` répondait « succès ». Vérifié : l'athlète n'a aucune policy `UPDATE`, sa requête
correspond donc à **zéro ligne**, et PostgREST rend 200. L'assertion mesurait le code de
retour au lieu de l'effet. Une garde d'écriture se prouve sur les deux chemins réels — le
rôle sans policy (nombre de lignes renvoyées = 0) **et** le rôle qui a la policy (erreur
attendue du trigger) — puis par une **relecture de la ligne** en service_role.

## 10. « Mergé » n'est pas « chez l'utilisateur » : un constat qui ne pouvait pas échouer ne prouve rien

La règle 8 impose de déployer l'app **avant** de révoquer une colonne. L'ordre a été
respecté sur le papier : PR mergée, puis « relance l'app, vérifie que ton profil se charge »,
puis révocation. Le profil se chargeait. La révocation est passée. **L'app s'est bloquée à
la connexion.**

Deux causes empilées :

- **rien ne publiait l'OTA.** Merger sur `master` ne déclenche aucun `eas update` ; le
  dernier update du canal `production` datait d'avant le chantier. Le client installé lisait
  donc toujours les colonnes en direct ;
- **le constat ne pouvait pas échouer.** Au moment de la vérification, la coupe n'était pas
  encore appliquée : l'ancien code fonctionnait de toute façon. On a fait constater un état
  qui aurait été identique avec ou sans déploiement — un contrôle positif sans variable.

Ce qui se vérifie, sur un déploiement OTA :

- l'**identité de l'update reçu** par l'appareil (`Updates.updateId` / le message d'update),
  pas le fait qu'un écran s'affiche ;
- ou, à défaut, la **conséquence propre au nouveau code** : ici, que le profil arrive par
  `get_my_profile()` — donc, à l'inverse, que la version installée **échoue** si on coupe.
  Un constat qui donne le même résultat avant et après le déploiement ne mesure rien.

Corollaire : quand une migration ferme une porte que le client installé emprunte, la
séquence sûre est **publier → prouver que la publication est arrivée → couper**, et la
publication doit être automatique ou consignée, jamais laissée à la mémoire de quelqu'un.

## 11. « Publié » et « reçu » ne suffisent pas : un artefact peut arriver intact et inerte

La règle 10 a été appliquée côté mobile : la publication OTA est devenue automatique et
l'identité de l'update publié figure dans le résumé du job. Les quatre updates suivantes ont
**enfermé tous les utilisateurs dehors** — écran de connexion immédiat, soumission sans
message, tous les comptes. La publication avait réussi ; l'artefact était vide.

La cause est une propriété que ce dépôt partage mot pour mot : les variables
`NEXT_PUBLIC_*` — comme les `EXPO_PUBLIC_*` — sont **inlinées au moment du build**, pas lues
à l'exécution. Un artefact construit dans un environnement qui n'a pas la variable ne la
lira jamais ensuite : il embarque une chaîne vide, se déploie sans erreur, et rend une page
qui s'affiche sans pouvoir parler au serveur. `eas build` lisait ses variables par son
profil ; `eas update` ne les lit que si on lui passe `--environment`. La même asymétrie
existe entre les environnements Vercel (Production / Preview / Development) : une variable
posée sur l'un ne vaut pas pour l'autre.

Pourquoi rien ne l'a vu :

- le **garde-fou** validait la seule question qu'il posait — l'artefact est-il applicable ?
  Il l'était. Applicable et vide ;
- les **journaux de déploiement** disaient « réussi », ce qui était vrai ;
- le **harnais de test** construisait son propre artefact, sur une machine où `.env` était
  chargé. Un contrôle qui fabrique son sujet ne teste pas celui qui part ;
- **côté serveur, rien n'apparaissait** — aucune requête n'atteignait la base. Une panne sans
  trace ressemble à un problème de compte, et on cherche du côté des données.

Ce qui se vérifie :

- on **retélécharge l'artefact réellement servi** et on cherche dedans la configuration
  attendue — l'URL Supabase, la clé publique, l'origine du domaine. Sur une preview Vercel,
  c'est le bundle servi par l'URL de preview, pas celui du build local ;
- la **configuration absente lève tôt et se nomme**, plutôt que « supabaseUrl is required. »
  cinq niveaux plus bas, ou une page blanche sans message ;
- l'artefact **expose l'identité du code qu'il exécute** (commit, numéro d'update) là où un
  utilisateur peut la lire : sans elle, l'enquête repose sur des déductions, et un cache ou
  un téléchargement échoué en silence est indistinguable d'un code fautif.

Corollaire général : un artefact de déploiement se vérifie **par son contenu**, pas par le
succès de l'ordre qui l'a produit. « L'ordre a réussi » et « l'artefact est bon » sont deux
états distincts, exactement comme « mergé » et « chez l'utilisateur ».

---

## Check-list avant de dire « ça marche »

- [ ] Les erreurs Supabase sont remontées à l'écran, pas avalées en tableau vide.
- [ ] Aucun `??` ne fabrique un droit, un montant ou un compte.
- [ ] Les listes de colonnes des tables touchées sont à jour chez **tous** les appelants.
- [ ] Aucun `select('*')` sur une table à colonnes sensibles ; l'export inspecte ses colonnes.
- [ ] Les fixtures reproduisent les états écrits par les webhooks / triggers réels.
- [ ] Chaque assertion peut échouer — vérifié en la faisant échouer une fois.
- [ ] Les mutations sensibles passent par une RPC `SECURITY DEFINER` gardée `is_box_admin`,
      `search_path` fixé, testée au vrai JWT (propriétaire, gérant tiers, athlète, anon).
- [ ] Une fermeture de colonne est prouvée par une **lecture refusée au vrai JWT**, jamais par
      le catalogue : `REVOKE` sur colonne ne retire rien tant que le `SELECT` de table est là.
- [ ] Une garde d'écriture est prouvée sur le rôle **sans** policy (0 ligne) et sur celui qui
      en a une (erreur attendue), puis par relecture de la ligne.
- [ ] Rejeu sur les données réelles après application de la migration, pas seulement en local.
- [ ] Un déploiement OTA est prouvé par l'**identité de l'update reçu** sur l'appareil, jamais
      par « l'écran s'affiche » : avant la coupe, l'ancien code s'affiche aussi.
- [ ] L'artefact **réellement servi** contient sa configuration (`NEXT_PUBLIC_*` sont inlinées
      au build) : un déploiement réussi peut livrer un artefact vide, applicable et inerte.
