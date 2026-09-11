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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Une "}<_components.strong>{"semaine type"}</_components.strong>{" est une copie figée d'une semaine du Whiteboard, rangée dans ta box pour être reposée quand tu veux. Elle est interne : elle ne se vend pas et ne s'expose à personne."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Sur le Whiteboard, affiche la semaine que tu veux garder comme modèle."}</_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Enregistrer comme semaine type"}</_components.strong>{", donne-lui un nom parlant (par exemple « Semaine Hybrid – volume »), puis valide. "}<Screenshot src="/tutorials/semaines-types/1.png" alt="Modale Enregistrer comme semaine type" /></_components.li>{"\n"}<_components.li>{"Pour la reposer, place-toi sur la semaine cible et ouvre "}<_components.strong>{"Programmation"}</_components.strong>{" : la modale liste "}<_components.strong>{"Mes semaines types"}</_components.strong>{" et les "}<_components.strong>{"Programmations Marketplace"}</_components.strong>{" auxquelles la box est abonnée."}</_components.li>{"\n"}<_components.li>{"Choisis la semaine type, la "}<_components.strong>{"Semaine cible"}</_components.strong>{", puis l'audience dans "}<_components.strong>{"Qui voit ces WOD ?"}</_components.strong>{" — sans ce choix, l'application n'est pas possible."}</_components.li>{"\n"}<_components.li>{"Applique. Les WODs sont recopiés sur les jours de la semaine cible ; les séances qui portent déjà un score ou une complétion ne sont pas touchées par un remplacement."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« J'ai enregistré une semaine type, mais mon offre Marketplace est toujours vide. »"}</_components.strong>{" « Enregistrer comme semaine type » n'alimente pas une offre : c'est "}<_components.strong>{"Copier vers une offre"}</_components.strong>{" qui recopie la semaine dans une semaine d'offre → utilise ce bouton depuis le Whiteboard ou depuis la semaine type."}</_components.li>{"\n"}<_components.li><_components.strong>{"La modale Programmation est vide."}</_components.strong>{" Aucune semaine type n'existe et la box n'est abonnée à aucune programmation → enregistre une semaine, ou abonne-toi dans Entraînement → Marketplace."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les WODs posés ne sont visibles par personne."}</_components.strong>{" L'audience choisie à l'application était « personne encore » → rouvre les séances et fixe leur audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"Supprimer une semaine type a-t-il effacé mes semaines ?"}</_components.strong>{" Non : les semaines déjà posées sur le Whiteboard restent, seul le modèle disparaît."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
