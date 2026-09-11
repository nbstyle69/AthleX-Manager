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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"Members join the box with the invitation code from the Dashboard. The "}<_components.strong>{"Membres"}</_components.strong>{" page then lists everybody, with search, filters and access to contracts."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open "}<_components.strong>{"Membres"}</_components.strong>{": the counter at the top shows how many records are displayed out of the total, and the search accepts a name or an email. "}<Screenshot src="/tutorials/membres-et-formules/1.png" alt="Member list with search and filters" /></_components.li>{"\n"}<_components.li>{"Narrow it down with the filters: by group, or by contract state, to find for instance members without a subscription."}</_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Contrats"}</_components.strong>{" to show the "}<_components.strong>{"Contrats / Abonnements"}</_components.strong>{" column: you see at a glance which plan each member holds and until when."}</_components.li>{"\n"}<_components.li>{"Open a member record for the detail: groups, ELO, history. This is also where you check that a member is active."}</_components.li>{"\n"}<_components.li>{"The plans themselves (price, duration, commitment) are created in the athlete programs page: the member list consumes them, it does not define them."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"A member is missing from the list."}</_components.strong>{" They have not joined the box with the invitation code yet → send them the code from the Dashboard."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member says they paid but has no contract."}</_components.strong>{" The payment happened outside AthleX, or the checkout never completed → check the contracts column and, if needed, grant access from the athlete programs page."}</_components.li>{"\n"}<_components.li><_components.strong>{"You cannot create a plan from the member list."}</_components.strong>{" That is expected: creating and editing plans lives in the athlete programs page → open it there."}</_components.li>{"\n"}<_components.li><_components.strong>{"A coach cannot see the member list."}</_components.strong>{" It is owner-only → sign in with the owner account."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="members" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
