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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Programmes athlètes"}</_components.strong>{" gathers what you offer your members: coaching programs, subscription plans, drop-ins. To take payments online, payments must be enabled for the box; the platform commission is displayed on the page."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open "}<_components.strong>{"Programmes athlètes"}</_components.strong>{". If the page invites you to enable payments in order to sell your programs, do that first: without it you can only grant access by hand."}</_components.li>{"\n"}<_components.li>{"Create your offer and choose its nature: a fixed-duration coaching program, a monthly subscription, or a drop-in."}</_components.li>{"\n"}<_components.li>{"Fill in the price, the duration in weeks or the commitment depending on the case, the description, and the terms shown to the visitor before payment. "}<Screenshot src="/tutorials/programmes-athletes-vente/1.png" alt="Offer form: price, duration, terms" /></_components.li>{"\n"}<_components.li>{"Tick "}<_components.strong>{"Actif (visible pour les athlètes)"}</_components.strong>{" when the offer is ready: that is what makes it appear on your public page."}</_components.li>{"\n"}<_components.li>{"Optionally add a promo code (discount, and discount duration for subscriptions), or use "}<_components.strong>{"Donner l'accès à un membre"}</_components.strong>{" to grant a program without an online payment."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"The offer does not appear on the athlete side."}</_components.strong>{" It is not ticked as active and visible → tick the box and reload the public page."}</_components.li>{"\n"}<_components.li><_components.strong>{"Payment fails, or the button is missing."}</_components.strong>{" Payments are not enabled for the box → enable them from the page, then try again."}</_components.li>{"\n"}<_components.li><_components.strong>{"A promo code has no effect."}</_components.strong>{" It has expired, or its discount duration is over → check the expiry date shown in the promo codes section."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member paid but has no content."}</_components.strong>{" The program sold has no sessions yet → fill it in, or grant access to a complete program."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="programs" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
