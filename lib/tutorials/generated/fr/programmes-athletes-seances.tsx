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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"Un "}<_components.strong>{"programme athlète"}</_components.strong>{" est un suivi vendu ou assigné à un membre : il contient des séances organisées par semaine, indépendantes du Whiteboard de la box. La page est "}<_components.strong>{"Business → Programmes athlètes"}</_components.strong>{"."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre "}<_components.strong>{"Programmes athlètes"}</_components.strong>{" et sélectionne le programme à remplir (ou crée-le d'abord, voir le tutoriel sur la vente)."}</_components.li>{"\n"}<_components.li>{"Ouvre son éditeur de séances : les semaines sont numérotées selon la "}<_components.strong>{"Durée (semaines)"}</_components.strong>{" du programme. "}<Screenshot src="/tutorials/programmes-athletes-seances/1.png" alt="Éditeur de séances d'un programme athlète" /></_components.li>{"\n"}<_components.li>{"Ajoute une séance dans la semaine voulue, puis saisis son contenu comme un WOD : mouvements du catalogue, bloc Musculation, bloc Cardio, notes coach."}</_components.li>{"\n"}<_components.li>{"Tu peux partir d'un PDF : l'import propose les séances détectées et tu relis la preview avant insertion."}</_components.li>{"\n"}<_components.li>{"Enregistre. L'athlète qui a accès au programme voit les séances dans son carnet, semaine par semaine."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"L'athlète ne voit aucune séance."}</_components.strong>{" Le programme n'a pas de séances enregistrées, ou l'accès ne lui a pas été donné → vérifie les deux, l'accès se donne depuis Programmes athlètes."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les mouvements ne créditent pas de badge."}</_components.strong>{" Ils ont été tapés à la main au lieu d'être choisis dans la liste officielle → réédite les lignes concernées."}</_components.li>{"\n"}<_components.li><_components.strong>{"Une semaine est inaccessible."}</_components.strong>{" La durée du programme est plus courte que le nombre de semaines que tu veux écrire → augmente la "}<_components.strong>{"Durée (semaines)"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"Les séances d'un programme se retrouvent sur le Whiteboard."}</_components.strong>{" Ce sont deux espaces différents : un programme athlète ne se pose pas sur le Whiteboard de la box → passe par une semaine type si tu veux la programmer pour tous."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="programs" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
