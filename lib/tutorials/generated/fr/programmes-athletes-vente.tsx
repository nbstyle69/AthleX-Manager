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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Programmes athlètes"}</_components.strong>{" (Business → Programmes athlètes) regroupe ce que tu proposes à tes membres : programmes de coaching, formules d'abonnement, drop-in. Pour encaisser en ligne, les paiements doivent être activés pour la box ; la commission plateforme est affichée sur la page."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Programmes athlètes"}</_components.strong>{". Si la page t'invite à "}<_components.strong>{"activer les paiements pour vendre tes programmes"}</_components.strong>{", fais-le d'abord : sans cela, tu ne peux qu'assigner des accès à la main."}</_components.li>{"\n"}<_components.li>{"Crée ton offre et choisis sa nature : programme de coaching à "}<_components.strong>{"Durée définie"}</_components.strong>{", "}<_components.strong>{"Abonnement"}</_components.strong>{" mensuel, ou "}<_components.strong>{"Drop-in"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li>{"Renseigne le prix, la "}<_components.strong>{"Durée (semaines)"}</_components.strong>{" ou l'"}<_components.strong>{"Engagement"}</_components.strong>{" selon le cas, la description, et les "}<_components.strong>{"Conditions / mentions"}</_components.strong>{" affichées au visiteur avant le paiement. "}<Screenshot src="/tutorials/programmes-athletes-vente/1.png" alt="Formulaire d'une offre : prix, durée, conditions" /></_components.li>{"\n"}<_components.li>{"Coche "}<_components.strong>{"Actif (visible pour les athlètes)"}</_components.strong>{" quand l'offre est prête : c'est ce qui la fait apparaître sur ta page publique."}</_components.li>{"\n"}<_components.li>{"Ajoute si tu veux un "}<_components.strong>{"Code promo"}</_components.strong>{" (remise, durée de la remise pour les abonnements), ou utilise "}<_components.strong>{"Donner l'accès à un membre"}</_components.strong>{" pour offrir un programme sans paiement en ligne."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"L'offre n'apparaît pas côté athlète."}</_components.strong>{" Elle n'est pas cochée "}<_components.strong>{"Actif (visible pour les athlètes)"}</_components.strong>{" → coche la case et recharge la page publique."}</_components.li>{"\n"}<_components.li><_components.strong>{"Le paiement échoue ou le bouton manque."}</_components.strong>{" Les paiements ne sont pas activés pour la box → active-les depuis la page, puis réessaie."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un code promo reste sans effet."}</_components.strong>{" Il est expiré, ou sa durée de remise est terminée → vérifie la date d'expiration affichée dans Codes promo."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre a payé mais n'a pas le contenu."}</_components.strong>{" Le programme vendu n'a pas encore de séances → remplis-le, ou donne-lui l'accès à un programme complet."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="programs" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
