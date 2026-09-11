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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"The WOD editor has three areas: "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{" (the metcon), "}<_components.strong>{"Musculation"}</_components.strong>{" (strength, optional) and "}<_components.strong>{"Cardio"}</_components.strong>{" (optional). Both optional blocks are written as sets, not as free reps."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open a WOD on the Whiteboard and find the "}<_components.strong>{"Musculation (optionnel)"}</_components.strong>{" block."}</_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Ajouter une série"}</_components.strong>{", then fill in the exercise, sets, reps and load — in kilos, as "}<_components.strong>{"%1RM"}</_components.strong>{", or as a free note such as "}<_components.code>{"RPE 9"}</_components.code>{" when the load depends on the day. A "}<_components.strong>{"Tempo"}</_components.strong>{" ("}<_components.code>{"30X1"}</_components.code>{") and a rest value can complete the line. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/1.png" alt="Strength block with one set, load and tempo" /></_components.li>{"\n"}<_components.li>{"Scroll to the "}<_components.strong>{"Cardio (optionnel)"}</_components.strong>{" block and click "}<_components.strong>{"Ajouter une série cardio"}</_components.strong>{": pick the movement (Row, SkiErg, Run and so on), the number of sets and the quantity in metres or calories."}</_components.li>{"\n"}<_components.li>{"Add an intensity target if you want one: watts "}<_components.strong>{"or"}</_components.strong>{" pace, never both on the same line. Rest between sets is written as "}<_components.code>{"mm:ss"}</_components.code>{"."}</_components.li>{"\n"}<_components.li>{"Publish the WOD: the three blocks reach the athlete app together, in the order you wrote them."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Strength sets credit no badge."}</_components.strong>{" That is the expected behaviour: sets in the strength block do not count badge reps, they are not metcon → put whatever must count in the metcon."}</_components.li>{"\n"}<_components.li><_components.strong>{"A cardio set is not credited."}</_components.strong>{" The cardio block "}<_components.em>{"is"}</_components.em>{" credited, as "}<_components.code>{"sets × quantity"}</_components.code>{", but only when the movement comes from the catalogue → pick Row, SkiErg, Run and so on from the list."}</_components.li>{"\n"}<_components.li><_components.strong>{"A pace target is ignored."}</_components.strong>{" Both watts and a pace were entered on the same line → keep only one of them."}</_components.li>{"\n"}<_components.li><_components.strong>{"An \"RPE 9\" load disappears from the kilos field."}</_components.strong>{" A non-numeric load is not a weight: it belongs in the load note → use the free note field."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
