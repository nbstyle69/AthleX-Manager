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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"The PDF import reads a programming document and proposes ready-to-insert sessions: on the "}<_components.strong>{"Whiteboard"}</_components.strong>{" for the box week, or (owner) in the session editor of an athlete program. The analysis is a proposal, never a direct save."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"On the Whiteboard, click "}<_components.strong>{"Importer"}</_components.strong>{" and choose your PDF. You can also drag it onto the page, which shows \"Lâche ton fichier pour l'importer\". "}<Screenshot src="/tutorials/importer-un-pdf-de-programmation/1.png" alt="Whiteboard toolbar with the Import button" /></_components.li>{"\n"}<_components.li>{"Wait for the analysis to finish. The preview screen lists every detected session with its movements, its "}<_components.strong>{"Musculation"}</_components.strong>{" block and its "}<_components.strong>{"Notes coach"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li>{"Review it card by card. Orange fields are out of catalogue and the card carries the \"Mouvement hors catalogue\" badge (movement out of catalogue): fix the name in the preview, then, after insertion, reopen the WOD, delete the line and add it again picking the exercise from the list, or knowingly keep the raw name. Untick a card to leave it out."}</_components.li>{"\n"}<_components.li>{"Under "}<_components.strong>{"Qui verra ces WOD"}</_components.strong>{", tick the target groups or programs; with nothing ticked, the WODs are visible to the whole box. For an athlete program, "}<_components.strong>{"Qui verra ces séances"}</_components.strong>{" is locked to the open program."}</_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Insérer N WOD"}</_components.strong>{". Sessions land on the dates shown on the cards, already published, and stay editable like any other WOD."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"PDF sans texte exploitable (scan ?)\" (no usable text)."}</_components.strong>{" The document is a scanned image → use a text PDF, or type the week in by hand."}</_components.li>{"\n"}<_components.li><_components.strong>{"\"Aucun WOD détecté dans ce PDF.\" (no WOD detected)."}</_components.strong>{" The layout is not recognised → pick another "}<_components.strong>{"Source"}</_components.strong>{" then "}<_components.strong>{"Ré-analyser"}</_components.strong>{", or type the week in by hand."}</_components.li>{"\n"}<_components.li><_components.strong>{"An RPE load is not in a weight field."}</_components.strong>{" It is not a kilo: it goes into "}<_components.strong>{"RPE / note"}</_components.strong>{" and the set is copied into the notes under \"Musculation (non structurée)\" ("}<_components.strong>{"Muscu non structurée"}</_components.strong>{" badge) → check it in the preview before inserting."}</_components.li>{"\n"}<_components.li><_components.strong>{"Some movements are highlighted in orange."}</_components.strong>{" They are out of catalogue and will be kept as is, so without badges → after insertion, reopen the WOD, delete those lines and add them again from the list."}</_components.li>{"\n"}<_components.li><_components.strong>{"Imported sessions are visible to nobody in the box."}</_components.strong>{" Only a "}<_components.strong>{"Programme"}</_components.strong>{" was ticked: the WOD is visible to its members only → reopen each WOD and pick groups, or "}<_components.strong>{"Toute la box"}</_components.strong>{" after unticking the program under "}<_components.strong>{"Mes programmes athlètes"}</_components.strong>{"."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
