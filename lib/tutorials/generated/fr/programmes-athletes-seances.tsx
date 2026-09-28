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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Un "}<_components.strong>{"programme athlète"}</_components.strong>{" est un suivi vendu ou assigné à un membre : il contient des séances organisées par semaine, indépendantes du Whiteboard de la box. La page est "}<_components.strong>{"Marketplace → Programmes athlètes"}</_components.strong>{" ("}<_components.code>{"/programming/athletes"}</_components.code>{"), troisième onglet de la Marketplace."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Marketplace → Programmes athlètes"}</_components.strong>{" et repère la carte du programme à remplir (ou crée-le d'abord, voir le tutoriel sur la vente). "}<Screenshot src="/tutorials/programmes-athletes-seances/1.png" alt="Éditeur de séances d'un programme : semaine 1 / 8, colonnes des jours, deux jours en repos" /></_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Séances"}</_components.strong>{" sur sa carte : l'éditeur affiche « Semaine 1 / X », X étant la "}<_components.strong>{"Durée (semaines)"}</_components.strong>{" d'un programme fixe ; un programme Ongoing n'a pas de dernière semaine."}</_components.li>{"\n"}<_components.li>{"Choisis la semaine avec les flèches, puis clique "}<_components.strong>{"Ajouter"}</_components.strong>{" dans la colonne du jour (ou "}<_components.strong>{"Nouvelle séance"}</_components.strong>{") et saisis le contenu comme un WOD : "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{" (catalogue), "}<_components.strong>{"Musculation"}</_components.strong>{", "}<_components.strong>{"Cardio"}</_components.strong>{", "}<_components.strong>{"Notes Coach"}</_components.strong>{". Un jour marqué "}<_components.strong>{"Repos"}</_components.strong>{" (icône lune) n'accepte pas de séance."}</_components.li>{"\n"}<_components.li>{"Tu peux partir d'un fichier : "}<_components.strong>{"Importer"}</_components.strong>{" accepte un CSV ou un JSON (gabarit : "}<_components.strong>{"Modèle CSV"}</_components.strong>{")."}</_components.li>{"\n"}<_components.li>{"Chaque séance s'enregistre avec "}<_components.strong>{"Créer la séance"}</_components.strong>{". L'athlète qui a accès au programme la reçoit à partir de sa propre date de début : la semaine 1 est sa première semaine. Une séance dépubliée (œil barré) lui reste invisible."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"L'athlète ne voit aucune séance."}</_components.strong>{" Le programme n'a pas de séance publiée, ou l'accès ne lui a pas été donné → vérifie les deux ; l'accès se donne avec le bouton "}<_components.strong>{"Accès"}</_components.strong>{" de la carte du programme."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les mouvements ne créditent pas de badge."}</_components.strong>{" Ils ont été tapés à la main au lieu d'être choisis dans la liste officielle → réédite les lignes concernées."}</_components.li>{"\n"}<_components.li><_components.strong>{"Une semaine est inaccessible."}</_components.strong>{" La durée du programme est plus courte que le nombre de semaines que tu veux écrire → augmente la "}<_components.strong>{"Durée (semaines)"}</_components.strong>{" avec "}<_components.strong>{"Modifier"}</_components.strong>{" sur la carte du programme."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les séances d'un programme se retrouvent sur le Whiteboard."}</_components.strong>{" Ce sont deux espaces différents : un programme athlète ne se pose pas sur le Whiteboard de la box → passe par une semaine type si tu veux la programmer pour tous."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="programs" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
