/* eslint-disable */
// @ts-nocheck
// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
/*@jsxRuntime automatic*/
/*@jsxImportSource react*/
/*TODO Nab: vérifier libellé — la spec parle du lundi suivant l'abonnement, l'écran Marketplace annonce le dimanche 18h*/
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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Une fois la box abonnée, les semaines d'une programmation se posent sur le Whiteboard : automatiquement si tu l'as demandé, sinon à la main depuis le bouton "}<_components.strong>{"Programmation"}</_components.strong>{"."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Sur le Whiteboard, clique "}<_components.strong>{"Programmation"}</_components.strong>{". La modale liste "}<_components.strong>{"Mes semaines types"}</_components.strong>{" puis "}<_components.strong>{"Programmations Marketplace"}</_components.strong>{" avec tes abonnements actifs (offre, box qui publie, nombre de WOD et de semaines). "}<Screenshot src="/tutorials/marketplace-appliquer-au-whiteboard/1.png" alt="Modale Programmation avec un abonnement Marketplace sélectionné" /></_components.li>{"\n"}<_components.li>{"Sélectionne l'abonnement à poser : il se surligne et les champs de pose apparaissent."}</_components.li>{"\n"}<_components.li>{"Choisis la "}<_components.strong>{"Semaine source"}</_components.strong>{" (la semaine de la programmation, avec son nombre de WOD) et la "}<_components.strong>{"Semaine cible"}</_components.strong>{" (le lundi à partir duquel les séances se posent). La modale rappelle la date exacte retenue."}</_components.li>{"\n"}<_components.li>{"Choisis l'audience dans "}<_components.strong>{"Qui voit ces WOD ?"}</_components.strong>{" : "}<_components.strong>{"Toute la box"}</_components.strong>{", "}<_components.strong>{"Ces groupes"}</_components.strong>{" ou "}<_components.strong>{"Personne encore"}</_components.strong>{". Ce choix devient aussi la visibilité par défaut de l'application automatique de cet abonnement."}</_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Appliquer"}</_components.strong>{". Les séances arrivent sur les jours de la semaine cible, à la couleur de l'abonnement ; celles qui portent déjà un score ou une complétion ne sont pas remplacées."}</_components.li>{"\n"}<_components.li>{"Ajuste ensuite carte par carte : l'audience reste la tienne, et une séance reçue peut être déplacée ou supprimée individuellement."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Les semaines automatiques n'arrivent pas au bon moment."}</_components.strong>{" Avec l'application automatique, la semaine due se pose le dimanche à 18h pour la semaine qui suit ; poser une semaine à la main réaligne l'ancrage sur ce que tu viens de faire. "}{}</_components.li>{"\n"}<_components.li><_components.strong>{"Une séance reçue refuse d'être modifiée."}</_components.strong>{" Son contenu appartient à la programmation : il n'est pas modifiable. Tu peux la supprimer, carte par carte, ou changer son audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"Personne ne voit les séances posées."}</_components.strong>{" L'audience est restée sur « Personne encore », ce qui est le cas par défaut des poses automatiques → fixe l'audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"La modale ne propose aucune programmation."}</_components.strong>{" "}<_components.code>{"Programmations Marketplace"}</_components.code>{" affiche "}<_components.code>{"Aucun abonnement actif"}</_components.code>{" : la box n'est abonnée à rien → passe par Entraînement → Marketplace."}</_components.li>{"\n"}<_components.li><_components.strong>{"Une semaine type posée n'est pas une offre Marketplace."}</_components.strong>{" Le haut de la modale ("}<_components.code>{"Mes semaines types"}</_components.code>{") pose tes propres modèles ; ça ne crée ni abonnement ni offre publiée."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
