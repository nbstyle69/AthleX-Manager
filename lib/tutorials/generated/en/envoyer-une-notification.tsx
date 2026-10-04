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
  }, {GoTo} = _components;
  if (!GoTo) _missingMdxReference("GoTo", true);
  return <><_components.h2>{"Before you start"}</_components.h2>{"\n"}<_components.p><_components.strong>{"Notifications"}</_components.strong>{" (Animation → Notifications) sends a notification to the phone of the box's active members. The page is reserved to the owner and the co-owners: a coach does not see it in the menu. A member only receives it if they turned notifications on in the app and are signed in on a phone."}</_components.p>{"\n"}<_components.h2>{"Steps"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Pick the "}<_components.strong>{"Destinataire"}</_components.strong>{" (recipient): "}<_components.strong>{"Tous les membres"}</_components.strong>{" (default, with the number of active members) or "}<_components.strong>{"Un membre"}</_components.strong>{" (one member)."}</_components.li>{"\n"}<_components.li>{"With "}<_components.strong>{"Un membre"}</_components.strong>{", type in "}<_components.strong>{"Rechercher ou choisir dans la liste"}</_components.strong>{": the list runs from A to Z, ignoring accents and capitals. Arrow keys move through the list, "}<_components.strong>{"Enter"}</_components.strong>{" picks, "}<_components.strong>{"Escape"}</_components.strong>{" closes it. The chosen member shows with "}<_components.strong>{"Changer"}</_components.strong>{" (change)."}</_components.li>{"\n"}<_components.li>{"Write the "}<_components.strong>{"Titre"}</_components.strong>{" (title, 80 characters max) and, if you like, a "}<_components.strong>{"Message"}</_components.strong>{" (300 characters max), then click "}<_components.strong>{"Envoyer"}</_components.strong>{" (send)."}</_components.li>{"\n"}<_components.li>{"The result shows under the button: « Envoyée à … appareils » (sent to … devices) in green, or « Non reçue » (not received) in orange if nobody could receive it."}</_components.li>{"\n"}<_components.li><_components.strong>{"Historique"}</_components.strong>{" (history) lists your last 20 notifications: date, title, recipient and result."}</_components.li>{"\n"}<_components.li>{"From "}<_components.strong>{"Membres"}</_components.strong>{", an active member's "}<_components.strong>{"Fiche"}</_components.strong>{" offers "}<_components.strong>{"Envoyer une notification"}</_components.strong>{": the page opens with that member already chosen."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Common mistakes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"« Non reçue »."}</_components.strong>{" The member did not turn notifications on or is not signed in on any phone → ask them to turn them on in the app."}</_components.li>{"\n"}<_components.li><_components.strong>{"The Envoyer button stays greyed out."}</_components.strong>{" The "}<_components.strong>{"Titre"}</_components.strong>{" is empty, or "}<_components.strong>{"Un membre"}</_components.strong>{" is selected with no member chosen."}</_components.li>{"\n"}<_components.li><_components.strong>{"« L’action n’a pas abouti »."}</_components.strong>{" The notification was not saved, or sending failed after it was saved → try again later."}</_components.li>{"\n"}<_components.li><_components.strong>{"« Membre retiré » in the history."}</_components.strong>{" The recipient is no longer an active member of the box."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Go there"}</_components.h2>{"\n"}<GoTo page="notifications" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
