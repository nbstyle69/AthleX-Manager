# État du projet AthleX — renvoi

**Ce fichier n'est pas l'état du projet : c'est un renvoi vers lui.**

La source unique est dans le dépôt de l'app mobile :

**[`athlex-app` → `docs/ETAT_DU_PROJET.md`](https://github.com/nbstyle69/athlex-app/blob/master/docs/ETAT_DU_PROJET.md)**

L'état couvre les deux dépôts (app mobile et back-office web), parce qu'un lot se ferme
souvent des deux côtés à la fois et qu'un état par dépôt donnerait deux vérités.

## Pourquoi un renvoi et pas une copie

Une copie diverge en silence : elle reste plausible en affichant un état périmé, ce qui est
exactement la famille de pannes que décrit
[`REGLES_DE_VERIFICATION.md`](./REGLES_DE_VERIFICATION.md). Un renvoi ne peut pas mentir sur
l'avancement — il ne le contient pas.

Le contrôle `__tests__/lib/etat-projet-mirror.test.ts` refuse qu'on transforme ce fichier en
copie : dès qu'il contient des sections d'état (« En production aujourd'hui », « Backlog à
déclencheur »…), il est rouge.

## La règle de mise à jour

Un lot qui se ferme sans sa ligne dans l'état du projet est un lot incomplet — même statut
que les types régénérés. Elle vaut pour les PRs de **ce** dépôt aussi : quand un lot web
ferme une capacité, sa ligne s'écrit dans le fichier de `athlex-app`, dans la foulée.
