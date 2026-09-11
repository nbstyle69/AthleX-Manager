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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Le "}<_components.strong>{"Whiteboard"}</_components.strong>{" (Entraînement → Whiteboard) affiche la semaine courante, un jour par colonne. Un WOD appartient à un jour et à une heure de publication ; tu peux le préparer à l'avance sans qu'il soit visible."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Sur le Whiteboard, place-toi sur la bonne semaine avec les flèches ou "}<_components.strong>{"Aller à une date"}</_components.strong>{", puis clique "}<_components.strong>{"Nouveau WOD"}</_components.strong>{" (ou directement dans la case d'un jour vide). "}<Screenshot src="/tutorials/creer-un-wod/1.png" alt="Whiteboard de la semaine avec le bouton Nouveau WOD" /></_components.li>{"\n"}<_components.li>{"Remplis l'en-tête : "}<_components.strong>{"Titre"}</_components.strong>{" (par exemple « Fran », « Intervalles Hybrid »), "}<_components.strong>{"Date"}</_components.strong>{", "}<_components.strong>{"Heure"}</_components.strong>{", "}<_components.strong>{"Type"}</_components.strong>{" et "}<_components.strong>{"Block"}</_components.strong>{" si tu utilises ces repères. L'heure indiquée est celle à laquelle le WOD devient visible le jour programmé."}</_components.li>{"\n"}<_components.li>{"Dans "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{", saisis une ligne par mouvement : reps, exercice choisi dans la liste, puis les charges hommes et femmes. Choisir l'exercice dans la liste est ce qui garantit le comptage des badges de tes athlètes."}</_components.li>{"\n"}<_components.li>{"Ajoute si besoin les notes de séance dans "}<_components.strong>{"Notes Coach"}</_components.strong>{" (scaling, consignes) et une "}<_components.strong>{"Vidéo YouTube"}</_components.strong>{" de démonstration. "}<Screenshot src="/tutorials/creer-un-wod/2.png" alt="Éditeur de WOD : titre, mouvements et charges" /></_components.li>{"\n"}<_components.li>{"Choisis l'audience dans "}<_components.strong>{"Qui reçoit ce WOD ?"}</_components.strong>{" : « Toute la box », « Ces groupes » ou « Personne encore »."}</_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Publier"}</_components.strong>{". Le WOD apparaît dans la case du jour ; un clic sur la carte le rouvre pour le modifier."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Le WOD est créé mais aucun athlète ne le voit."}</_components.strong>{" L'audience est restée sur « Personne encore » → rouvre le WOD et choisis « Toute la box » ou les groupes concernés."}</_components.li>{"\n"}<_components.li><_components.strong>{"Impossible de valider avec « Ces groupes »."}</_components.strong>{" Aucun groupe n'est coché, l'éditeur affiche « Coche au moins un groupe. » → coche les groupes, ou repasse sur « Toute la box »."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les badges des athlètes ne bougent pas après la séance."}</_components.strong>{" Le mouvement a été tapé librement au lieu d'être choisi dans la liste → réédite la ligne et sélectionne l'exercice du catalogue."}</_components.li>{"\n"}<_components.li><_components.strong>{"Le crayon de la carte est inactif."}</_components.strong>{" Cette séance vient d'une programmation Marketplace : son contenu n'est pas modifiable, seule l'audience l'est."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
