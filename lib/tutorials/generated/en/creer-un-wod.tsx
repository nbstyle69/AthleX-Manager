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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"The "}<_components.strong>{"Whiteboard"}</_components.strong>{" shows the current week, one column per day. A WOD belongs to a day and a publication time, so you can prepare it in advance without it being visible. On-screen labels are in French and quoted as they appear."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"On the Whiteboard, move to the right week with the arrows or "}<_components.strong>{"Aller à une date"}</_components.strong>{", then click "}<_components.strong>{"Nouveau WOD"}</_components.strong>{" (or click straight into an empty day cell). "}<Screenshot src="/tutorials/creer-un-wod/1.png" alt="Weekly Whiteboard with the new WOD button" /></_components.li>{"\n"}<_components.li>{"Fill in the header: "}<_components.strong>{"Titre"}</_components.strong>{" (for example \"Fran\", \"Hybrid intervals\"), "}<_components.strong>{"Date"}</_components.strong>{", "}<_components.strong>{"Heure"}</_components.strong>{", plus "}<_components.strong>{"Type"}</_components.strong>{" and "}<_components.strong>{"Block"}</_components.strong>{" if you use those markers. The time you enter is when the WOD becomes visible on the programmed day."}</_components.li>{"\n"}<_components.li>{"Under "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{", add one line per movement: reps, exercise picked from the official list, then men's and women's loads. Picking the exercise from the list is what guarantees your athletes' movement badges are counted."}</_components.li>{"\n"}<_components.li>{"Add session notes in "}<_components.strong>{"Notes Coach"}</_components.strong>{" (scaling, cues) and a demo "}<_components.strong>{"Vidéo YouTube"}</_components.strong>{" if useful. "}<Screenshot src="/tutorials/creer-un-wod/2.png" alt="WOD editor: title, movements and loads" /></_components.li>{"\n"}<_components.li>{"Pick the audience under "}<_components.strong>{"Qui reçoit ce WOD ?"}</_components.strong>{": the whole box, selected groups, or nobody yet."}</_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Publier"}</_components.strong>{". The WOD appears in the day cell; clicking the card reopens it for editing."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"The WOD exists but no athlete sees it."}</_components.strong>{" The audience is still \"Personne encore\" (nobody yet) → reopen the WOD and pick the whole box or the relevant groups."}</_components.li>{"\n"}<_components.li><_components.strong>{"Cannot save with \"Ces groupes\"."}</_components.strong>{" No group is ticked and the editor shows \"Coche au moins un groupe.\" → tick the groups, or switch back to the whole box."}</_components.li>{"\n"}<_components.li><_components.strong>{"Athlete badges do not move after the session."}</_components.strong>{" The movement was typed freely instead of picked from the list → edit the line and select the catalogue exercise."}</_components.li>{"\n"}<_components.li><_components.strong>{"The edit pencil on a card is inactive."}</_components.strong>{" That session comes from a Marketplace programming: its content cannot be edited, only its audience."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
