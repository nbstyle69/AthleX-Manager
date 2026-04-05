# Matrice de Test QA — Test-admin

> Générée le 5 avril 2026 — Analyse statique complète du code source  
> **~90 cas de test** · **7 bugs identifiés** (2 critiques)

---

## 1. Authentification & Session

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 1.1 | Login avec email/password valides → redirige vers `/` | Happy path | 🔴 Critique | — |
| 1.2 | Login avec credentials invalides → affiche erreur sur `/login` | Edge case | 🔴 Critique | — |
| 1.3 | Accès à `/` sans session → redirige vers `/login` | Sécurité | 🔴 Critique | — |
| 1.4 | Accès à `/admin` avec rôle `box_owner` → redirige vers `/` | Sécurité | 🔴 Critique | — |
| 1.5 | Accès à `/` (dashboard) avec rôle `super_admin` sans box → comportement ? | Edge case | 🟡 Moyen | Le dashboard owner appelle `getMyBox()` qui retourne `null` pour un super_admin sans box — vérifier qu'il n'y a pas de crash |
| 1.6 | Cookie `sb-access-token` expiré (8h TTL) → force re-login | Edge case | 🟡 Moyen | — |
| 1.7 | `POST /api/auth/set-session` sans tokens → retourne 400 | Validation | 🟢 Faible | — |
| 1.8 | `GET /api/session` retourne user + cookies pour debug | Utilitaire | 🟢 Faible | — |

---

## 2. Dashboard Owner — Page principale (`/`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 2.1 | KPIs affichent les bons compteurs (tournois actifs, membres, scores en attente, messages non lus) | Happy path | 🔴 Critique | — |
| 2.2 | Liste des tournois récents affichée (limit 5) | Happy path | 🟡 Moyen | — |
| 2.3 | Widget code invitation affiché avec le bon code | Happy path | 🟡 Moyen | — |
| 2.4 | Widget upload logo fonctionnel | Happy path | 🟡 Moyen | — |
| 2.5 | Box sans tournois/membres/messages → KPIs à 0, listes vides | Edge case | 🟡 Moyen | — |
| 2.6 | Box `null` (owner sans box) → pas de crash | Edge case | 🔴 Critique | Potentiel crash si `getMyBox()` retourne null et les queries s'exécutent quand même |

---

