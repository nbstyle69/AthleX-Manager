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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"A week template (\"semaine type\") is a frozen copy of a Whiteboard week, stored in your box so you can place it again whenever you want. It is internal: it is never sold and never exposed to anyone."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"On the Whiteboard, display the week you want to keep as a model."}</_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Enregistrer comme semaine type"}</_components.strong>{", give it a meaningful name (for example \"Hybrid week – volume\"), then confirm. "}<Screenshot src="/tutorials/semaines-types/1.png" alt="Save week as template dialog" /></_components.li>{"\n"}<_components.li>{"To place it again, go to the target week and open "}<_components.strong>{"Programmation"}</_components.strong>{": the dialog lists "}<_components.strong>{"Mes semaines types"}</_components.strong>{" (your templates) and the "}<_components.strong>{"Programmations Marketplace"}</_components.strong>{" your box subscribes to."}</_components.li>{"\n"}<_components.li>{"Pick the template, the target week, then the audience under "}<_components.strong>{"Qui voit ces WOD ?"}</_components.strong>{" — without that choice the placement is refused."}</_components.li>{"\n"}<_components.li>{"Apply. WODs are copied onto the days of the target week; sessions that already carry a score or a completion are never overwritten."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"I saved a week template but my Marketplace offer is still empty.\""}</_components.strong>{" \"Enregistrer comme semaine type\" does not populate an offer: "}<_components.strong>{"Copier vers une offre"}</_components.strong>{" (copy to an offer) is what copies a week into an offer week → use that button."}</_components.li>{"\n"}<_components.li><_components.strong>{"The Programmation dialog is empty."}</_components.strong>{" No template exists and the box has no subscription → save a week, or subscribe to an offer in the Marketplace."}</_components.li>{"\n"}<_components.li><_components.strong>{"The placed WODs are visible to nobody."}</_components.strong>{" The audience chosen at placement time was \"nobody yet\" → reopen the sessions and set their audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"Did deleting a template erase my weeks?"}</_components.strong>{" No: weeks already placed on the Whiteboard stay, only the model disappears."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
