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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"Publishing an offer means proposing your programming to other boxes. The "}<_components.strong>{"Mes offres"}</_components.strong>{" tab of the Marketplace holds your published and draft programmings."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open the "}<_components.strong>{"Marketplace"}</_components.strong>{", tab "}<_components.strong>{"Mes offres"}</_components.strong>{", and create a programming: title, description, goal, target audience, discipline, level, WODs per week and billing. "}<Screenshot src="/tutorials/marketplace-publier-une-offre/1.png" alt="My offers tab of the Marketplace" /></_components.li>{"\n"}<_components.li>{"Fill in its weeks. The fastest route: from the Whiteboard, display a week that worked and click "}<_components.strong>{"Copier vers une offre"}</_components.strong>{", then pick the offer and the week number."}</_components.li>{"\n"}<_components.li>{"Check the content week by week. The screen flags an offer whose week 1 is empty."}</_components.li>{"\n"}<_components.li>{"Click the publish control on the offer: it joins the "}<_components.strong>{"Catalogue"}</_components.strong>{" and becomes visible to other boxes."}</_components.li>{"\n"}<_components.li>{"If you run several boxes, you can also broadcast it to your own boxes, unticking those you want to exclude."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"\"Publication refusée\" (publishing refused)."}</_components.strong>{" An offer with no WOD cannot be published and never appears in the catalogue → fill at least week 1, then publish again."}</_components.li>{"\n"}<_components.li><_components.strong>{"\"I saved a week template and the offer stayed empty.\""}</_components.strong>{" A week template is internal to your box: it does not populate an offer → use "}<_components.strong>{"Copier vers une offre"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"Subscribed boxes do not see my correction."}</_components.strong>{" Copies are independent: editing an offer week does not rewrite what has already been received → warn your subscribers, or fix the next week."}</_components.li>{"\n"}<_components.li><_components.strong>{"My offer is missing from my own catalogue."}</_components.strong>{" That is intended: you cannot subscribe to your own offers → review it from the \"Mes offres\" tab."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="marketplace" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
