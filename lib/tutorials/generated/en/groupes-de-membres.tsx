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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"A group gathers members (a level, a time slot, a specific follow-up). It is used as a WOD audience and as a filter in the member list. Groups are managed under "}<_components.strong>{"Groupes"}</_components.strong>{"."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open "}<_components.strong>{"Groupes"}</_components.strong>{" and create a new group: give it a name a busy coach will understand (\"Competitors\", \"Lunch\", \"Beginners\"). "}<Screenshot src="/tutorials/groupes-de-membres/1.png" alt="Box group list" /></_components.li>{"\n"}<_components.li>{"Save, then open the group to "}<_components.strong>{"Ajouter un membre"}</_components.strong>{" (add a member); the search covers the active members of the box."}</_components.li>{"\n"}<_components.li>{"Go to "}<_components.strong>{"Membres"}</_components.strong>{" to check the result: the group filter lets you display one group at a time."}</_components.li>{"\n"}<_components.li>{"Then use the group as an audience: in a WOD, choose "}<_components.strong>{"Ces groupes"}</_components.strong>{" and tick it."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"Aucun groupe. Crée des groupes de cours d'abord.\""}</_components.strong>{" The audience selector stays empty until a group exists → create one under Groupes."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member does not receive the group's WODs."}</_components.strong>{" They were never added to the group, or their account is no longer active → check their member record."}</_components.li>{"\n"}<_components.li><_components.strong>{"A deleted group leaves WODs with no audience."}</_components.strong>{" Sessions targeted at that group reach nobody → reopen them and pick another audience."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="groups" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
