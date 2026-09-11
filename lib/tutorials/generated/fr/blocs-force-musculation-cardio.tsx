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
  return <><_components.h2>{"Avant de commencer"}</_components.h2>{"\n"}<_components.p>{"L'éditeur de WOD contient trois zones : "}<_components.strong>{"Programme / Mouvements"}</_components.strong>{" (le metcon), "}<_components.strong>{"Musculation"}</_components.strong>{" (optionnel) et "}<_components.strong>{"Cardio"}</_components.strong>{" (optionnel). Les deux blocs optionnels s'écrivent en séries, pas en reps libres."}</_components.p>{"\n"}<_components.h2>{"Étapes"}</_components.h2>{"\n"}<_components.ol>{"\n"}<_components.li>{"Ouvre un WOD sur le Whiteboard et repère le bloc "}<_components.strong>{"Musculation (optionnel)"}</_components.strong>{"."}</_components.li>{"\n"}<_components.li>{"Clique "}<_components.strong>{"Ajouter une série"}</_components.strong>{" puis remplis l'exercice, les séries, les reps et la charge — en kilos, en "}<_components.strong>{"%1RM"}</_components.strong>{", ou en note libre du type "}<_components.code>{"RPE 9"}</_components.code>{" si la charge dépend du jour. Un "}<_components.strong>{"Tempo"}</_components.strong>{" ("}<_components.code>{"30X1"}</_components.code>{") et un "}<_components.strong>{"Repos"}</_components.strong>{" peuvent compléter la ligne. "}<Screenshot src="/tutorials/blocs-force-musculation-cardio/1.png" alt="Bloc Musculation avec une série, charge et tempo" /></_components.li>{"\n"}<_components.li>{"Descends sur le bloc "}<_components.strong>{"Cardio (optionnel)"}</_components.strong>{" et clique "}<_components.strong>{"Ajouter une série cardio"}</_components.strong>{" : choisis le mouvement (Row, SkiErg, Run…), le nombre de séries et la quantité en mètres ou en calories."}</_components.li>{"\n"}<_components.li>{"Ajoute une cible d'intensité si tu en veux une : "}<_components.strong>{"Watts"}</_components.strong>{" ou "}<_components.strong>{"Allure"}</_components.strong>{", jamais les deux sur la même ligne. Le repos entre séries s'écrit en "}<_components.code>{"mm:ss"}</_components.code>{"."}</_components.li>{"\n"}<_components.li>{"Publie le WOD : les trois blocs arrivent ensemble dans l'application de l'athlète, dans l'ordre où tu les as écrits."}</_components.li>{"\n"}</_components.ol>{"\n"}<_components.h2>{"Erreurs fréquentes"}</_components.h2>{"\n"}<_components.ul>{"\n"}<_components.li><_components.strong>{"Les séries de force ne créditent aucun badge."}</_components.strong>{" C'est le comportement attendu : les séries du bloc Musculation ne comptent pas de reps de badge, ce n'est pas du metcon → mets au metcon ce qui doit compter."}</_components.li>{"\n"}<_components.li><_components.strong>{"Une série cardio n'est pas créditée."}</_components.strong>{" Le bloc Cardio, lui, est bien crédité en "}<_components.code>{"séries × quantité"}</_components.code>{", mais seulement si le mouvement vient du catalogue → choisis Row, SkiErg, Run… dans la liste."}</_components.li>{"\n"}<_components.li><_components.strong>{"Une cible d'allure est ignorée."}</_components.strong>{" Des watts ET une allure ont été saisis sur la même ligne → n'en garde qu'un des deux."}</_components.li>{"\n"}<_components.li><_components.strong>{"La charge « RPE 9 » disparaît du champ kilos."}</_components.strong>{" Une charge non numérique n'est pas un poids : elle se saisit en note de charge → utilise le champ de note libre."}</_components.li>{"\n"}</_components.ul>{"\n"}<_components.h2>{"Y aller"}</_components.h2>{"\n"}<GoTo page="whiteboard" /></>;
}
export default function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
