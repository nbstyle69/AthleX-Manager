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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Tu viens de créer ta box : le Dashboard est la page d'accueil du back-office, et la barre latérale regroupe les rubriques par casquette (Entraînement, Communauté, Animation, Business). Compte cinq minutes pour cette mise en route."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre le "}<_components.strong>{"Dashboard"}</_components.strong>{" : les compteurs du haut (membres, réservations, tournois, messages non lus) sont des raccourcis, pas de simples chiffres — un clic ouvre la rubrique correspondante. "}<Screenshot src="/tutorials/premiers-pas/1.png" alt="Dashboard avec les compteurs de la box" /></_components.li>{"\n"}<_components.li>{"Va dans "}<_components.strong>{"Réglages"}</_components.strong>{" et remplis les "}<_components.strong>{"Informations de la box"}</_components.strong>{" : nom, logo, bannière. Ce sont les éléments que voient tes membres et les visiteurs de ta page publique."}</_components.li>{"\n"}<_components.li>{"Toujours dans "}<_components.strong>{"Réglages"}</_components.strong>{", ajoute tes "}<_components.strong>{"Coachs"}</_components.strong>{". Un coach voit le Whiteboard, les Horaires, les Créneaux types, les Messages et l'Aide ; il ne voit ni les prix ni les abonnés."}</_components.li>{"\n"}<_components.li>{"Récupère le "}<_components.strong>{"code invitation"}</_components.strong>{" depuis le Dashboard et transmets-le à tes adhérents : c'est par lui qu'ils rejoignent la box dans l'application athlète."}</_components.li>{"\n"}<_components.li>{"Crée tes premiers "}<_components.strong>{"Groupes"}</_components.strong>{" (Communauté → Groupes) si tu programmes différemment selon les créneaux ou les niveaux : ils servent ensuite à cibler les WODs."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Un coach dit qu'il ne voit pas les Programmes athlètes."}</_components.strong>{" C'est volontaire : la page fixe des prix, elle est réservée au gérant → passe par ton propre compte owner."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre ne trouve pas la box dans l'app."}</_components.strong>{" Le code d'invitation n'a pas été communiqué ou a été recopié à la main avec une erreur → renvoie-le depuis le Dashboard."}</_components.li>{"\n"}<_components.li><_components.strong>{"Le logo n'apparaît pas côté athlète."}</_components.strong>{" L'image n'a pas été enregistrée dans Réglages, ou le téléversement a échoué → recharge la page et vérifie que l'aperçu du logo s'affiche."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="dashboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
