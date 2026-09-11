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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Horaires & Créneaux"}</_components.strong>{" holds the bookable classes of the box, day by day. Recurring weekly grids live next door, in the schedule templates page."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open "}<_components.strong>{"Horaires & Créneaux"}</_components.strong>{" and move to the day you need."}</_components.li>{"\n"}<_components.li>{"Add a class and fill it in: "}<_components.strong>{"Type de cours"}</_components.strong>{" (class type) or a custom name, start time, duration, "}<_components.strong>{"Capacité"}</_components.strong>{" and an optional description. "}<Screenshot src="/tutorials/creneaux-et-reservations/1.png" alt="Class creation form" /></_components.li>{"\n"}<_components.li>{"Assign a coach (optional): they appear on the athlete side and it helps your coaches find their classes."}</_components.li>{"\n"}<_components.li>{"Save: the class becomes bookable by members, up to its capacity."}</_components.li>{"\n"}<_components.li>{"On the day, open the class and click "}<_components.strong>{"Faire l'appel"}</_components.strong>{" to see who booked and mark attendance. You can also add a member by hand if somebody shows up without a booking."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"Aucun coach assigné à cette box.\" (no coach in this box)."}</_components.strong>{" No coach is registered in the settings → add one, then come back and assign the class."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member cannot book."}</_components.strong>{" Capacity is full, or the class is in the past → raise the capacity or open a second class."}</_components.li>{"\n"}<_components.li><_components.strong>{"\"Aucun inscrit pour ce créneau\" although the class is full."}</_components.strong>{" You are looking at another day or another class of the same type → check the date shown at the top."}</_components.li>{"\n"}<_components.li><_components.strong>{"Next week's classes are missing."}</_components.strong>{" They are generated from the schedule templates → open that page to lay out the recurring grid."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="schedule" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
