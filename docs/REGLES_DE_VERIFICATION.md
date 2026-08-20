# Règles de vérification — « la valeur plausible qui ment »

Neuf bugs de la même famille ont été attrapés sur six chantiers (invitations, présences,
statistiques, formats de tournoi, portabilité, sécurité des profils et des paiements).
Aucun n'était visible à l'écran : chacun affichait un chiffre ou un état **crédible, stable
et faux**. Un plantage se voit ; une
valeur plausible se croit, et se croit longtemps.

Ce document liste les règles qui en sortent. Il ne prescrit pas un style de code : il
prescrit **ce qu'il faut aller vérifier avant de dire qu'une chose marche**.

---

## Les occurrences, en une ligne chacune

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
| Lot 4 — RPC de lecture staff | « l'appel anonyme est refusé », `42501` | c'était le *corps* qui refusait ; le grant était ouvert — une barrière sur deux |
| Grants de fonction | règle écrite « `REVOKE … FROM anon` », appliquée 20 fois | `anon` hérite de `PUBLIC` : la règle prescrivait la moitié sans effet |
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

## 12. Une capacité serveur sans appelant doit le dire dans son en-tête

Trois fonctions livrées, gardées, testées — et **jamais exécutées par un utilisateur réel**,
faute d'un bouton qui les appelle :

| Fonction | Appelants dans les interfaces | État |
|---|---|---|
| `join_program(p_source => 'staff')` | aucun (le webhook Stripe n'emprunte que la porte `'stripe'`) | point d'extension, lot 5 |
| `get_athlete_private_profile()` | aucun avant le lot 4 web | atteignable depuis la fiche athlète de `/members` |
| `resolve_program_week_source('template')` | aucun avant le lot 3 | exercé par le Whiteboard web |

Un point d'extension assumé est légitime. Ce qui ne l'est pas, c'est qu'il soit
**indistinguable d'une fonctionnalité livrée** quand on relit le code six mois plus tard :
la garde est écrite, le test passe, le nom promet un usage — et pourtant aucun chemin réel
n'y mène. C'est la même famille que le reste de ce document : un état crédible, stable et
faux, sauf qu'ici ce qui ment est la *présence* de la capacité, pas une valeur.

Donc : une fonction sans appelant dans les interfaces le déclare dans son commentaire
d'en-tête, avec cette formule exacte —

```sql
-- Règle 12 : point d'extension, aucun appelant à ce jour, non exercé en production.
```

Et la formule **part** le jour où un écran l'appelle : une annotation périmée redevient un
mensonge. Le corollaire de vérification : « la fonction existe et ses tests passent » ne dit
rien de « un utilisateur peut l'atteindre ». La seconde affirmation se prouve en cherchant
l'appel dans les deux dépôts, pas en relisant la migration. Côté web, le premier appelant réel de
`get_athlete_private_profile()` est la fiche athlète de `/members` (lot 4).

---

## 13. Un code de retour que plusieurs gardes produisent n'est pas discriminant

L'assertion du lot 4 disait « l'appel non authentifié est refusé », et elle était verte. Elle
l'était **dans les deux états** :

```
grant ouvert   → 42501  « Authentification requise »          ← le corps refuse
grant fermé    → 42501  « permission denied for function … »  ← le grant refuse
```

Deux barrières étaient prévues, une seule était en place, et le test ne pouvait pas le voir :
il validait **qu'on refuse**, pas **qui refuse**. Une barrière retirée était invisible.

C'est la même famille que le `?? ['simple']` (règle 1) et que le « succès à zéro ligne »
(règle 9) : **la valeur observée est correcte, la conclusion qu'on en tire ne l'est pas.**

Donc, sur toute assertion d'autorisation — et la remarque vaut autant pour un code HTTP que
pour un SQLSTATE :

- si deux chemins peuvent produire le code observé, l'assertion **nomme la barrière** — par
  le message, ou par un effet propre à une seule d'entre elles. Côté web, un `403` rendu par
  le middleware, par la garde `owner`-strict d'une route, ou par la RLS, sont trois faits
  différents derrière un même chiffre ;
- le message est un contrat de test acceptable quand il est produit par le moteur
  (`permission denied for function`), pas quand il vient de notre propre `throw` ;
- corollaire de conception : quand deux gardes doivent tenir, **chacune se prouve seule**.
  Une garde qui n'est vérifiée qu'à travers l'autre peut disparaître sans qu'un test bouge.

---

## 14. Une règle qui s'est déjà oubliée ne se réécrit pas : elle devient un contrôle

`REVOKE … FROM PUBLIC` sur une fonction était **déjà** appliqué dans 20 migrations, et la
règle écrite existait côté serveur. Elle disait « sans `REVOKE … FROM anon`, la RPC reste
appelable par la clé anon » — soit précisément **la moitié qui ne suffit pas** : `anon`
hérite du grant implicite de `PUBLIC`, et le revoke nominatif ne retire pas l'héritage. La
règle 8 avait déjà dit cela des colonnes ; la transposition aux fonctions n'avait pas été
faite.

En interrogeant le catalogue au lieu de relire le SQL, la cause s'est révélée en amont de
l'oubli : toute fonction créée dans `public` **naît** atteignable par la clé anonyme (défaut
câblé de PostgreSQL vers `PUBLIC`, plus un `anon=X` dans `pg_default_acl`). Et les deux ne se
ferment pas de la même façon — seule la forme **globale** de `ALTER DEFAULT PRIVILEGES`
annule le défaut du moteur ; la forme `IN SCHEMA` ne ferme que l'entrée de `pg_default_acl`.

D'où la réponse : non pas une ligne de prose de plus, mais une **assertion structurelle** qui
interroge `pg_proc` — `scripts/test-grants.mjs` dans le dépôt serveur, suite `grants`,
incluse dans `all` (R1 : rien à `PUBLIC` ; R2 : `anon` limité à une liste blanche annotée ;
R3 : une fonction neuve n'est atteignable par personne sans grant explicite).

Généralisation, valable dans ce dépôt aussi : **une règle qu'on relit s'oublie, une règle que
la CI applique ne s'oublie pas.** La deuxième occurrence d'une même famille est le signal
qu'il faut sortir de la prose — et un contrôle ne compte que si on l'a fait échouer une fois
exprès (règle 4).

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
- [ ] Toute fonction serveur neuve a **un appelant nommé dans une interface**, ou l'annotation
      de la règle 12 dans son en-tête. Et l'annotation est retirée le jour où l'écran arrive.
- [ ] Aucune assertion d'autorisation ne repose sur le seul **code** de retour (`403`, `42501`)
      quand plusieurs gardes le produisent : on nomme la barrière qui a refusé.
- [ ] Une règle qui s'est déjà oubliée une fois est devenue un **contrôle en CI**, pas une
      ligne de plus dans ce document.
