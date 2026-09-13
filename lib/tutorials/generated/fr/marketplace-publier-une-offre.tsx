/* eslint-disable */
// @ts-nocheck
// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
/*@jsxRuntime automatic*/
/*@jsxImportSource react*/
function _createMdxContent(props) {
  const _components = {
    code: "code",
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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Publier une offre, c'est proposer ta programmation aux autres box. L'onglet "}<_components.strong>{"Mes offres"}</_components.strong>{" de la Marketplace ("}<_components.code>{"/programming/offers"}</_components.code>{") contient tes programmations publiées ou en préparation."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Marketplace → Mes offres"}</_components.strong>{" ("}<_components.code>{"/programming/offers"}</_components.code>{") et crée une programmation : titre, description, objectif, public visé, discipline, niveau, "}<_components.strong>{"WOD par semaine"}</_components.strong>{" et facturation. "}<Screenshot src="/tutorials/marketplace-publier-une-offre/1.png" alt="Onglet Mes offres de la Marketplace" /></_components.li>{"\n"}<_components.li>{"Remplis ses semaines. Le plus rapide : depuis le Whiteboard, affiche une semaine réussie et clique "}<_components.strong>{"Copier vers une offre"}</_components.strong>{", puis choisis l'offre et le numéro de semaine."}</_components.li>{"\n"}<_components.li>{"Vérifie le contenu semaine par semaine. L'écran signale une offre dont la semaine 1 est vide."}</_components.li>{"\n"}<_components.li>{"Clique sur le bouton de publication de l'offre : elle rejoint le "}<_components.strong>{"Catalogue"}</_components.strong>{" et devient visible des autres box."}</_components.li>{"\n"}<_components.li>{"Si tu gères plusieurs box, tu peux aussi "}<_components.strong>{"diffuser à tes boxs"}</_components.strong>{" en décochant celles à exclure."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Publication refusée »."}</_components.strong>{" Une offre sans WOD ne se publie pas et n'apparaît pas dans le catalogue → remplis au moins la semaine 1, puis republie."}</_components.li>{"\n"}<_components.li><_components.strong>{"« J'ai enregistré une semaine type, l'offre est restée vide. »"}</_components.strong>{" Une semaine type est interne à ta box : elle n'alimente pas une offre → utilise "}<_components.strong>{"Copier vers une offre"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les box abonnées ne voient pas ma correction."}</_components.strong>{" Les copies sont indépendantes : modifier une semaine d'offre ne réécrit pas ce qui a déjà été reçu → préviens tes abonnées, ou corrige la semaine suivante."}</_components.li>{"\n"}<_components.li><_components.strong>{"Mon offre n'apparaît pas dans mon propre catalogue."}</_components.strong>{" C'est volontaire : on ne s'abonne pas à ses propres offres → vérifie-la depuis l'onglet Mes offres."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="marketplace-offers" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
