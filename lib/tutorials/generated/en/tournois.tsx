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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Tournois"}</_components.strong>{" brings the box to life: one event, participants, a ranking. The page separates ongoing and upcoming tournaments from the history."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open "}<_components.strong>{"Tournois"}</_components.strong>{" and create a tournament. "}<Screenshot src="/tutorials/tournois/1.png" alt="Tournament list of the box" /></_components.li>{"\n"}<_components.li>{"Fill it in: name, date, level and format. The status shown in the list then follows the life cycle of the event."}</_components.li>{"\n"}<_components.li>{"Open the tournament to manage its participants: box members are added from its record."}</_components.li>{"\n"}<_components.li>{"On the day, enter the results from the tournament record: the ranking recomputes as you go."}</_components.li>{"\n"}<_components.li>{"Once finished, the tournament moves to the history and the performances stay visible to athletes."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"Aucun tournoi.\" (no tournament)."}</_components.strong>{" Nothing has been created in this box yet → create one."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member cannot be registered."}</_components.strong>{" They are not an active member of the box → check their member record."}</_components.li>{"\n"}<_components.li><_components.strong>{"The ranking looks frozen."}</_components.strong>{" Not all results are entered → complete the missing scores from the tournament record."}</_components.li>{"\n"}<_components.li><_components.strong>{"A past tournament clutters the list."}</_components.strong>{" It moves to the history once finished → change its status rather than deleting it, so performances are kept."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="tournaments" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
