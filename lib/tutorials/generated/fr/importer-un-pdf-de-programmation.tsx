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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"L'import PDF lit un document de programmation et propose des séances prêtes à insérer : sur le "}<_components.strong>{"Whiteboard"}</_components.strong>{" pour la semaine de la box, ou dans l'éditeur de séances d'un "}<_components.strong>{"Programme athlète"}</_components.strong>{". L'analyse est une proposition, jamais un enregistrement direct."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Depuis le Whiteboard, ouvre l'import et dépose ton fichier — tu peux aussi le glisser directement sur la page, qui affiche « Lâche ton fichier pour l'importer »."}</_components.li>{"\n"}<_components.li>{"Attends la fin de l'"}<_components.strong>{"Analyse du PDF…"}</_components.strong>{". L'écran de preview liste chaque séance détectée avec ses mouvements, son bloc "}<_components.strong>{"Musculation"}</_components.strong>{" et ses "}<_components.strong>{"Notes coach"}</_components.strong>{". "}<Screenshot src="/tutorials/importer-un-pdf-de-programmation/1.png" alt="Écran de preview de l'import PDF avec les séances détectées" /></_components.li>{"\n"}<_components.li>{"Relis ligne par ligne. Les champs surlignés portent l'avertissement "}<_components.strong>{"Mouvement hors catalogue"}</_components.strong>{" : corrige-les en choisissant l'exercice de la liste, ou laisse le nom brut en connaissance de cause."}</_components.li>{"\n"}<_components.li>{"Choisis l'audience dans "}<_components.strong>{"Qui verra ces WOD"}</_components.strong>{" (ou "}<_components.strong>{"Qui verra ces séances"}</_components.strong>{" pour un programme athlète) : toute la box, des groupes, ou personne pour l'instant."}</_components.li>{"\n"}<_components.li>{"Valide l'insertion. Les séances arrivent sur les jours détectés et restent modifiables comme n'importe quel WOD."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Aucun WOD détecté dans ce PDF. »"}</_components.strong>{" Le document est une image scannée ou une mise en page que l'analyse ne reconnaît pas → saisis la semaine à la main, ou repasse par un PDF texte."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les charges en RPE ou en % du RM ont disparu des champs de poids."}</_components.strong>{" Une charge non numérique n'est pas un kilo : elle part en note de charge ou en notes coach → vérifie-la dans la preview avant d'insérer."}</_components.li>{"\n"}<_components.li><_components.strong>{"Des mouvements sont surlignés en orange."}</_components.strong>{" Ils sont hors catalogue et seront conservés tels quels, donc sans badge → remplace-les par une entrée de la liste."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les séances importées ne sont visibles par personne."}</_components.strong>{" L'audience choisie dans la preview était « personne encore » → rouvre chaque séance et fixe son audience."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
