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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"An athlete program is a follow-up sold or granted to a member: it holds sessions organised by week, independent from the box Whiteboard. The page is "}<_components.strong>{"Programmes athlètes"}</_components.strong>{"."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open "}<_components.strong>{"Programmes athlètes"}</_components.strong>{" and select the program to fill in (or create it first, see the selling tutorial)."}</_components.li>{"\n"}<_components.li>{"Open its session editor: weeks are numbered according to the program duration in weeks. "}<Screenshot src="/tutorials/programmes-athletes-seances/1.png" alt="Session editor of an athlete program" /></_components.li>{"\n"}<_components.li>{"Add a session to the week you want, then write its content like a WOD: catalogue movements, strength block, cardio block, coach notes."}</_components.li>{"\n"}<_components.li>{"You can start from a PDF: the import proposes the detected sessions and you review the preview before inserting."}</_components.li>{"\n"}<_components.li>{"Save. The athlete who has access to the program sees the sessions in their logbook, week by week."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"The athlete sees no session."}</_components.strong>{" The program has no saved sessions, or access was never granted → check both; access is granted from the athlete programs page."}</_components.li>{"\n"}<_components.li><_components.strong>{"Movements credit no badge."}</_components.strong>{" They were typed by hand instead of picked from the official list → edit the lines concerned."}</_components.li>{"\n"}<_components.li><_components.strong>{"A week is unreachable."}</_components.strong>{" The program duration is shorter than the number of weeks you want to write → increase the duration in weeks."}</_components.li>{"\n"}<_components.li><_components.strong>{"Program sessions end up on the Whiteboard."}</_components.strong>{" These are two separate spaces: an athlete program is never placed on the box Whiteboard → use a week template if you want to program it for everybody."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="programs" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
