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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"A group gathers members (a level, a time slot, a specific follow-up). It is used as a WOD audience and as a filter in the member list. Groups are managed under "}<_components.strong>{"Groupes"}</_components.strong>{"."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open "}<_components.strong>{"Groupes"}</_components.strong>{" and create a new group: give it a name a busy coach will understand (\"Competitors\", \"Lunch\", \"Beginners\"). "}<Screenshot src="/tutorials/groupes-de-membres/1.png" alt="Box group list" /></_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Créer et ajouter des membres"}</_components.strong>{" (create and add members): the group detail opens. In "}<_components.strong>{"Ajouter des membres"}</_components.strong>{", click "}<_components.strong>{"Ajouter"}</_components.strong>{" next to each member; the search (by username) and the "}<_components.strong>{"Filtres"}</_components.strong>{" cover the active members of the box. "}<Screenshot src="/tutorials/groupes-de-membres/3.png" alt="Add members block of a group detail" /></_components.li>{"\n"}<_components.li>{"Go to "}<_components.strong>{"Membres"}</_components.strong>{" to check the result: click "}<_components.strong>{"Filtres"}</_components.strong>{", then pick the group in the "}<_components.strong>{"Tous les groupes"}</_components.strong>{" list to display only that group. "}<Screenshot src="/tutorials/groupes-de-membres/2.png" alt="Members page and its group filter" /></_components.li>{"\n"}<_components.li>{"Then use the group as an audience: in a WOD, choose "}<_components.strong>{"Ces groupes"}</_components.strong>{" and tick it."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"Ces groupes\" is greyed out in a WOD"}</_components.strong>{" (tooltip \"Aucun groupe dans cette box\"). No group exists yet → create one under "}<_components.strong>{"Groupes"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member does not receive the group's WODs."}</_components.strong>{" They were never added to the group, or their account is no longer active → in "}<_components.strong>{"Membres"}</_components.strong>{", check their "}<_components.strong>{"Groupes"}</_components.strong>{" and "}<_components.strong>{"Statut"}</_components.strong>{" columns."}</_components.li>{"\n"}<_components.li><_components.strong>{"A deleted group makes its WODs visible to the whole box."}</_components.strong>{" The confirmation says so: « Les WOD réservés à ce seul groupe deviendront visibles par tous les membres de la box. » → before deleting, reopen those WODs and pick another audience."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="groups" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
