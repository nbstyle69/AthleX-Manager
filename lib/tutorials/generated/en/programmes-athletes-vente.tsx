/* eslint-disable */
// @ts-nocheck
// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
/*@jsxRuntime automatic*/
/*@jsxImportSource react*/
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
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Marketplace → Programmes athlètes"}</_components.strong>{" ("}<_components.code>{"/programming/athletes"}</_components.code>{") gathers the coaching programs you sell to your athletes. Gym access plans (subscription, drop-in, pack, trial) and promo codes now live in "}<_components.strong>{"Formules"}</_components.strong>{" — see « Formules d'accès à la salle ». To take payments online, payments must be enabled in "}<_components.strong>{"Réglages → Paiements"}</_components.strong>{"."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Open "}<_components.strong>{"Marketplace → Programmes athlètes"}</_components.strong>{". If the page invites you to enable payments in order to sell your programs, do that from "}<_components.strong>{"Réglages → Paiements"}</_components.strong>{": without it you can only grant access by hand. "}<Screenshot src="/tutorials/programmes-athletes-vente/1.png" alt="Programmes athlètes tab of Marketplace" /></_components.li>{"\n"}<_components.li>{"Click "}<_components.strong>{"Créer un programme"}</_components.strong>{": the "}<_components.strong>{"Nouveau programme"}</_components.strong>{" dialog asks for a "}<_components.strong>{"Titre"}</_components.strong>{", a "}<_components.strong>{"Description"}</_components.strong>{" and a "}<_components.strong>{"Prix (€)"}</_components.strong>{". "}<Screenshot src="/tutorials/programmes-athletes-vente/2.png" alt="Nouveau programme dialog: title, description, price, program type, duration" /></_components.li>{"\n"}<_components.li>{"Choose the "}<_components.strong>{"Type de programme"}</_components.strong>{": "}<_components.strong>{"Programme fixe"}</_components.strong>{" (« Durée définie (6, 8, 12 sem.) »), which opens "}<_components.strong>{"Durée (semaines)"}</_components.strong>{" and "}<_components.strong>{"Jours / semaine"}</_components.strong>{", or "}<_components.strong>{"Ongoing"}</_components.strong>{" (« Programme continu »), with no end date. Those fields sit in the same dialog as step 2."}</_components.li>{"\n"}<_components.li>{"Tick "}<_components.strong>{"Actif (visible pour les athlètes)"}</_components.strong>{" when the offer is ready, then "}<_components.strong>{"Créer le programme"}</_components.strong>{": that box is what makes it appear on your public page."}</_components.li>{"\n"}<_components.li>{"Use "}<_components.strong>{"Donner l'accès à un membre"}</_components.strong>{" on the program card to grant access without an online payment. "}<_components.strong>{"Promo codes"}</_components.strong>{" are managed in "}<_components.strong>{"Formules"}</_components.strong>{"."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"The offer does not appear on the athlete side."}</_components.strong>{" It is not ticked as active and visible → tick the box and reload the public page."}</_components.li>{"\n"}<_components.li><_components.strong>{"Payment fails, or the button is missing."}</_components.strong>{" Payments are not enabled for the box → finish the setup in "}<_components.strong>{"Réglages → Paiements"}</_components.strong>{", then try again."}</_components.li>{"\n"}<_components.li><_components.strong>{"A promo code has no effect."}</_components.strong>{" It has expired, or its discount duration is over → check the expiry date in "}<_components.strong>{"Formules → Codes promo"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"A member paid but has no content."}</_components.strong>{" The program sold has no sessions yet → fill it in, or grant access to a complete program."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="programs" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
