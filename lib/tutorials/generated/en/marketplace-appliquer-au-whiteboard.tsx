/* eslint-disable */
// @ts-nocheck
// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
/*@jsxRuntime automatic*/
/*@jsxImportSource react*/
/*TODO Nab: vérifier libellé — la spec parle du lundi suivant l'abonnement, l'écran Marketplace annonce le dimanche 18h*/
function _createMdxContent(props) {
  const _components = {
    code: "code",
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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"Once the box subscribes, the weeks of a programming are placed on the Whiteboard: automatically if you asked for it, otherwise by hand from the "}<_components.strong>{"Programmation"}</_components.strong>{" button."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"On the Whiteboard, click "}<_components.strong>{"Programmation"}</_components.strong>{". The dialog lists "}<_components.strong>{"Mes semaines types"}</_components.strong>{" (your week templates) then "}<_components.strong>{"Programmations Marketplace"}</_components.strong>{" with your active subscriptions (offer, publishing box, number of WODs and weeks). "}<Screenshot src="/tutorials/marketplace-appliquer-au-whiteboard/1.png" alt="Programmation dialog with a Marketplace subscription selected" /></_components.li>{"\n"}<_components.li>{"Select the subscription to place: it gets highlighted and the placement fields appear."}</_components.li>{"\n"}<_components.li>{"Pick the "}<_components.strong>{"Semaine source"}</_components.strong>{" (the programming week, with its number of WODs) and the "}<_components.strong>{"Semaine cible"}</_components.strong>{" (the Monday the sessions start from). The dialog restates the exact date used."}</_components.li>{"\n"}<_components.li>{"Pick the audience under "}<_components.strong>{"Qui voit ces WOD ?"}</_components.strong>{": "}<_components.strong>{"Toute la box"}</_components.strong>{" (whole box), "}<_components.strong>{"Ces groupes"}</_components.strong>{" (these groups) or "}<_components.strong>{"Personne encore"}</_components.strong>{" (nobody yet). That choice also becomes the default visibility of this subscription's automatic placement."}</_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Appliquer"}</_components.strong>{". Sessions land on the days of the target week, in the subscription colour; those that already carry a score or a completion are not replaced."}</_components.li>{"\n"}<_components.li>{"Then adjust card by card: the audience remains yours, and a received session can be moved or deleted individually."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Automatic weeks do not arrive when expected."}</_components.strong>{" With automatic placement, the due week is placed on Sunday at 18:00 for the week that follows; placing a week by hand realigns the anchor on what you have just done. "}{}</_components.li>{"\n"}<_components.li><_components.strong>{"A received session refuses to be edited."}</_components.strong>{" Its content belongs to the programming and is not editable. You can delete it, card by card, or change its audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"Nobody sees the placed sessions."}</_components.strong>{" The audience stayed on \"nobody yet\", which is the default for automatic placements → set the audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"The dialog offers no programming."}</_components.strong>{" "}<_components.code>{"Programmations Marketplace"}</_components.code>{" shows "}<_components.code>{"Aucun abonnement actif"}</_components.code>{" (no active subscription) → go through the Marketplace."}</_components.li>{"\n"}<_components.li><_components.strong>{"Placing a week template is not a Marketplace offer."}</_components.strong>{" The top of the dialog ("}<_components.code>{"Mes semaines types"}</_components.code>{") places your own templates; it creates neither a subscription nor a published offer."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
