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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Marketplace → Programmes athlètes"}</_components.strong>{" ("}<_components.code>{"/programming/athletes"}</_components.code>{") regroupe les programmes de coaching que tu vends à tes athlètes. Les formules d'accès à la salle (abonnement, Drop-in, carnet, essai) et les codes promo vivent désormais dans "}<_components.strong>{"Formules"}</_components.strong>{" — voir « Formules d'accès à la salle ». Pour encaisser en ligne, les paiements doivent être activés dans "}<_components.strong>{"Réglages → Paiements"}</_components.strong>{"."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Marketplace → Programmes athlètes"}</_components.strong>{". Si la page t'invite à "}<_components.strong>{"activer les paiements pour vendre tes programmes"}</_components.strong>{", fais-le depuis "}<_components.strong>{"Réglages → Paiements"}</_components.strong>{" : sans cela, tu ne peux qu'assigner des accès à la main. "}<Screenshot src="/tutorials/programmes-athletes-vente/1.png" alt="Onglet Programmes athlètes de Marketplace" /></_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Créer un programme"}</_components.strong>{" : la modale "}<_components.strong>{"Nouveau programme"}</_components.strong>{" demande un "}<_components.strong>{"Titre"}</_components.strong>{", une "}<_components.strong>{"Description"}</_components.strong>{" et un "}<_components.strong>{"Prix (€)"}</_components.strong>{". "}<Screenshot src="/tutorials/programmes-athletes-vente/2.png" alt="Modale Nouveau programme : titre, description, prix, type de programme, durée" /></_components.li>{"\n"}<_components.li>{"Choisis le "}<_components.strong>{"Type de programme"}</_components.strong>{" : "}<_components.strong>{"Programme fixe"}</_components.strong>{" (« Durée définie (6, 8, 12 sem.) »), qui ouvre "}<_components.strong>{"Durée (semaines)"}</_components.strong>{" et "}<_components.strong>{"Jours / semaine"}</_components.strong>{", ou "}<_components.strong>{"Ongoing"}</_components.strong>{" (« Programme continu »), sans date de fin. Ces champs sont dans la même modale qu'à l'étape 2."}</_components.li>{"\n"}<_components.li>{"Coche "}<_components.strong>{"Actif (visible pour les athlètes)"}</_components.strong>{" quand l'offre est prête, puis "}<_components.strong>{"Créer le programme"}</_components.strong>{" : c'est cette case qui la fait apparaître sur ta page publique."}</_components.li>{"\n"}<_components.li>{"Utilise "}<_components.strong>{"Donner l'accès à un membre"}</_components.strong>{" sur la fiche du programme pour offrir un accès sans paiement en ligne. Les "}<_components.strong>{"codes promo"}</_components.strong>{" se gèrent dans "}<_components.strong>{"Formules"}</_components.strong>{"."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"L'offre n'apparaît pas côté athlète."}</_components.strong>{" Elle n'est pas cochée "}<_components.strong>{"Actif (visible pour les athlètes)"}</_components.strong>{" → coche la case et recharge la page publique."}</_components.li>{"\n"}<_components.li><_components.strong>{"Le paiement échoue ou le bouton manque."}</_components.strong>{" Les paiements ne sont pas activés pour la box → termine la configuration dans "}<_components.strong>{"Réglages → Paiements"}</_components.strong>{", puis réessaie."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un code promo reste sans effet."}</_components.strong>{" Il est expiré, ou sa durée de remise est terminée → vérifie la date d'expiration dans "}<_components.strong>{"Formules → Codes promo"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre a payé mais n'a pas le contenu."}</_components.strong>{" Le programme vendu n'a pas encore de séances → remplis-le, ou donne-lui l'accès à un programme complet."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="programs" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
