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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Horaires & Créneaux"}</_components.strong>{" (Entraînement → Horaires) contient les cours réservables de la box, jour par jour. Les modèles de semaine se gèrent à côté, dans Créneaux types."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Horaires & Créneaux"}</_components.strong>{" et place-toi sur le jour visé."}</_components.li>{"\n"}<_components.li>{"Clique pour ajouter un créneau et remplis-le : "}<_components.strong>{"Type de cours"}</_components.strong>{" (ou un "}<_components.strong>{"Nom personnalisé"}</_components.strong>{"), "}<_components.strong>{"Début"}</_components.strong>{", durée, "}<_components.strong>{"Capacité"}</_components.strong>{" et éventuellement une "}<_components.strong>{"Description"}</_components.strong>{". "}<Screenshot src="/tutorials/creneaux-et-reservations/1.png" alt="Formulaire de création d'un créneau" /></_components.li>{"\n"}<_components.li>{"Assigne un "}<_components.strong>{"Coach (optionnel)"}</_components.strong>{" : il apparaît côté athlète et permet à tes coachs de se repérer."}</_components.li>{"\n"}<_components.li>{"Enregistre : le créneau devient réservable par les membres, dans la limite de la capacité."}</_components.li>{"\n"}<_components.li>{"Le jour du cours, ouvre le créneau et clique "}<_components.strong>{"Faire l'appel"}</_components.strong>{" pour voir les inscrits et marquer les présences. Tu peux aussi "}<_components.strong>{"Ajouter un membre"}</_components.strong>{" à la main si quelqu'un arrive sans réservation."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Aucun coach assigné à cette box. »"}</_components.strong>{" Aucun coach n'est enregistré dans Réglages → ajoute-le, puis reviens assigner le créneau."}</_components.li>{"\n"}<_components.li><_components.strong>{"Un membre ne peut pas réserver."}</_components.strong>{" La capacité est atteinte, ou le créneau est passé → augmente la capacité ou ouvre un second créneau."}</_components.li>{"\n"}<_components.li><_components.strong>{"« Aucun inscrit pour ce créneau » alors que le cours est plein."}</_components.strong>{" Tu regardes un autre jour ou un autre créneau du même type → vérifie la date affichée en haut."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les créneaux de la semaine prochaine sont absents."}</_components.strong>{" Ils se génèrent depuis les Créneaux types → ouvre cette page pour poser la grille récurrente."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="schedule" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
