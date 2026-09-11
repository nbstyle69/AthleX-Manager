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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Chaque WOD porte une audience, réglée dans le bloc "}<_components.strong>{"Qui reçoit ce WOD ?"}</_components.strong>{" de l'éditeur. C'est le seul élément qui décide de ce qu'un membre voit dans son application."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Sur le Whiteboard, ouvre le WOD concerné et descends jusqu'à "}<_components.strong>{"Qui reçoit ce WOD ?"}</_components.strong>{". "}<Screenshot src="/tutorials/visibilite-d-un-wod/1.png" alt="Bloc Qui reçoit ce WOD ? avec les trois choix d'audience" /></_components.li>{"\n"}<_components.li>{"Choisis "}<_components.strong>{"Toute la box"}</_components.strong>{" pour la programmation commune : tous les membres actifs voient la séance à l'heure indiquée."}</_components.li>{"\n"}<_components.li>{"Choisis "}<_components.strong>{"Ces groupes"}</_components.strong>{" puis coche les groupes visés pour une séance réservée à un niveau, un créneau ou un programme."}</_components.li>{"\n"}<_components.li>{"Garde "}<_components.strong>{"Personne encore"}</_components.strong>{" pour un brouillon : la séance reste visible de toi seul dans le back-office."}</_components.li>{"\n"}<_components.li>{"Enregistre. La carte du Whiteboard rappelle l'audience choisie — vérifie-la d'un coup d'œil avant le début du cours."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Mes athlètes ne voient rien alors que le WOD est là. »"}</_components.strong>{" Le WOD est en « Personne encore » : aucun membre ne le voit, jamais → change l'audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les semaines reçues de la Marketplace n'apparaissent pas côté athlète."}</_components.strong>{" Les poses automatiques du cron arrivent en « Personne encore » : c'est volontaire, à toi de dire qui les reçoit → ouvre chaque séance reçue et choisis son audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre du groupe ne voit toujours pas la séance."}</_components.strong>{" Il n'est pas dans le groupe coché, ou n'est plus membre actif → vérifie sa fiche dans Membres."}</_components.li>{"\n"}<_components.li><_components.strong>{"La séance apparaît en retard."}</_components.strong>{" L'heure du WOD est l'heure de publication → avance-la si tu veux que les athlètes l'aient le matin."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
