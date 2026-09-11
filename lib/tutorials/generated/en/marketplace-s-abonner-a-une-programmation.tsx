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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p>{"The "}<_components.strong>{"Marketplace"}</_components.strong>{" is the box-to-box channel: you buy or sell programmings there. What you receive lands on your Whiteboard."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open the "}<_components.strong>{"Marketplace"}</_components.strong>{", tab "}<_components.strong>{"Catalogue"}</_components.strong>{", and filter by discipline, level or "}<_components.strong>{"Gratuit"}</_components.strong>{" (free) to browse the offers published by other boxes. Each card shows the publishing box, the goal, the number of WODs and the duration. "}<Screenshot src="/tutorials/marketplace-s-abonner-a-une-programmation/1.png" alt="Marketplace catalogue with filters and one offer" /></_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Voir le détail"}</_components.strong>{" (see details): you get the goal, the target audience, the equipment, the WODs per week, the billing (monthly, one-off or free) and the day-by-day preview of week 1. "}<Screenshot src="/tutorials/marketplace-s-abonner-a-une-programmation/2.png" alt="Marketplace offer details with the week 1 preview" /></_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"S'abonner"}</_components.strong>{" (subscribe). The button becomes "}<_components.strong>{"Abonné"}</_components.strong>{" (subscribed) and the card shows the subscription settings. Your own offers are never offered for subscription."}</_components.li>{"\n"}<_components.li>{"Pick the "}<_components.strong>{"Couleur"}</_components.strong>{" (colour): it is what identifies the sessions of this programming on the Whiteboard. "}<Screenshot src="/tutorials/marketplace-s-abonner-a-une-programmation/3.png" alt="Subscribed offer with colour, automatic placement and unsubscribe link" /></_components.li>{"\n"}<_components.li>{"Decide how weeks are placed. Nothing is placed on its own until "}<_components.strong>{"Application automatique chaque semaine"}</_components.strong>{" is ticked; once ticked, the due week is placed by itself on Sunday at 18:00, week 1 on the first Sunday. Unticked, you place weeks whenever you want from the Whiteboard, using the "}<_components.strong>{"Programmation"}</_components.strong>{" button."}</_components.li>{"\n"}<_components.li>{"To stop, use "}<_components.strong>{"Se désabonner"}</_components.strong>{" (unsubscribe) on the same card: a confirmation offers to also remove the sessions already placed from next week on. The current week and the past are never deleted, so scores and ELO are kept."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Nothing arrives on the Whiteboard after subscribing."}</_components.strong>{" Automatic placement is unticked — that is the default → place the week from the Whiteboard, or tick the box."}</_components.li>{"\n"}<_components.li><_components.strong>{"Received sessions are seen by no member."}</_components.strong>{" Automatic placements arrive as \"Personne encore\" (nobody yet) → open them and set their audience."}</_components.li>{"\n"}<_components.li><_components.strong>{"A received session cannot be edited."}</_components.strong>{" The content of a Marketplace programming is not editable; you only choose who sees it, and you may move or delete it."}</_components.li>{"\n"}<_components.li><_components.strong>{"\"déjà abonnée\" (already subscribed)."}</_components.strong>{" Another of your boxes already subscribes to this offer → check the active box in the sidebar selector."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="marketplace" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
