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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"Every WOD carries an audience, set in the "}<_components.strong>{"Qui reçoit ce WOD ?"}</_components.strong>{" block of the editor. It decides which box members see the session, provided the WOD is published."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"On the Whiteboard, open the WOD with its pencil ("}<_components.strong>{"Modifier"}</_components.strong>{"): "}<_components.strong>{"Qui reçoit ce WOD ?"}</_components.strong>{" is at the very top of the dialog. "}<Screenshot src="/tutorials/visibilite-d-un-wod/1.png" alt="Audience block with its three options" /></_components.li>{"\n"}<_components.li>{"Pick "}<_components.strong>{"Toute la box"}</_components.strong>{" (whole box) for shared programming: every active member sees the session as soon as it is published, or at the time chosen with "}<_components.strong>{"Programmer"}</_components.strong>{". "}<Screenshot src="/tutorials/visibilite-d-un-wod/4.png" alt="Toute la box audience selected" /></_components.li>{"\n"}<_components.li>{"Pick "}<_components.strong>{"Ces groupes"}</_components.strong>{" (these groups) and tick the groups for a session reserved to one level, time slot or program. "}<Screenshot src="/tutorials/visibilite-d-un-wod/2.png" alt="Audience selector with Ces groupes (these groups) selected and one group ticked" /></_components.li>{"\n"}<_components.li>{"Pick "}<_components.strong>{"Personne encore"}</_components.strong>{" (nobody yet) to keep the session in reserve: no box member sees it in the app (except members of a program ticked under "}<_components.strong>{"Mes programmes athlètes"}</_components.strong>{"), and it stays visible in the back-office to the owner and the coaches. "}<Screenshot src="/tutorials/visibilite-d-un-wod/3.png" alt="Personne encore audience selected" /></_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Enregistrer"}</_components.strong>{" (or "}<_components.strong>{"Créer le WOD"}</_components.strong>{"). The Whiteboard card shows the chosen audience (\"Visible par toute la box\", \"Visible par personne\" or the group names): check it at a glance before the class starts. "}<Screenshot src="/tutorials/visibilite-d-un-wod/5.png" alt="Whiteboard cards with the Visible par toute la box, group and Visible par personne badges" /></_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"My athletes see nothing although the WOD is there.\""}</_components.strong>{" The WOD is set to \"Personne encore\" (\"Visible par personne\" badge), or "}<_components.strong>{"Publier"}</_components.strong>{" is off ("}<_components.strong>{"Brouillon"}</_components.strong>{" badge) → change the audience or turn "}<_components.strong>{"Publier"}</_components.strong>{" on."}</_components.li>{"\n"}<_components.li><_components.strong>{"Weeks received from the Marketplace do not appear on the athlete side."}</_components.strong>{" As long as you have not placed a week by hand, automatic placements arrive as \"Personne encore\" → open "}<_components.strong>{"Programmation"}</_components.strong>{" and place the week choosing who sees it ("}<_components.strong>{"Remplacer les WOD vierges"}</_components.strong>{" if it is already placed): that choice becomes the one for the next automatic placements."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member of the group still does not see the session."}</_components.strong>{" They are not in the ticked group, or are no longer an active member → check their member record in Membres (owner)."}</_components.li>{"\n"}<_components.li><_components.strong>{"The session shows up late."}</_components.strong>{" The WOD is set to "}<_components.strong>{"Programmer"}</_components.strong>{": the chosen "}<_components.strong>{"Heure"}</_components.strong>{" is the publication time → move it earlier, or pick "}<_components.strong>{"Maintenant"}</_components.strong>{"."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
