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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"The PDF import reads a programming document and proposes ready-to-insert sessions: on the "}<_components.strong>{"Whiteboard"}</_components.strong>{" for the box week, or in the session editor of an athlete program. The analysis is a proposal, never a direct save."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"From the Whiteboard, open the import and drop your file — you can also drag it onto the page, which shows \"Lâche ton fichier pour l'importer\"."}</_components.li>{"\n"}<_components.li>{"Wait for the analysis to finish. The preview screen lists every detected session with its movements, its "}<_components.strong>{"Musculation"}</_components.strong>{" block and its "}<_components.strong>{"Notes coach"}</_components.strong>{". "}<Screenshot src="/tutorials/importer-un-pdf-de-programmation/1.png" alt="PDF import preview with the detected sessions" /></_components.li>{"\n"}<_components.li>{"Review it line by line. Highlighted fields carry the warning \"Mouvement hors catalogue\" (movement out of catalogue): fix them by picking the exercise from the list, or knowingly keep the raw name."}</_components.li>{"\n"}<_components.li>{"Pick the audience under "}<_components.strong>{"Qui verra ces WOD"}</_components.strong>{" (or "}<_components.strong>{"Qui verra ces séances"}</_components.strong>{" for an athlete program): the whole box, some groups, or nobody for now."}</_components.li>{"\n"}<_components.li>{"Confirm the insertion. Sessions land on the detected days and stay editable like any other WOD."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"Aucun WOD détecté dans ce PDF.\" (no WOD detected)."}</_components.strong>{" The document is a scanned image or a layout the analysis does not recognise → type the week in by hand, or use a text PDF."}</_components.li>{"\n"}<_components.li><_components.strong>{"RPE or percentage-of-RM loads vanished from the weight fields."}</_components.strong>{" A non-numeric load is not a kilo: it becomes a load note or coach notes → check it in the preview before inserting."}</_components.li>{"\n"}<_components.li><_components.strong>{"Some movements are highlighted in orange."}</_components.strong>{" They are out of catalogue and will be kept as is, so without badges → replace them with a list entry."}</_components.li>{"\n"}<_components.li><_components.strong>{"Imported sessions are visible to nobody."}</_components.strong>{" The audience chosen in the preview was \"nobody yet\" → reopen each session and set its audience."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
