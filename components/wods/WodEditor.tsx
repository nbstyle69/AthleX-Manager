'use client';

import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Plus, Trash2, X, Loader2, Video, Dumbbell, HeartPulse, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { CARDIO_UNITS } from '@/lib/movements';
import MovementUnitSelect from '@/components/wods/MovementUnitSelect';
import { useMovementCatalog } from '@/lib/useMovementCatalog';
import {
  EMPTY_MOVEMENT_ROW,
  MovementRow,
  movementRowShowsUnit,
  movementRowShowsWeight,
  movementRowsFromLines,
  serializeMovementRows,
  updateMovementRow,
} from '@/lib/wodMovementRows';
import {
  CardioEntry,
  CardioUnit,
  EMPTY_CARDIO_ENTRY,
  isCardioLine,
  parseCardioLine,
  serializeCardio,
  splitCardioLines,
} from '@/lib/cardioBlock';
import {
  EMPTY_STRENGTH_ENTRY,
  StrengthEntry,
  StrengthLoadUnit,
  isStrengthLine,
  parseStrengthLine,
  serializeStrength,
  splitStrengthLines,
} from '@/lib/strengthBlock';
import { BLOCKS, DAY_LABELS, WOD_TYPES, WodFormState } from '@/lib/wodFields';
import { softVar, textTint } from '@/lib/colorVars';
import { programColor } from '@/components/wods/RestrictionBadges';
import { RestDay, estJourRepos } from '@/lib/programContent';
import {
  AUDIENCES, AUDIENCE_LABEL, Audience, isoDow, offerWeekStorageKey, recapLine,
} from '@/lib/audience';

/**
 * Éditeur de WOD unique, deux contextes :
 *
 * - `whiteboard` : le WOD est posé sur le calendrier d'une box — date, bloc
 *   « Qui reçoit ce WOD ? » (audience explicite, programmes athlètes, copie
 *   dans une offre Marketplace), publication immédiate ou programmée.
 * - `programming` : le WOD est écrit dans une programmation vendue à d'autres
 *   boxs — semaine × jour, aucune notion d'accès ni de publication : l'accès se
 *   décide à l'application de la semaine par la box abonnée.
 * - `program` : la séance d'un programme athlète payant de la box — semaine ×
 *   jour relatifs au démarrage de l'athlète, programme verrouillé (chip non
 *   modifiable, pas de groupe : la visibilité est celle des acheteurs),
 *   publication oui/non sans heure (il n'y a pas de date).
 *
 * Le contenu (mouvements du catalogue officiel, bloc Musculation, type, block,
 * time cap, rounds, notes, vidéo, EMOM/Tabata, classement) est identique dans
 * les deux contextes.
 *
 * Les trois blocs vivent dans la même `description` mais dans trois formes
 * distinctes : « quantité d'abord » pour le metcon (crédité en badges, en reps
 * ou en m/cal pour le cardio), « nom d'abord » avec `—` pour la force (jamais
 * crédité, cf. `lib/strengthBlock.ts`) et avec `~` pour le cardio structuré
 * (crédité en m/cal, cf. `lib/cardioBlock.ts`). Les lignes de force puis de
 * cardio sont écrites en tête — la séance se lit force, cardio, puis metcon.
 */
export interface WodEditorGroup { id: string; name: string; color: string }
export interface WodEditorProgram { id: string; title: string; type: string }
export interface WodEditorOffer { id: string; title: string; weeksCount: number }

export type WodEditorMode = 'whiteboard' | 'programming' | 'program';

interface WodEditorProps {
  mode: WodEditorMode;
  heading: string;
  submitLabel: string;
  form: WodFormState;
  setForm: Dispatch<SetStateAction<WodFormState>>;
  movements: string[];
  setMovements: Dispatch<SetStateAction<string[]>>;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  /** Contexte Whiteboard : groupes de la box. */
  groups?: WodEditorGroup[];
  /** Contexte Whiteboard : programmes de la box. */
  programs?: WodEditorProgram[];
  /** Contextes Programmation et Programme : nombre de semaines proposées. */
  weeksCount?: number;
  /** Contexte Programme : le programme courant, seul destinataire possible. */
  lockedProgram?: WodEditorProgram;
  /** Contexte Programme : jours marqués « Repos » par le coach (par semaine). */
  restDays?: readonly RestDay[];
  /** Contexte Whiteboard : offres Marketplace de la box (absent = pas de ligne). */
  offers?: WodEditorOffer[];
}

const inp = 'w-full bg-ax-surface-secondary border border-ax-border rounded-ax-control px-4 py-3 text-sm text-ax-text placeholder:text-ax-text-muted focus:outline-none focus:border-ax-focus focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface disabled:cursor-not-allowed disabled:bg-ax-neutral-soft [html.light_&]:disabled:bg-ax-surface-secondary disabled:text-ax-text-muted aria-[invalid=true]:border-ax-danger transition-colors motion-reduce:transition-none';

