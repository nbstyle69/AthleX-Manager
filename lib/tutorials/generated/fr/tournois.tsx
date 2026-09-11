/* eslint-disable */
// @ts-nocheck
// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
/*@jsxRuntime automatic*/
/*@jsxImportSource react*/
function _createMdxContent(props) {
  const _components = {
    h2: "h2",
    li: "li",
    ol: "ol",
    p: "p",
    strong: "strong",
    ul: "ul",
    ...props.components
  }, {GoTo, Screenshot} = _components;
  if (!GoTo) _missingMdxReference("GoTo", true);
  if (!Screenshot) _missingMdxReference("Screenshot", true);
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Les "}<_components.strong>{"Tournois"}</_components.strong>{" (Animation → Tournois) animent la box : une épreuve, des participants, un classement. La page sépare "}<_components.strong>{"En cours & à venir"}</_components.strong>{" de l'"}<_components.strong>{"Historique"}</_components.strong>{"."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Tournois"}</_components.strong>{" et clique "}<_components.strong>{"Créer un tournoi"}</_components.strong>{". "}<Screenshot src="/tutorials/tournois/1.png" alt="Liste des tournois de la box" /></_components.li>{"\n"}<_components.li>{"Renseigne le tournoi : nom, date, niveau et format. Le "}<_components.strong>{"Statut"}</_components.strong>{" affiché dans la liste suit ensuite le cycle de vie de l'épreuve."}</_components.li>{"\n"}<_components.li>{"Ouvre le tournoi créé pour gérer ses "}<_components.strong>{"Participants"}</_components.strong>{" : les membres de la box s'ajoutent depuis la fiche."}</_components.li>{"\n"}<_components.li>{"Le jour J, saisis les résultats depuis la fiche du tournoi : le "}<_components.strong>{"Classement"}</_components.strong>{" se recalcule au fur et à mesure."}</_components.li>{"\n"}<_components.li>{"Une fois terminé, le tournoi part dans l'"}<_components.strong>{"Historique"}</_components.strong>{" et les performances restent visibles pour les athlètes."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Aucun tournoi. »"}</_components.strong>{" Rien n'a encore été créé dans cette box → clique Créer un tournoi."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre ne peut pas être inscrit."}</_components.strong>{" Il n'est pas membre actif de la box → vérifie sa fiche dans Membres."}</_components.li>{"\n"}<_components.li><_components.strong>{"Le classement semble figé."}</_components.strong>{" Tous les résultats ne sont pas saisis → complète les scores manquants depuis la fiche du tournoi."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un tournoi passé encombre la liste."}</_components.strong>{" Il rejoint l'Historique quand il est terminé → change son statut plutôt que de le supprimer, pour garder les performances."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="tournaments" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