## 3. Dashboard Owner — Membres (`/members`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 3.1 | Liste des membres affichée avec infos correctes | Happy path | 🔴 Critique | — |
| 3.2 | Recherche par nom filtre correctement | Happy path | 🟡 Moyen | — |
| 3.3 | Filtre par niveau (scaled/inter/rx/rx+/gx/pro) | Happy path | 🟡 Moyen | — |
| 3.4 | Filtre par groupe fonctionne | Happy path | 🟡 Moyen | — |
| 3.5 | Tri par nom/ELO/date fonctionne | Happy path | 🟡 Moyen | — |
| 3.6 | Assigner un rôle (member/coach/owner) → update en base | Happy path | 🔴 Critique | — |
| 3.7 | Assigner un plan de membership | Happy path | 🟡 Moyen | — |
| 3.8 | Toggle groupe (ajouter/retirer un membre d'un groupe) | Happy path | 🟡 Moyen | — |
| 3.9 | Ban un membre → statut passe à "banned" | Happy path | 🔴 Critique | — |
| 3.10 | Unban un membre → statut revient à "active" | Happy path | 🔴 Critique | — |
| 3.11 | Box sans membres → état vide affiché | Edge case | 🟢 Faible | — |
| 3.12 | Assigner le rôle "owner" à un autre membre → l'ancien owner perd-il son rôle ? | Edge case | 🔴 Critique | ⚠️ **B7** Pas de logique de transfert de propriété visible — risque de double owner |

---

## 4. Dashboard Owner — Stats (`/stats`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 4.1 | KPIs stats affichés (membres, tournois, WODs) | Happy path | 🟡 Moyen | — |
| 4.2 | Graphe inscriptions par période (7j/30j/90j) | Happy path | 🟡 Moyen | — |
| 4.3 | Breakdown par niveau et rôle | Happy path | 🟢 Faible | — |
| 4.4 | Stats réservations affichées | Happy path | 🟡 Moyen | — |
| 4.5 | Top ELO avec pagination et filtre genre | Happy path | 🟡 Moyen | — |
| 4.6 | Box sans données → graphes vides, KPIs à 0 | Edge case | 🟢 Faible | — |

---

## 5. Dashboard Owner — Settings (`/settings`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 5.1 | Upload logo (type image valide, < taille max) | Happy path | 🟡 Moyen | — |
| 5.2 | Changement de logo → ancien remplacé | Happy path | 🟡 Moyen | — |
| 5.3 | Suppression du logo → champ mis à null | Happy path | 🟡 Moyen | — |
| 5.4 | Upload fichier non-image → rejeté avec erreur | Validation | 🟡 Moyen | — |
| 5.5 | Upload fichier trop gros → rejeté avec erreur | Validation | 🟡 Moyen | — |

---

## 6. Admin — Dashboard (`/admin`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 6.1 | KPIs globaux affichés (contestations, daily tournaments actifs/total, users) | Happy path | 🔴 Critique | — |
| 6.2 | Lien rapide vers contestations si pending > 0 | Happy path | 🟡 Moyen | — |
| 6.3 | Aucune contestation → pas de lien affiché | Edge case | 🟢 Faible | — |

---

## 7. Admin — Users (`/admin/users`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 7.1 | Liste de tous les users avec détails (username, role, level, ELO, matches, wins) | Happy path | 🔴 Critique | — |
| 7.2 | Recherche par nom | Happy path | 🟡 Moyen | — |
| 7.3 | Tri par colonnes | Happy path | 🟡 Moyen | — |
| 7.4 | Mapping user → box affiché | Happy path | 🟢 Faible | — |
| 7.5 | 1000+ users → pas de pagination | Edge case | 🟡 Moyen | ⚠️ Charge tout en mémoire — performance dégradée à grande échelle |

---

## 8. Admin — Boxes (`/admin/boxes`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 8.1 | Liste toutes les boxes avec owner, member count, statut | Happy path | 🔴 Critique | — |
| 8.2 | Recherche par nom de box | Happy path | 🟡 Moyen | — |
| 8.3 | Création d'une box via modal (nom, owner username, invite code) | Happy path | 🔴 Critique | — |
| 8.4 | Création box avec owner inexistant → erreur gérée ? | Edge case | 🟡 Moyen | — |
| 8.5 | `POST /api/admin/boxes` sans auth check | Sécurité | 🔴 Critique | ⚠️ **B1** pas de `checkAdmin()` — tout user authentifié peut créer une box via l'API |

---

## 9. Admin — Box Detail (`/admin/boxes/[id]`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 9.1 | Onglet Infos : affiche nom, slug, ville, description, code invitation, date création | Happy path | 🟡 Moyen | — |
| 9.2 | Mode édition : modifier nom, ville, description, plan (free/pro/elite), active/inactive | Happy path | 🔴 Critique | — |
| 9.3 | Sauvegarde des modifications → PATCH API | Happy path | 🔴 Critique | — |
| 9.4 | Onglet Membres : table avec profil, rôle, niveau, ELO, statut | Happy path | 🟡 Moyen | — |
| 9.5 | Onglet Whiteboard : WODs avec scores leaderboard | Happy path | 🟡 Moyen | — |
| 9.6 | Onglet Tournois : liste des compétitions de la box | Happy path | 🟡 Moyen | — |
| 9.7 | Box inexistante → message "Box introuvable" | Edge case | 🟢 Faible | — |
| 9.8 | `PATCH /api/admin/boxes/[id]` sans auth check | Sécurité | 🔴 Critique | ⚠️ **B2** pas de `checkAdmin()` — même risque que 8.5 |
| 9.9 | `GET /api/admin/boxes/[id]` sans auth check | Sécurité | 🔴 Critique | ⚠️ **B2** données sensibles exposées sans vérification de rôle |

---

## 10. Admin — Daily Tournaments (`/admin/tournaments`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 10.1 | Liste des tournois avec participants, scores, ELO reward, statut | Happy path | 🔴 Critique | — |
| 10.2 | Filtres par statut (all/open/completed/cancelled) | Happy path | 🟡 Moyen | — |
| 10.3 | Forcer clôture (close) → calcul ELO + status completed | Happy path | 🔴 Critique | — |
| 10.4 | Annuler un tournoi (cancel) | Happy path | 🟡 Moyen | — |
| 10.5 | Supprimer un tournoi (delete) | Happy path | 🟡 Moyen | — |
| 10.6 | Click sur un tournoi → navigation vers detail | Happy path | 🟡 Moyen | — |
| 10.7 | Clôture d'un tournoi avec < 2 scores → ELO non calculé | Edge case | 🟡 Moyen | — |
| 10.8 | ELO K-factor = 32 dans cette route vs K=64 dans `lib/elo` | Cohérence | 🟡 Moyen | ⚠️ **B3** incohérence — le même type de calcul donne des résultats différents |

---

## 11. Admin — Tournament Detail (`/admin/tournaments/[id]`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 11.1 | Infos tournoi affichées (type, durée, niveau, score mode, max joueurs, ELO reward, mouvements) | Happy path | 🟡 Moyen | — |
| 11.2 | Actions tournoi : forcer clôture, annuler, ré-ouvrir, supprimer | Happy path | 🔴 Critique | — |
| 11.3 | Ré-ouvrir → revert ELO (elo_before restauré, history supprimée) | Happy path | 🔴 Critique | — |
| 11.4 | Filtres scores (all/pending/validated/contested/rejected) | Happy path | 🟡 Moyen | — |
| 11.5 | Éditer la valeur d'un score inline | Happy path | 🟡 Moyen | — |
| 11.6 | Valider / Rejeter / Remettre en attente un score | Happy path | 🔴 Critique | — |
| 11.7 | Supprimer un score | Happy path | 🟡 Moyen | — |
| 11.8 | Lien vidéo YouTube si fourni | Happy path | 🟢 Faible | — |
| 11.9 | Contestation : motif + nom du contestataire affiché | Happy path | 🟡 Moyen | — |
| 11.10 | Tournoi inexistant → redirect vers `/admin/tournaments` | Edge case | 🟢 Faible | — |

---

## 12. Admin — Contestations (`/admin/daily-contests`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 12.1 | Liste des scores contestés avec détails (athlète, tournoi, score, RX, raison, vidéo) | Happy path | 🔴 Critique | — |
| 12.2 | Valider un score contesté | Happy path | 🔴 Critique | — |
| 12.3 | Rejeter (supprimer) un score contesté | Happy path | 🔴 Critique | — |
| 12.4 | Aucune contestation → état vide | Edge case | 🟢 Faible | — |

---

## 13. Admin — Inter-Competitions (`/admin/inter-competitions`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 13.1 | Liste des compétitions inter-box (titre, format, type, statut, inscrits, scores) | Happy path | 🔴 Critique | — |
| 13.2 | Avancer le statut (draft→open→active→closed) | Happy path | 🔴 Critique | — |
| 13.3 | Clôture (active→closed) → calcul ELO multi-WOD avec ranking points | Happy path | 🔴 Critique | — |
| 13.4 | Supprimer une compétition | Happy path | 🟡 Moyen | — |
| 13.5 | Créer une compétition (titre, format, type, team_size, dates, capacité) | Happy path | 🔴 Critique | — |
| 13.6 | Éditer une compétition existante (`?edit=id`) | Happy path | 🟡 Moyen | — |

---

## 14. Admin — Inter-Competition Detail (`/admin/inter-competitions/[id]`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 14.1 | KPIs : inscrits, WODs, scores, en attente | Happy path | 🟡 Moyen | — |
| 14.2 | Onglet WODs : créer/éditer/supprimer/révéler un WOD (max 3) | Happy path | 🔴 Critique | — |
| 14.3 | Révéler un WOD immédiatement (set `revealed_at` = now) | Happy path | 🟡 Moyen | — |
| 14.4 | Onglet Participants : liste, disqualifier, retirer | Happy path | 🔴 Critique | — |
| 14.5 | Onglet Scores : valider/rejeter avec motif optionnel | Happy path | 🔴 Critique | — |
| 14.6 | Onglet Classement : standings par WOD avec ranking medals | Happy path | 🟡 Moyen | — |
| 14.7 | Badge notification sur tab Scores si pending > 0 | UX | 🟢 Faible | — |

---

## 15. Admin — Physical Competitions (`/admin/physical-competitions`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 15.1 | Liste des compétitions physiques avec logo, statut, mode, format, lieu, date, prix | Happy path | 🔴 Critique | — |
| 15.2 | Filtres par mode (all / qualification / info) | Happy path | 🟡 Moyen | — |
| 15.3 | Avancer statut (open→active→closed) | Happy path | 🟡 Moyen | — |
| 15.4 | Supprimer → supprime aussi les `physical_wods` associés | Happy path | 🟡 Moyen | — |
| 15.5 | Créer : choix mode (qualification en ligne vs sans qualif) | Happy path | 🔴 Critique | — |
| 15.6 | Mode qualification : dates début/fin, lieu, logo (overlay vidéo) | Happy path | 🔴 Critique | — |
| 15.7 | Mode info : date event, lieu, lien inscription externe, prix | Happy path | 🟡 Moyen | — |
| 15.8 | Upload logo → Supabase storage `assets/physical-competitions/` | Happy path | 🟡 Moyen | — |
| 15.9 | Éditer compétition existante (`?edit=id`) | Happy path | 🟡 Moyen | — |

---

## 16. Admin — Physical Competition Detail (`/admin/physical-competitions/[id]`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 16.1 | Détails compétition affichés (mode, format, lieu, date, lien, prix) | Happy path | 🟡 Moyen | — |
| 16.2 | Ajouter un WOD (nom, description, timer type, durée, rounds, work/rest, caméra toggle) | Happy path | 🔴 Critique | — |
| 16.3 | Timer types supportés : For Time, AMRAP, EMOM, Tabata | Happy path | 🟡 Moyen | — |
| 16.4 | Toggle caméra pré-configurée (mode qualification uniquement) | Happy path | 🟡 Moyen | — |
| 16.5 | Éditer / Supprimer un WOD existant | Happy path | 🟡 Moyen | — |
| 16.6 | Compétition inexistante → message + retour liste | Edge case | 🟢 Faible | — |

---

## 17. Admin — Badges (`/admin/badges`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 17.1 | Liste des badges du catalogue avec icône, titre, description, catégorie, nb gagnés | Happy path | 🟡 Moyen | — |
| 17.2 | Recherche par titre ou badge_key | Happy path | 🟢 Faible | — |
| 17.3 | Filtre par catégorie (activity, tournament, social, wod, elo, movement) | Happy path | 🟢 Faible | — |
| 17.4 | Compteurs "earned" corrects (agrégation earned_badges) | Happy path | 🟡 Moyen | — |
| 17.5 | Aucun badge en base → grille vide | Edge case | 🟢 Faible | — |

---

## 18. Admin — Movements (`/admin/movements`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 18.1 | Liste mouvements agrégés (total reps, nb athlètes, meilleure charge) | Happy path | 🟡 Moyen | — |
| 18.2 | Recherche par nom de mouvement | Happy path | 🟢 Faible | — |
| 18.3 | Click mouvement → leaderboard top 50 athlètes dans sidebar | Happy path | 🟡 Moyen | — |
| 18.4 | Mouvement sans charge → affiche "—" | Edge case | 🟢 Faible | — |

---

## 19. Admin — Analytics (`/admin/analytics`)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 19.1 | KPIs : users total, tournois, compét physiques, contestations, inter-box, boxes, inscrits 7j/30j | Happy path | 🔴 Critique | — |
| 19.2 | Graphe inscriptions par jour (période sélectionnable 7j/30j/90j) | Happy path | 🟡 Moyen | — |
| 19.3 | Répartition par rôle (athlete, admin, super_admin, box_owner, member) | Happy path | 🟡 Moyen | — |
| 19.4 | Aucune inscription sur la période → message vide | Edge case | 🟢 Faible | — |
| 19.5 | `daily_contests` table reference → vérifier que c'est le bon nom de table | Cohérence | 🟡 Moyen | ⚠️ **B4** Le reste du code utilise `daily_tournament_scores` pour les contestations, pas `daily_contests` — possible erreur de table |

---

## 20. API — AI (generate-wod, ai-analysis)

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 20.1 | Génération WOD retourne JSON structuré valide | Happy path | 🟡 Moyen | — |
| 20.2 | Analyse AI retourne texte d'analyse | Happy path | 🟡 Moyen | — |
| 20.3 | `ANTHROPIC_API_KEY` manquante → erreur 500 gérée | Edge case | 🟡 Moyen | — |
| 20.4 | Claude retourne JSON mal formé → `JSON.parse` crash | Edge case | 🟡 Moyen | ⚠️ Try/catch présent mais le cleanup regex est fragile |
| 20.5 | Analyse AI non persistée en base | Feature gap | 🟢 Faible | ⚠️ **B6** Code commenté à `app/api/ai-analysis/route.ts:43-44` |

---

## 21. API — Invite Code

| # | Cas de test | Type | Priorité | Bug identifié |
|---|------------|------|----------|---------------|
| 21.1 | Owner change le code invitation → uppercased, sauvegardé | Happy path | 🟡 Moyen | — |
| 21.2 | Code < 3 caractères → rejeté 400 | Validation | 🟡 Moyen | — |
| 21.3 | User non-owner → "Aucune box trouvée" 404 | Sécurité | 🟡 Moyen | — |
| 21.4 | Code déjà utilisé par une autre box → pas de vérification d'unicité | Edge case | 🟡 Moyen | ⚠️ **B5** Pas de contrainte UNIQUE visible côté API (dépend de la DB) |

---

## Résumé des bugs critiques identifiés

| # | Bug | Sévérité | Fichier |
|---|-----|----------|---------|
| **B1** | Pas de `checkAdmin()` sur `POST /api/admin/boxes` | 🔴 Critique | `app/api/admin/boxes/route.ts` |
| **B2** | Pas de `checkAdmin()` sur `GET/PATCH /api/admin/boxes/[id]` | 🔴 Critique | `app/api/admin/boxes/[id]/route.ts` |
| **B3** | K-factor ELO incohérent : K=32 (daily-tournaments) vs K=64 (`lib/elo`) | 🟡 Moyen | `app/api/admin/daily-tournaments/route.ts:41` |
| **B4** | Table `daily_contests` dans analytics vs `daily_tournament_scores` partout ailleurs | 🟡 Moyen | `app/admin/analytics/page.tsx:69` |
| **B5** | Pas de vérification d'unicité du code invitation | 🟡 Moyen | `app/api/box/invite-code/route.ts` |
| **B6** | AI analysis non persistée en base (code commenté) | 🟢 Faible | `app/api/ai-analysis/route.ts:43-44` |
| **B7** | Risque double owner si on assigne le rôle owner à un autre membre | 🟡 Moyen | `app/(dashboard)/members/page.tsx` |