export default function WodEditor({
  mode, heading, submitLabel, form, setForm, movements, setMovements,
  saving, error, onClose, onSubmit, groups = [], programs = [], weeksCount = 1,
  lockedProgram, restDays = [], offers = [],
}: WodEditorProps) {
  const isWhiteboard = mode === 'whiteboard';
  const isProgram = mode === 'program';

  // Les lignes de force sont éditées structurées ; `movements` ne reçoit que
  // leur sérialisation. Le tampon local garde une ligne vide affichable (que la
  // sérialisation, elle, refuse d'écrire).
  const [strengthRows, setStrengthRows] = useState<StrengthEntry[]>(
    () => splitStrengthLines(movements)
      .strength
      .map(l => parseStrengthLine(l))
      .filter((e): e is StrengthEntry => e !== null),
  );

  const [cardioRows, setCardioRows] = useState<CardioEntry[]>(
    () => splitCardioLines(movements)
      .cardio
      .map(l => parseCardioLine(l))
      .filter((e): e is CardioEntry => e !== null),
  );

  // Même principe pour le metcon : les lignes sont éditées structurées et
  // sérialisées à l'écriture seulement (cf. `lib/wodMovementRows.ts`).
  const [wodRows, setWodRows] = useState<MovementRow[]>(
    () => movementRowsFromLines(movements.filter(l => !isStrengthLine(l) && !isCardioLine(l))),
  );

  const commit = (wod: MovementRow[], strength: StrengthEntry[], cardio: CardioEntry[]) =>
    setMovements([
      ...strength.map(serializeStrength).filter(Boolean),
      ...cardio.map(serializeCardio).filter(Boolean),
      ...serializeMovementRows(wod),
    ]);

  const setWod = (rows: MovementRow[]) => {
    setWodRows(rows);
    commit(rows, strengthRows, cardioRows);
  };
  const addMovement = () => setWod([...wodRows, { ...EMPTY_MOVEMENT_ROW }]);
  const removeMovement = (i: number) => setWod(wodRows.filter((_, idx) => idx !== i));
  const patchMovement = (i: number, patch: Partial<MovementRow>) => setWod(updateMovementRow(wodRows, i, patch));

  const setStrength = (rows: StrengthEntry[]) => {
    setStrengthRows(rows);
    commit(wodRows, rows, cardioRows);
  };
  const addStrength = () => setStrength([...strengthRows, { ...EMPTY_STRENGTH_ENTRY }]);
  const removeStrength = (i: number) => setStrength(strengthRows.filter((_, idx) => idx !== i));
  const updateStrength = (i: number, patch: Partial<StrengthEntry>) =>
    setStrength(strengthRows.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const setCardio = (rows: CardioEntry[]) => {
    setCardioRows(rows);
    commit(wodRows, strengthRows, rows);
  };
  const addCardio = () => setCardio([...cardioRows, { ...EMPTY_CARDIO_ENTRY }]);
  const removeCardio = (i: number) => setCardio(cardioRows.filter((_, idx) => idx !== i));
  const updateCardio = (i: number, patch: Partial<CardioEntry>) =>
    setCardio(cardioRows.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const { catalog: movementCatalog } = useMovementCatalog();
  const cardioCatalog = movementCatalog.filter(mv => mv.unit === 'm' || mv.unit === 'cal');

  const audienceChosen = !isWhiteboard || form.audience !== '';
  const groupsChosen = !isWhiteboard || form.audience !== 'groups' || form.groupIds.length > 0;
  const canSubmit = !!form.title.trim() && !saving && (!isWhiteboard || !!form.date) && audienceChosen && groupsChosen;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ax-overlay backdrop-blur-ax-glass p-4">
      <div className="bg-ax-surface border border-ax-border rounded-ax-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-ax-border">
          <h2 className="text-lg font-black text-ax-text">{heading}</h2>
          <button onClick={onClose} className="p-1.5 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary hover:text-ax-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-ax-danger-soft border border-ax-danger rounded-ax-control px-4 py-3 text-sm text-ax-danger">{error}</div>
          )}

          {/* Qui reçoit ce WOD ? — Whiteboard uniquement (le mode `program`
              garde la visibilité des acheteurs, le mode `programming` n'a pas
              d'accès : la box abonnée le décide à l'application). */}
          {isWhiteboard && (
            <AudienceBlock
              form={form}
              setForm={setForm}
              groups={groups}
              programs={programs}
              offers={offers}
            />
          )}

          {/* Programme verrouillé — contexte Programme uniquement : la séance
              appartient au programme de la page, et à lui seul. */}
          {isProgram && lockedProgram && (
            <div data-testid="programme-verrouille">
              <label className="block text-xs font-semibold text-ax-text-secondary mb-2 uppercase tracking-wider">Programme</label>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ax-control text-xs font-bold border cursor-default"
                style={{
                  backgroundColor: softVar(programColor(lockedProgram.type), 0.145),
                  color: programColor(lockedProgram.type),
                  borderColor: softVar(programColor(lockedProgram.type), 0.31),
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: programColor(lockedProgram.type) }} />
                {lockedProgram.title}
              </span>
              <p className="text-[11px] text-ax-text-muted mt-1.5">Visible par les acheteurs de ce programme uniquement — pas de groupe, pas d&apos;autre programme.</p>
            </div>
          )}

          {isWhiteboard ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Date *</label>
                <input type="date" className={inp} value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Block</label>
                <select className={inp} value={form.block}
                  onChange={e => setForm(f => ({ ...f, block: e.target.value }))}>
                  <option value="" className="text-ax-text bg-ax-surface">— Aucun —</option>
                  {BLOCKS.map(b => <option key={b.value} value={b.value} className="text-ax-text bg-ax-surface">{b.label}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Semaine *</label>
                  <select className={inp} value={form.week}
                    onChange={e => setForm(f => ({ ...f, week: parseInt(e.target.value, 10) }))}>
                    {Array.from({ length: Math.max(1, weeksCount) }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w} className="text-ax-text bg-ax-surface">Semaine {w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Jour *</label>
                  <select className={inp} value={form.dayOfWeek}
                    onChange={e => setForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value, 10) }))}>
                    {DAY_LABELS.map((d, i) => (
                      <option key={d} value={i + 1} className="text-ax-text bg-ax-surface">
                        {d}{isProgram && estJourRepos(restDays, form.week, i + 1) ? ' — repos' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Block</label>
                <select className={inp} value={form.block}
                  onChange={e => setForm(f => ({ ...f, block: e.target.value }))}>
                  <option value="" className="text-ax-text bg-ax-surface">— Aucun —</option>
                  {BLOCKS.map(b => <option key={b.value} value={b.value} className="text-ax-text bg-ax-surface">{b.label}</option>)}
                </select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Type <span className="text-ax-text-muted normal-case tracking-normal">(optionnel)</span></label>
              <select className={inp} value={form.wod_type}
                onChange={e => setForm(f => ({ ...f, wod_type: e.target.value }))}>
                <option value="" className="text-ax-text bg-ax-surface">— Aucun —</option>
                {WOD_TYPES.map(t => <option key={t.value} value={t.value} className="text-ax-text bg-ax-surface">{t.label}</option>)}
              </select>
            </div>
          </div>

          {form.wod_type === 'emom' && (
            <div>
              <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Intervalle EMOM</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(v => {
                  const selected = parseInt(form.emomInterval) === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, emomInterval: String(v) }))}
                      className={`py-2 rounded-ax-control text-xs font-bold border transition-colors ${
                        selected
                          ? 'text-ax-purple'
                          : 'bg-ax-surface-secondary text-ax-text-secondary border-ax-border hover:text-ax-text hover:border-ax-input-border'
                      }`}
                      style={selected ? { backgroundColor: softVar('var(--ax-purple)', 0.145), borderColor: softVar('var(--ax-purple)', 0.6) } : undefined}
                    >
                      {v === 1 ? 'EMOM' : `E${v}MOM`}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-ax-text-muted mt-1.5">Un intervalle = {form.emomInterval} min entre chaque départ.</p>
            </div>
          )}

          {form.wod_type === 'tabata' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Travail (sec)</label>
                <input type="number" min={5} max={300} className={inp} value={form.tabataWork}
                  onChange={e => setForm(f => ({ ...f, tabataWork: e.target.value }))}
                  placeholder="20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Repos (sec)</label>
                <input type="number" min={0} max={300} className={inp} value={form.tabataRest}
                  onChange={e => setForm(f => ({ ...f, tabataRest: e.target.value }))}
                  placeholder="10" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Titre *</label>
            <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Fran, Cindy, Helen…" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ax-text-secondary uppercase tracking-wider">Programme / Mouvements</label>
              <button type="button" onClick={addMovement} className="text-xs text-ax-text font-semibold flex items-center gap-1 hover:opacity-80">
                <Plus size={12} /> Ajouter
              </button>
            </div>
            <datalist id="box-movement-catalog">
              {movementCatalog.map(mv => <option key={mv.name} value={mv.name} />)}
            </datalist>
            <div className="space-y-2">
              {wodRows.map((parsed, i) => {
                const showWeight = movementRowShowsWeight(parsed);
                const showUnit = movementRowShowsUnit(parsed);
                return (
                  <div key={i} className="flex flex-wrap gap-2 items-center">
                    {showUnit ? (
                      <>
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ax-text-secondary pointer-events-none">♂</span>
                          <input type="number" min={0} inputMode="numeric"
                            className={`${inp} !px-0 !pl-7 !pr-2 text-center`}
                            value={parsed.reps ?? ''}
                            onChange={e => patchMovement(i, { reps: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                            placeholder="H" aria-label="Quantité hommes" />
                        </div>
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ax-text-secondary pointer-events-none">♀</span>
                          <input type="number" min={0} inputMode="numeric"
                            className={`${inp} !px-0 !pl-7 !pr-2 text-center`}
                            value={parsed.repsWomen ?? ''}
                            onChange={e => patchMovement(i, { repsWomen: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                            placeholder="F" aria-label="Quantité femmes" />
                        </div>
                      </>
                    ) : (
                      <input type="number" min={0} inputMode="numeric"
                        className={`${inp} !w-24 shrink-0 text-center !px-2`}
                        value={parsed.reps ?? ''}
                        onChange={e => patchMovement(i, { reps: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                        placeholder="Reps" aria-label="Répétitions" />
                    )}
                    {/* Unité toujours visible : choix parmi les unités permises
                        (Row, SkiErg, Bike Erg : cal ou m), sinon l'unité fixe
                        en texte (« m » pour Run, « reps » pour Thruster). */}
                    <MovementUnitSelect
                      name={parsed.name}
                      unit={parsed.unit}
                      disabled={parsed.reps == null}
                      onChange={u => patchMovement(i, { unit: u })}
                      className={`${inp} !w-20 shrink-0 !px-2 disabled:opacity-50`} />
                    <input list="box-movement-catalog"
                      className={`${inp} flex-1 min-w-[14rem]`}
                      value={parsed.name}
                      onChange={e => patchMovement(i, { name: e.target.value })}
                      placeholder="Exercice (rechercher…)" aria-label="Exercice" />
                    {/* Sur mobile, les charges et la corbeille passent sur une seconde ligne
                        pour laisser la première au nom de l'exercice. */}
                    <div className={`flex gap-2 items-center ${showWeight ? 'basis-full sm:basis-auto' : ''}`}>
                      {showWeight && (
                        <>
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ax-text-secondary pointer-events-none">♂</span>
                            <input type="number" min={0} step={0.5} inputMode="decimal"
                              className={`${inp} !px-0 !pl-7 !pr-6 text-center`}
                              value={parsed.weightKg ?? ''}
                              onChange={e => patchMovement(i, { weightKg: e.target.value === '' ? null : parseFloat(e.target.value) })}
                              placeholder="H" aria-label="Charge hommes en kilos" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ax-text-muted pointer-events-none">kg</span>
                          </div>
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ax-text-secondary pointer-events-none">♀</span>
                            <input type="number" min={0} step={0.5} inputMode="decimal"
                              className={`${inp} !px-0 !pl-7 !pr-6 text-center`}
                              value={parsed.weightKgWomen ?? ''}
                              onChange={e => patchMovement(i, { weightKgWomen: e.target.value === '' ? null : parseFloat(e.target.value) })}
                              placeholder="F" aria-label="Charge femmes en kilos" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ax-text-muted pointer-events-none">kg</span>
                          </div>
                        </>
                      )}
                      <button type="button" onClick={() => removeMovement(i)} className="p-3 rounded-ax-control bg-ax-surface-secondary border border-ax-border text-ax-text-muted hover:text-ax-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {wodRows.length === 0 && (
                <button type="button" onClick={addMovement}
                  className="w-full py-3 rounded-ax-control border border-dashed border-ax-border text-xs text-ax-text-muted hover:border-ax-input-border hover:text-ax-text-secondary transition-colors">
                  + Ajouter un mouvement
                </button>
              )}
              <p className="text-[11px] text-ax-text-muted pt-1">
                Reps + exercice (liste officielle) + charges ♂ hommes / ♀ femmes : garantit le comptage des badges de mouvement des athlètes.
                Les exercices cardio (Row, Bike, SkiErg, Run…) se comptent en mètres ou calories, avec une quantité ♂/♀ séparée si besoin.
              </p>
            </div>
          </div>

          {/* Bloc Musculation — séries × reps × charge (kg ou %1RM) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ax-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Dumbbell size={13} /> Musculation <span className="text-ax-text-muted normal-case tracking-normal">(optionnel)</span>
              </label>
              <button type="button" onClick={addStrength} className="text-xs text-ax-text font-semibold flex items-center gap-1 hover:opacity-80">
                <Plus size={12} /> Ajouter une série
              </button>
            </div>
            <div className="space-y-2">
              {strengthRows.map((e, i) => (
                <div key={i} className="bg-ax-surface-secondary border border-ax-border rounded-ax-control p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <input list="box-movement-catalog"
                      className={`${inp} flex-1 min-w-0`}
                      value={e.name}
                      onChange={ev => updateStrength(i, { name: ev.target.value })}
                      placeholder="Exercice (rechercher…)" aria-label="Exercice de musculation" />
                    <button type="button" onClick={() => removeStrength(i)} className="p-3 rounded-ax-control bg-ax-surface-secondary border border-ax-border text-ax-text-muted hover:text-ax-danger transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input type="number" min={1} inputMode="numeric"
                      className={`${inp} !w-20 shrink-0 text-center !px-2`}
                      value={e.sets}
                      onChange={ev => updateStrength(i, { sets: parseInt(ev.target.value, 10) || 1 })}
                      placeholder="5" aria-label="Séries" />
                    <span className="text-ax-text-muted text-sm">×</span>
                    <input type="number" min={1} inputMode="numeric"
                      className={`${inp} !w-20 shrink-0 text-center !px-2`}
                      value={e.reps}
                      onChange={ev => updateStrength(i, { reps: parseInt(ev.target.value, 10) || 1 })}
                      placeholder="3" aria-label="Répétitions par série" />
                    <span className="text-ax-text-muted text-sm">@</span>
                    <input type="number" min={0} step={0.5} inputMode="decimal"
                      className={`${inp} !w-24 shrink-0 text-center !px-2`}
                      value={e.load ?? ''}
                      onChange={ev => updateStrength(i, { load: ev.target.value === '' ? null : parseFloat(ev.target.value) })}
                      placeholder="Charge" aria-label="Charge par série" />
                    <select className={`${inp} !w-24 shrink-0 !px-2`} value={e.unit}
                      onChange={ev => updateStrength(i, { unit: ev.target.value as StrengthLoadUnit })}
                      aria-label="Unité de charge">
                      <option value="kg" className="text-ax-text bg-ax-surface">kg</option>
                      <option value="%1RM" className="text-ax-text bg-ax-surface">%1RM</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input type="text"
                      className={`${inp} flex-1 min-w-[8rem]`}
                      value={e.restSec != null ? String(e.restSec) : ''}
                      onChange={ev => updateStrength(i, { restSec: ev.target.value === '' ? null : parseInt(ev.target.value, 10) || null })}
                      placeholder="Repos (sec)" aria-label="Repos entre séries en secondes" />
                    <input type="text"
                      className={`${inp} flex-1 min-w-[8rem]`}
                      value={e.tempo ?? ''}
                      onChange={ev => updateStrength(i, { tempo: ev.target.value || null })}
                      placeholder="Tempo (30X1)" aria-label="Tempo" />
                    <input type="text"
                      className={`${inp} flex-1 min-w-[14rem]`}
                      value={e.loadNote ?? ''}
                      onChange={ev => updateStrength(i, { loadNote: ev.target.value || null })}
                      placeholder="Charge libre (RPE 9, RM du jour…)" aria-label="Charge libre" />
                  </div>
                  <p className="text-[11px] text-ax-text-muted">{serializeStrength(e) || 'Nomme l’exercice pour enregistrer cette série.'}</p>
                </div>
              ))}
              {strengthRows.length === 0 && (
                <button type="button" onClick={addStrength}
                  className="w-full py-3 rounded-ax-control border border-dashed border-ax-border text-xs text-ax-text-muted hover:border-ax-input-border hover:text-ax-text-secondary transition-colors">
                  + Ajouter une série de musculation
                </button>
              )}
              <p className="text-[11px] text-ax-text-muted pt-1">
                Une charge en %1RM s’affiche en kilos chez l’athlète, calculée sur son propre 1RM.
                Ces séries ne comptent pas de reps de badge : ce n’est pas du metcon.
              </p>
            </div>
          </div>

          {/* Bloc Cardio — séries × quantité (m ou cal) × cible watts ou allure */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ax-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <HeartPulse size={13} /> Cardio <span className="text-ax-text-muted normal-case tracking-normal">(optionnel)</span>
              </label>
              <button type="button" onClick={addCardio} className="text-xs text-ax-text font-semibold flex items-center gap-1 hover:opacity-80">
                <Plus size={12} /> Ajouter une série cardio
              </button>
            </div>
            <div className="space-y-2">
              {cardioRows.map((e, i) => {
                const targetMode = e.pace ? 'pace' : 'watts';
                const paceRef = e.pace?.per ?? (/run|course/i.test(e.name) ? 'km' : '500 m');
                return (
                  <div key={i} className="bg-ax-surface-secondary border border-ax-border rounded-ax-control p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <select className={`${inp} flex-1 min-w-0`} value={e.name}
                        onChange={ev => {
                          const name = ev.target.value;
                          const cat = cardioCatalog.find(mv => mv.name === name);
                          updateCardio(i, { name, unit: (cat?.unit as CardioUnit | undefined) ?? e.unit });
                        }}
                        aria-label="Exercice cardio">
                        <option value="" className="text-ax-text bg-ax-surface">— Exercice —</option>
                        {cardioCatalog.map(mv => <option key={mv.name} value={mv.name} className="text-ax-text bg-ax-surface">{mv.name}</option>)}
                      </select>
                      <button type="button" onClick={() => removeCardio(i)} className="p-3 rounded-ax-control bg-ax-surface-secondary border border-ax-border text-ax-text-muted hover:text-ax-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <input type="number" min={1} inputMode="numeric"
                        className={`${inp} !w-20 shrink-0 text-center !px-2`}
                        value={e.sets}
                        onChange={ev => updateCardio(i, { sets: parseInt(ev.target.value, 10) || 1 })}
                        placeholder="2" aria-label="Séries cardio" />
                      <span className="text-ax-text-muted text-sm">×</span>
                      <input type="number" min={1} inputMode="numeric"
                        className={`${inp} !w-28 shrink-0 text-center !px-2`}
                        value={e.quantity}
                        onChange={ev => updateCardio(i, { quantity: parseInt(ev.target.value, 10) || 1 })}
                        placeholder="500" aria-label="Quantité par série" />
                      <select className={`${inp} !w-20 shrink-0 !px-2`} value={e.unit}
                        onChange={ev => updateCardio(i, { unit: ev.target.value as CardioUnit })}
                        aria-label="Unité cardio">
                        {CARDIO_UNITS.map(u => <option key={u.value} value={u.value} className="text-ax-text bg-ax-surface">{u.label}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select className={`${inp} !w-28 shrink-0 !px-2`} value={targetMode}
                        onChange={ev => (ev.target.value === 'pace'
                          ? updateCardio(i, { watts: null, pace: { mmss: '', per: paceRef } })
                          : updateCardio(i, { pace: null }))}
                        aria-label="Type de cible">
                        <option value="watts" className="text-ax-text bg-ax-surface">Watts</option>
                        <option value="pace" className="text-ax-text bg-ax-surface">Allure</option>
                      </select>
                      {targetMode === 'watts' ? (
                        <div className="relative flex-1 min-w-[8rem]">
                          <input type="number" min={0} inputMode="numeric"
                            className={`${inp} !pr-8`}
                            value={e.watts ?? ''}
                            onChange={ev => updateCardio(i, { watts: ev.target.value === '' ? null : parseInt(ev.target.value, 10) })}
                            placeholder="Cible (250)" aria-label="Cible en watts" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ax-text-muted pointer-events-none">W</span>
                        </div>
                      ) : (
                        <>
                          <input type="text" inputMode="numeric"
                            className={`${inp} flex-1 min-w-[8rem]`}
                            value={e.pace?.mmss ?? ''}
                            onChange={ev => updateCardio(i, { pace: { mmss: ev.target.value, per: paceRef } })}
                            placeholder="mm:ss (2:00)" aria-label="Allure cible" />
                          <select className={`${inp} !w-24 shrink-0 !px-2`} value={paceRef}
                            onChange={ev => updateCardio(i, { pace: { mmss: e.pace?.mmss ?? '', per: ev.target.value as '500 m' | 'km' } })}
                            aria-label="Référence d’allure">
                            <option value="500 m" className="text-ax-text bg-ax-surface">/500 m</option>
                            <option value="km" className="text-ax-text bg-ax-surface">/km</option>
                          </select>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <input type="text"
                        className={`${inp} flex-1 min-w-[8rem]`}
                        value={e.restSec != null ? `${Math.floor(e.restSec / 60)}:${String(e.restSec % 60).padStart(2, '0')}` : ''}
                        onChange={ev => {
                          const raw = ev.target.value.trim();
                          const mmss = raw.match(/^(\d+):(\d{1,2})$/);
                          const sec = raw.match(/^(\d+)$/);
                          updateCardio(i, {
                            restSec: mmss ? parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10) : sec ? parseInt(sec[1], 10) : null,
                          });
                        }}
                        placeholder="Repos (mm:ss)" aria-label="Repos entre séries cardio" />
                      <input type="text"
                        className={`${inp} flex-1 min-w-[8rem]`}
                        value={e.rpe ?? ''}
                        onChange={ev => updateCardio(i, { rpe: ev.target.value || null })}
                        placeholder="RPE (6)" aria-label="RPE" />
                    </div>
                    <p className="text-[11px] text-ax-text-muted">{serializeCardio(e) || 'Choisis l’exercice pour enregistrer cette série.'}</p>
                  </div>
                );
              })}
              {cardioRows.length === 0 && (
                <button type="button" onClick={addCardio}
                  className="w-full py-3 rounded-ax-control border border-dashed border-ax-border text-xs text-ax-text-muted hover:border-ax-input-border hover:text-ax-text-secondary transition-colors">
                  + Ajouter une série cardio
                </button>
              )}
              <p className="text-[11px] text-ax-text-muted pt-1">
                Les mètres et calories de ces séries comptent dans les badges cardio de l’athlète.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Time Cap (mm:ss)</label>
              <input type="text" inputMode="numeric" className={inp} value={form.timeCap}
                onChange={e => setForm(f => ({ ...f, timeCap: e.target.value }))} placeholder="12:30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Rounds <span className="text-ax-text-muted normal-case tracking-normal">(optionnel)</span></label>
              <input type="number" className={inp} value={form.rounds}
                onChange={e => setForm(f => ({ ...f, rounds: e.target.value }))} placeholder="—" min="0" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Notes Coach</label>
            <textarea rows={3} className={`${inp} resize-none min-h-[6rem] [field-sizing:content]`} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Conseils, scaling options…" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><Video size={13} className="text-ax-danger" /> Vidéo YouTube <span className="text-ax-text-muted normal-case tracking-normal">(optionnel)</span></label>
            <input className={inp} value={form.videoUrl}
              onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..." />
          </div>

          {/* Publication — Whiteboard et Programme : une programmation vendue
              n'a pas de date de publication, elle est révélée à l'application
              par la box. L'heure programmée n'existe que datée (Whiteboard). */}
          {(isWhiteboard || isProgram) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-ax-surface-secondary rounded-ax-control px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ax-text">Publier</p>
                  <p className="text-xs text-ax-text-muted">{isProgram ? 'Visible par les acheteurs du programme' : 'Visible par les athlètes de la box'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.published ? 'bg-ax-success' : 'bg-ax-hover'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-ax-text shadow transition-transform ${form.published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          )}
          {isWhiteboard && form.published && (
            <div className="bg-ax-surface-secondary rounded-ax-control px-4 py-3 space-y-3">
              <div className="flex gap-2">
                {(['now', 'scheduled'] as const).map(mode2 => (
                  <button key={mode2} type="button"
                    onClick={() => setForm(f => ({ ...f, publishMode: mode2 }))}
                    className={`flex-1 py-2 rounded-ax-control text-xs font-bold transition-colors ${form.publishMode === mode2 ? 'bg-ax-accent-soft text-ax-text border border-ax-input-border' : 'bg-ax-surface-secondary text-ax-text-secondary border border-ax-border hover:text-ax-text'}`}>
                    {mode2 === 'now' ? 'Maintenant' : 'Programmer'}
                  </button>
                ))}
              </div>
              {form.publishMode === 'scheduled' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ax-text-muted">Heure :</span>
                  <input type="number" min={0} max={23} value={form.publishHour}
                    onChange={e => setForm(f => ({ ...f, publishHour: e.target.value }))}
                    className="w-14 bg-ax-surface border border-ax-border rounded-ax-control px-2 py-1.5 text-xs text-ax-text text-center focus:outline-none focus:border-ax-focus" />
                  <span className="text-ax-text-muted font-bold">:</span>
                  <input type="number" min={0} max={59} value={form.publishMin}
                    onChange={e => setForm(f => ({ ...f, publishMin: e.target.value }))}
                    className="w-14 bg-ax-surface border border-ax-border rounded-ax-control px-2 py-1.5 text-xs text-ax-text text-center focus:outline-none focus:border-ax-focus" />
                  <span className="text-[10px] text-ax-text-muted ml-1">Le WOD sera visible à cette heure le jour programmé</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between bg-ax-surface-secondary rounded-ax-control px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ax-text">Classement</p>
              <p className="text-xs text-ax-text-muted">{form.leaderboard ? 'Les scores sont classés entre membres' : 'Scores enregistrés en historique uniquement'}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, leaderboard: !f.leaderboard }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.leaderboard ? 'bg-ax-text' : 'bg-ax-hover'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-ax-text shadow transition-transform ${form.leaderboard ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {isProgram && (
            <p className="text-[11px] text-ax-text-muted">
              Une séance de programme n&apos;a pas de date : chaque acheteur la reçoit la semaine {form.week},
              le {DAY_LABELS[form.dayOfWeek - 1] ?? ''}, comptés depuis son propre démarrage — en plus des WOD du Whiteboard de la box.
            </p>
          )}

          {mode === 'programming' && (
            <p className="text-[11px] text-ax-text-muted">
              Une programmation n&apos;a ni date ni accès : la box abonnée choisit la semaine
              calendaire et les groupes au moment où elle applique la semaine sur son Whiteboard.
            </p>
          )}

          {isWhiteboard && (
            <p
              data-testid="recap-visibilite"
              className={`text-xs rounded-ax-control px-3 py-2 border ${
                form.audience === ''
                  ? 'text-ax-warning bg-ax-warning-soft border-ax-warning'
                  : 'text-ax-text-secondary bg-ax-surface-secondary border-ax-border'
              }`}
            >
              {recapLine({
                audience: form.audience,
                groupNames: groups.filter(g => form.groupIds.includes(g.id)).map(g => g.name),
                programNames: programs.filter(p => form.programIds.includes(p.id)).map(p => p.title),
                offers: offers
                  .filter(o => form.offerWeeks[o.id] !== undefined)
                  .map(o => ({ title: o.title, week: form.offerWeeks[o.id] })),
              }) ?? 'Choisis qui voit ce WOD'}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-ax-control border border-ax-border text-sm text-ax-text-secondary hover:text-ax-text transition-colors">
              Annuler
            </button>
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-ax-control bg-ax-text hover:brightness-110 disabled:opacity-50 text-ax-background text-sm font-bold transition-colors"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const chip = (selected: boolean, color: string) => ({
  className: `flex items-center gap-1.5 px-3 py-1.5 rounded-ax-control text-xs font-bold transition-all border ${
    selected ? 'border-transparent scale-105' : 'border-ax-border text-ax-text-secondary hover:text-ax-text hover:border-ax-input-border'
  }`,
  style: selected ? { backgroundColor: softVar(color, 0.145), color: textTint(color), borderColor: softVar(color, 0.31) } : {},
});

function Tip({ text }: { text: string }) {
  return <Info size={12} className="text-ax-text-muted shrink-0 cursor-help" aria-label={text} />;
}

/**
 * « Qui reçoit ce WOD ? » — trois lignes, dans l'ordre où le coach y pense :
 * sa box (audience obligatoire, aucune valeur par défaut), ses programmes
 * athlètes (repliés, s'ajoutent à l'audience), ses offres Marketplace (copie
 * synchronisée dans une semaine d'offre, exige une date pour connaître le jour).
 */
function AudienceBlock({
  form, setForm, groups, programs, offers,
}: {
  form: WodFormState;
  setForm: Dispatch<SetStateAction<WodFormState>>;
  groups: WodEditorGroup[];
  programs: WodEditorProgram[];
  offers: WodEditorOffer[];
}) {
  const [programsOpen, setProgramsOpen] = useState(form.programIds.length > 0);
  const [offersOpen, setOffersOpen] = useState(Object.keys(form.offerWeeks).length > 0);

  useEffect(() => {
    if (form.programIds.length > 0) setProgramsOpen(true);
  }, [form.programIds.length]);

  const setAudience = (a: Audience) => setForm(f => ({
    ...f,
    audience: a,
    groupIds: a === 'groups' ? f.groupIds : [],
  }));

  const toggleOffer = (o: WodEditorOffer) => setForm(f => {
    const next = { ...f.offerWeeks };
    if (next[o.id] !== undefined) {
      delete next[o.id];
    } else {
      let week = 1;
      if (typeof window !== 'undefined') {
        const saved = parseInt(window.localStorage.getItem(offerWeekStorageKey(o.id)) ?? '', 10);
        if (saved >= 1 && saved <= o.weeksCount) week = saved;
      }
      next[o.id] = week;
    }
    return { ...f, offerWeeks: next };
  });

  const setOfferWeek = (o: WodEditorOffer, week: number) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(offerWeekStorageKey(o.id), String(week));
    setForm(f => ({ ...f, offerWeeks: { ...f.offerWeeks, [o.id]: week } }));
  };

  const selectedOffers = offers.filter(o => form.offerWeeks[o.id] !== undefined);
  const dayLabel = form.date ? DAY_LABELS[isoDow(form.date) - 1] : null;

  return (
    <div className="space-y-4 bg-ax-surface-secondary border border-ax-border rounded-ax-card p-4" data-testid="qui-recoit">
      <p className="text-xs font-semibold text-ax-text-secondary uppercase tracking-wider">Qui reçoit ce WOD ?</p>

      {/* 1. Dans ma box */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className="text-xs font-semibold text-ax-text-secondary">Dans ma box</label>
          <Tip text="Qui voit ce WOD dans le Whiteboard de la box. Sans choix, le WOD ne s'enregistre pas." />
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dans ma box">
          {AUDIENCES.map(a => {
            const selected = form.audience === a;
            const disabled = a === 'groups' && groups.length === 0;
            return (
              <button key={a} type="button" role="radio" aria-checked={selected} disabled={disabled}
                onClick={() => setAudience(a)}
                title={disabled ? 'Aucun groupe dans cette box' : undefined}
                className={`px-3 py-1.5 rounded-ax-control text-xs font-bold border transition-colors disabled:opacity-40 ${
                  selected ? 'bg-ax-text text-ax-background border-ax-text' : 'bg-ax-surface-secondary text-ax-text-secondary border-ax-border hover:text-ax-text'
                }`}>
                {AUDIENCE_LABEL[a]}
              </button>
            );
          })}
        </div>
        {form.audience === 'groups' && (
          <div className="flex flex-wrap gap-2 mt-2">
            {groups.map(g => {
              const selected = form.groupIds.includes(g.id);
              return (
                <button key={g.id} type="button" {...chip(selected, g.color)}
                  onClick={() => setForm(f => ({
                    ...f,
                    groupIds: selected ? f.groupIds.filter(id => id !== g.id) : [...f.groupIds, g.id],
                  }))}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.name}
                </button>
              );
            })}
            {form.groupIds.length === 0 && (
              <p className="text-[11px] text-ax-warning w-full">Coche au moins un groupe.</p>
            )}
          </div>
        )}
        {form.audience === 'none' && (
          <p className="text-[11px] text-ax-text-muted mt-1.5">Personne dans la box ne le voit pour l&apos;instant ; tu pourras l&apos;ouvrir plus tard.</p>
        )}
      </div>

      {/* 2. Mes programmes athlètes */}
      {programs.length > 0 && (
        <div>
          <button type="button" onClick={() => setProgramsOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold text-ax-text-secondary hover:text-ax-text">
            {programsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Mes programmes athlètes
            {form.programIds.length > 0 && <span className="text-ax-text-muted">({form.programIds.length})</span>}
          </button>
          {programsOpen && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-[11px] text-ax-text-muted">Les membres actifs de ces programmes reçoivent ce WOD en plus, quel que soit le choix ci-dessus.</p>
                <Tip text="S'ajoute à la visibilité dans la box : un WOD « Personne encore » reste visible par les membres du programme coché." />
              </div>
              <div className="flex flex-wrap gap-2">
                {programs.map(p => {
                  const selected = form.programIds.includes(p.id);
                  const pColor = programColor(p.type);
                  return (
                    <button key={p.id} type="button" {...chip(selected, pColor)}
                      onClick={() => setForm(f => ({
                        ...f,
                        programIds: selected ? f.programIds.filter(id => id !== p.id) : [...f.programIds, p.id],
                      }))}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pColor }} />
                      {p.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Mes offres Marketplace */}
      {offers.length > 0 && (
        <div>
          <button type="button" onClick={() => setOffersOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold text-ax-text-secondary hover:text-ax-text">
            {offersOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Mes offres Marketplace
            {selectedOffers.length > 0 && <span className="text-ax-text-muted">({selectedOffers.length})</span>}
          </button>
          {offersOpen && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] text-ax-text-muted">Copie ce WOD dans la semaine choisie de l&apos;offre ; le jour vient de la date. Tes modifications suivent, les box abonnées gardent ce qu&apos;elles ont déjà reçu.</p>
                <Tip text="La copie reste liée à ce WOD : titre, contenu et notes se mettent à jour dans l'offre. Décocher retire la copie." />
              </div>
              {!form.date && (
                <p className="text-[11px] text-ax-warning">Choisis d&apos;abord une date : la copie a besoin du jour de la semaine.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {offers.map(o => {
                  const selected = form.offerWeeks[o.id] !== undefined;
                  return (
                    <button key={o.id} type="button" {...chip(selected, 'var(--ax-info)')} disabled={!form.date}
                      onClick={() => toggleOffer(o)}>
                      {o.title}
                    </button>
                  );
                })}
              </div>
              {selectedOffers.map(o => (
                <div key={o.id} className="flex flex-wrap items-center gap-2 text-xs text-ax-text-secondary">
                  <span className="break-words min-w-0">{o.title}</span>
                  <select
                    value={form.offerWeeks[o.id]}
                    onChange={e => setOfferWeek(o, parseInt(e.target.value, 10))}
                    className="bg-ax-surface border border-ax-border rounded-ax-control px-2 py-1 text-xs text-ax-text"
                    aria-label={`Semaine dans ${o.title}`}
                  >
                    {Array.from({ length: Math.max(1, o.weeksCount) }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w} className="text-ax-text bg-ax-surface">Semaine {w}</option>
                    ))}
                  </select>
                  {dayLabel && <span className="text-ax-text-muted">· {dayLabel}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
