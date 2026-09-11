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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"Every WOD carries an audience, set in the "}<_components.strong>{"Qui reçoit ce WOD ?"}</_components.strong>{" block of the editor. It is the only thing that decides what a member sees in the app."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"On the Whiteboard, open the WOD and scroll to "}<_components.strong>{"Qui reçoit ce WOD ?"}</_components.strong>{". "}<Screenshot src="/tutorials/visibilite-d-un-wod/1.png" alt="Audience block with its three options" /></_components.li>{"\n"}<_components.li>{"Pick "}<_components.strong>{"Toute la box"}</_components.strong>{" (whole box) for shared programming: every active member sees the session at the time you set."}</_components.li>{"\n"}<_components.li>{"Pick "}<_components.strong>{"Ces groupes"}</_components.strong>{" (these groups) and tick the groups for a session reserved to one level, time slot or program."}</_components.li>{"\n"}<_components.li>{"Keep "}<_components.strong>{"Personne encore"}</_components.strong>{" (nobody yet) for a draft: the session stays visible to you only, in the back-office."}</_components.li>{"\n"}<_components.li>{"Save. The Whiteboard card shows the chosen audience — check it at a glance before the class starts."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"My athletes see nothing although the WOD is there.\""}</_components.strong>{" The WOD is set to \"Personne encore\": no member ever sees it → change the audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"Weeks received from the Marketplace do not appear on the athlete side."}</_components.strong>{" Automatic placements arrive as \"Personne encore\" by design, so you decide who gets them → open each received session and set its audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member of the group still does not see the session."}</_components.strong>{" They are not in the ticked group, or are no longer an active member → check their member record."}</_components.li>{"\n"}<_components.li><_components.strong>{"The session shows up late."}</_components.strong>{" The WOD time is the publication time → move it earlier if athletes should have it in the morning."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
