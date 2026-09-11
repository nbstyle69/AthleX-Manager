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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Un "}<_components.strong>{"groupe"}</_components.strong>{" rassemble des membres (un niveau, un créneau, un suivi particulier). Il sert d'audience aux WODs et de filtre dans la liste des membres. Les groupes se gèrent dans Communauté → Groupes."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Groupes"}</_components.strong>{" et clique "}<_components.strong>{"Nouveau groupe"}</_components.strong>{" : donne-lui un nom clair pour un coach pressé (« Compétiteurs », « Midi », « Débutants »). "}<Screenshot src="/tutorials/groupes-de-membres/1.png" alt="Liste des groupes de la box" /></_components.li>{"\n"}<_components.li>{"Enregistre, puis ouvre le groupe pour y "}<_components.strong>{"Ajouter un membre"}</_components.strong>{" ; la recherche porte sur les membres actifs de la box."}</_components.li>{"\n"}<_components.li>{"Va dans "}<_components.strong>{"Membres"}</_components.strong>{" pour vérifier le résultat : le filtre "}<_components.strong>{"Tous les groupes"}</_components.strong>{" permet de n'afficher qu'un groupe à la fois."}</_components.li>{"\n"}<_components.li>{"Utilise ensuite le groupe comme audience : dans un WOD, choisis "}<_components.strong>{"Ces groupes"}</_components.strong>{" et coche-le."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Aucun groupe. Crée des groupes de cours d'abord. »"}</_components.strong>{" Le sélecteur d'audience reste vide tant qu'aucun groupe n'existe → crée-en un dans Groupes."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre ne reçoit pas les WODs du groupe."}</_components.strong>{" Il n'a jamais été ajouté au groupe, ou son compte n'est plus actif → vérifie sa fiche dans Membres."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un groupe supprimé laisse des WODs sans public."}</_components.strong>{" Les séances ciblées sur ce groupe ne trouvent plus personne → rouvre-les et choisis une autre audience."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="groups" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
