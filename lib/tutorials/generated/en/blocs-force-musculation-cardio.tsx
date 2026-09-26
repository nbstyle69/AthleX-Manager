/* eslint-disable */
// @ts-nocheck
// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
/*@jsxRuntime automatic*/
/*@jsxImportSource react*/
function _createMdxContent(props) {
  const _components = {
    code: "code",
    em: "em",
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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"The WOD editor has three areas: "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{" (the metcon), "}<_components.strong>{"Musculation"}</_components.strong>{" (strength, optional) and "}<_components.strong>{"Cardio"}</_components.strong>{" (optional). Both optional blocks are written as sets, not as free reps."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open a WOD on the Whiteboard and find the "}<_components.strong>{"Musculation (optionnel)"}</_components.strong>{" block. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/3.png" alt="Musculation, Cardio and Time cap blocks of the WOD form" /></_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Ajouter une série"}</_components.strong>{", then fill in the exercise, sets, reps and the "}<_components.strong>{"Charge"}</_components.strong>{" in "}<_components.strong>{"kg"}</_components.strong>{" or "}<_components.strong>{"%1RM"}</_components.strong>{"; when the load depends on the day, write it in "}<_components.strong>{"Charge libre"}</_components.strong>{" ("}<_components.code>{"RPE 9"}</_components.code>{"). A "}<_components.strong>{"Tempo"}</_components.strong>{" ("}<_components.code>{"30X1"}</_components.code>{") and a rest value in seconds can complete the line. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/1.png" alt="Strength block with one set, load and tempo" /></_components.li>{"\n"}<_components.li>{"Scroll to the "}<_components.strong>{"Cardio (optionnel)"}</_components.strong>{" block and click "}<_components.strong>{"Ajouter une série cardio"}</_components.strong>{": pick the movement (Row, SkiErg, Run and so on), the number of sets and the quantity in metres, calories or seconds. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/2.png" alt="Cardio (optional) block with a Row set" /></_components.li>{"\n"}<_components.li>{"Add an intensity target if you want one: watts "}<_components.strong>{"or"}</_components.strong>{" pace, never both on the same line. Rest between sets is written as "}<_components.code>{"mm:ss"}</_components.code>{", and an "}<_components.strong>{"RPE"}</_components.strong>{" can complete the line. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/4.png" alt="Cardio line with watts, target, rest and RPE" /></_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Créer le WOD"}</_components.strong>{" (or "}<_components.strong>{"Enregistrer"}</_components.strong>{"): the three blocks reach the athlete app together, always in this order: Musculation, Cardio, then the metcon."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Strength sets credit no badge."}</_components.strong>{" That is the expected behaviour: sets in the strength block do not count badge reps, they are not metcon → put whatever must count in the metcon."}</_components.li>{"\n"}<_components.li><_components.strong>{"A cardio set is not credited."}</_components.strong>{" The cardio block "}<_components.em>{"is"}</_components.em>{" credited, as "}<_components.code>{"sets × quantity"}</_components.code>{", but a line without an exercise is not saved (\"Choisis l’exercice pour enregistrer cette série.\") → pick Row, SkiErg, Run and so on from the list."}</_components.li>{"\n"}<_components.li><_components.strong>{"A pace target is ignored."}</_components.strong>{" It is not in "}<_components.code>{"mm:ss"}</_components.code>{" format → write it like "}<_components.code>{"2:00"}</_components.code>{", then pick "}<_components.code>{"/500 m"}</_components.code>{" or "}<_components.code>{"/km"}</_components.code>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"An \"RPE 9\" load does not fit in the Charge field."}</_components.strong>{" That field only takes numbers → write it in "}<_components.strong>{"Charge libre"}</_components.strong>{"."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
