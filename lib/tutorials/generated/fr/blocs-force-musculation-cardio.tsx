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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"L'éditeur de WOD contient trois zones : "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{" (le metcon), "}<_components.strong>{"Musculation"}</_components.strong>{" (optionnel) et "}<_components.strong>{"Cardio"}</_components.strong>{" (optionnel). Les deux blocs optionnels s'écrivent en séries, pas en reps libres."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre un WOD sur le Whiteboard et repère le bloc "}<_components.strong>{"Musculation (optionnel)"}</_components.strong>{". "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/3.png" alt="Blocs Musculation, Cardio et Time cap du formulaire WOD" /></_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Ajouter une série"}</_components.strong>{" puis remplis l'exercice, les séries, les reps et la "}<_components.strong>{"Charge"}</_components.strong>{" en "}<_components.strong>{"kg"}</_components.strong>{" ou en "}<_components.strong>{"%1RM"}</_components.strong>{" ; si la charge dépend du jour, écris-la dans "}<_components.strong>{"Charge libre"}</_components.strong>{" ("}<_components.code>{"RPE 9"}</_components.code>{"). Un "}<_components.strong>{"Tempo"}</_components.strong>{" ("}<_components.code>{"30X1"}</_components.code>{") et un "}<_components.strong>{"Repos"}</_components.strong>{" en secondes peuvent compléter la ligne. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/1.png" alt="Bloc Musculation avec une série, charge et tempo" /></_components.li>{"\n"}<_components.li>{"Descends sur le bloc "}<_components.strong>{"Cardio (optionnel)"}</_components.strong>{" et clique "}<_components.strong>{"Ajouter une série cardio"}</_components.strong>{" : choisis le mouvement (Row, SkiErg, Run…), le nombre de séries et la quantité en mètres, en calories ou en secondes. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/2.png" alt="Bloc Cardio (optionnel) avec une série Row" /></_components.li>{"\n"}<_components.li>{"Ajoute une cible d'intensité si tu en veux une : "}<_components.strong>{"Watts"}</_components.strong>{" ou "}<_components.strong>{"Allure"}</_components.strong>{", jamais les deux sur la même ligne. Le repos entre séries s'écrit en "}<_components.code>{"mm:ss"}</_components.code>{", et un "}<_components.strong>{"RPE"}</_components.strong>{" peut compléter la ligne. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/4.png" alt="Ligne cardio avec Watts, cible, repos et RPE" /></_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Créer le WOD"}</_components.strong>{" (ou "}<_components.strong>{"Enregistrer"}</_components.strong>{") : les trois blocs arrivent ensemble dans l'application de l'athlète, toujours dans cet ordre : Musculation, Cardio, puis le metcon."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Les séries de force ne créditent aucun badge."}</_components.strong>{" C'est le comportement attendu : les séries du bloc Musculation ne comptent pas de reps de badge, ce n'est pas du metcon → mets au metcon ce qui doit compter."}</_components.li>{"\n"}<_components.li><_components.strong>{"Une série cardio n'est pas créditée."}</_components.strong>{" Le bloc Cardio est crédité en "}<_components.code>{"séries × quantité"}</_components.code>{", mais une ligne sans exercice n'est pas enregistrée (« Choisis l’exercice pour enregistrer cette série. ») → choisis Row, SkiErg, Run… dans la liste."}</_components.li>{"\n"}<_components.li><_components.strong>{"Une cible d'allure est ignorée."}</_components.strong>{" Elle n'est pas au format "}<_components.code>{"mm:ss"}</_components.code>{" → écris-la comme "}<_components.code>{"2:00"}</_components.code>{", puis choisis "}<_components.code>{"/500 m"}</_components.code>{" ou "}<_components.code>{"/km"}</_components.code>{"."}</_components.li>{"\n"}<_components.li><_components.strong>{"La charge « RPE 9 » ne rentre pas dans le champ Charge."}</_components.strong>{" Ce champ n'accepte que des nombres → écris-la dans "}<_components.strong>{"Charge libre"}</_components.strong>{"."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
