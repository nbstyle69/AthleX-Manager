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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Un "}<_components.strong>{"groupe"}</_components.strong>{" rassemble des membres (un niveau, un créneau, un suivi particulier). Il sert d'audience aux WODs et de filtre dans la liste des membres. Les groupes se gèrent dans Communauté → Groupes."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Groupes"}</_components.strong>{" et clique "}<_components.strong>{"Nouveau groupe"}</_components.strong>{" : donne-lui un nom clair pour un coach pressé (« Compétiteurs », « Midi », « Débutants »). "}<Screenshot src="/tutorials/groupes-de-membres/1.png" alt="Liste des groupes de la box" /></_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Créer et ajouter des membres"}</_components.strong>{" : le détail du groupe s'ouvre. Dans "}<_components.strong>{"Ajouter des membres"}</_components.strong>{", clique "}<_components.strong>{"Ajouter"}</_components.strong>{" en face de chaque membre ; la recherche (par pseudo) et les "}<_components.strong>{"Filtres"}</_components.strong>{" portent sur les membres actifs de la box. "}<Screenshot src="/tutorials/groupes-de-membres/3.png" alt="Bloc Ajouter des membres du détail d'un groupe" /></_components.li>{"\n"}<_components.li>{"Va dans "}<_components.strong>{"Membres"}</_components.strong>{" pour vérifier le résultat : clique "}<_components.strong>{"Filtres"}</_components.strong>{", puis choisis le groupe dans la liste "}<_components.strong>{"Tous les groupes"}</_components.strong>{" pour n'afficher que lui. "}<Screenshot src="/tutorials/groupes-de-membres/2.png" alt="Page Membres et son filtre de groupe" /></_components.li>{"\n"}<_components.li>{"Utilise ensuite le groupe comme audience : dans un WOD, choisis "}<_components.strong>{"Ces groupes"}</_components.strong>{" et coche-le."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Ces groupes » est grisé dans un WOD"}</_components.strong>{" (infobulle « Aucun groupe dans cette box »). Aucun groupe n'existe encore → crée-en un dans "}<_components.strong>{"Groupes"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre ne reçoit pas les WODs du groupe."}</_components.strong>{" Il n'a jamais été ajouté au groupe, ou son compte n'est plus actif → dans "}<_components.strong>{"Membres"}</_components.strong>{", vérifie ses colonnes "}<_components.strong>{"Groupes"}</_components.strong>{" et "}<_components.strong>{"Statut"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un groupe supprimé rend ses WODs visibles par toute la box."}</_components.strong>{" La confirmation le dit : « Les WOD réservés à ce seul groupe deviendront visibles par tous les membres de la box. » → avant de supprimer, rouvre ces WODs et choisis une autre audience."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="groups" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
