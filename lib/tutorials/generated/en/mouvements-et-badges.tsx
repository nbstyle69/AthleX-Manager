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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"Athlete movement badges are computed from completed reps, movement by movement. The link is made through the official catalogue offered in the WOD editor, not from the text you type."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"In a WOD, go to a line of "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{" and start typing in the exercise field: the list filters as you type. "}<Screenshot src="/tutorials/mouvements-et-badges/1.png" alt="Searching a movement in the official list" /></_components.li>{"\n"}<_components.li>{"Select the suggested entry even if its name differs slightly from your habit — that choice is what links the line to the movement tracked by the app."}</_components.li>{"\n"}<_components.li>{"Enter the reps and the men's / women's loads: the badge is computed from reps, the loads serve the athlete and the ranking."}</_components.li>{"\n"}<_components.li>{"Repeat for every metcon line, then publish. After the session, the reps validated by athletes feed their badges with no further action from you."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"A hand-typed movement gives no badge."}</_components.strong>{" Out of catalogue, it is stored with its raw name and credits nothing → edit the line and take the list entry."}</_components.li>{"\n"}<_components.li><_components.strong>{"Strength block reps do not count."}</_components.strong>{" Strength sets are not metcon: they credit no badge, unlike the cardio block, which is credited as "}<_components.code>{"sets × quantity"}</_components.code>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"A movement is missing from the list."}</_components.strong>{" The catalogue is shared platform-wide and cannot be edited from the box → write it in plain text for the session and report it to AthleX so it can be added."}</_components.li>{"\n"}<_components.li><_components.strong>{"Two variants of the same movement give different counters."}</_components.strong>{" They are two distinct catalogue entries → keep the same entry from one session to the next."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
