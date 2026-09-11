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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"You have just created your box. The Dashboard is the back-office home page, and the sidebar groups sections by role (training, community, events, business). Allow five minutes for this setup. On-screen labels are in French, so they are quoted as they appear."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open the "}<_components.strong>{"Dashboard"}</_components.strong>{": the counters at the top (members, bookings, tournaments, unread messages) are shortcuts, not just numbers — clicking one opens the matching section. "}<Screenshot src="/tutorials/premiers-pas/1.png" alt="Dashboard with the box counters" /></_components.li>{"\n"}<_components.li>{"Go to "}<_components.strong>{"Réglages"}</_components.strong>{" (Settings) and fill in "}<_components.strong>{"Informations de la box"}</_components.strong>{": name, logo, banner. These are what your members and public page visitors see."}</_components.li>{"\n"}<_components.li>{"Still in "}<_components.strong>{"Réglages"}</_components.strong>{", add your "}<_components.strong>{"Coachs"}</_components.strong>{". A coach sees the Whiteboard, schedules, schedule templates, messages and the Help tab; a coach never sees prices or subscribers."}</_components.li>{"\n"}<_components.li>{"Copy the invitation code from the Dashboard and send it to your members: that is how they join the box in the athlete app."}</_components.li>{"\n"}<_components.li>{"Create your first groups (Groupes) if you program differently per time slot or level: groups are then used to target WODs."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"A coach says the athlete programs page is missing."}</_components.strong>{" That is intended: the page sets prices and is owner-only → use your own owner account."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member cannot find the box in the app."}</_components.strong>{" The invitation code was never sent, or was retyped with a typo → send it again from the Dashboard."}</_components.li>{"\n"}<_components.li><_components.strong>{"The logo does not show on the athlete side."}</_components.strong>{" The image was not saved in Réglages, or the upload failed → reload the page and check that the logo preview appears."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="dashboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
