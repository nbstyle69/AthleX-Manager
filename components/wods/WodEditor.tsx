'use client';

import { Dispatch, SetStateAction, useState } from 'react';
import { Plus, Trash2, X, Loader2, Video, Dumbbell, HeartPulse } from 'lucide-react';
import { CARDIO_UNITS, MOVEMENT_CATALOG, MovementUnit } from '@/lib/movements';
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
import { RestDay, estJourRepos } from '@/lib/programContent';

/**
 * Éditeur de WOD unique, deux contextes :
 *
 * - `whiteboard` : le WOD est posé sur le calendrier d'une box — date, groupes
 *   autorisés, programmes assignés, publication immédiate ou programmée.
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

/** « A », « A ou B », « A, B ou C ». */
function nomsJoints(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? '';
  return `${noms.slice(0, -1).join(', ')} ou ${noms[noms.length - 1]}`;
}

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
}

const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors';

export default function WodEditor({
  mode, heading, submitLabel, form, setForm, movements, setMovements,
  saving, error, onClose, onSubmit, groups = [], programs = [], weeksCount = 1,
  lockedProgram, restDays = [],
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

  const cardioCatalog = MOVEMENT_CATALOG.filter(mv => mv.unit === 'm' || mv.unit === 'cal');

  const canSubmit = !!form.title.trim() && !saving && (!isWhiteboard || !!form.date);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <h2 className="text-lg font-black text-white">{heading}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {/* Group access — Whiteboard uniquement */}
          {isWhiteboard && groups.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Groupes autorisés <span className="text-gray-600 normal-case tracking-normal">(vide = tous les membres)</span></label>
              <div className="flex flex-wrap gap-2">
                {groups.map(g => {
                  const selected = form.groupIds.includes(g.id);
                  return (
                    <button key={g.id} type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        groupIds: selected ? f.groupIds.filter(id => id !== g.id) : [...f.groupIds, g.id],
                      }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        selected
                          ? 'border-transparent scale-105'
                          : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                      }`}
                      style={selected ? { backgroundColor: `${g.color}25`, color: g.color, borderColor: `${g.color}50` } : {}}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                      {g.name}
                    </button>
                  );
                })}
              </div>
              {form.groupIds.length > 0 && form.programIds.length === 0 && (
                <p className="text-[11px] text-gray-500 mt-1.5">Seuls les membres de ces groupes verront ce WOD.</p>
              )}
            </div>
          )}

          {/* Program access — Whiteboard uniquement */}
          {isWhiteboard && programs.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Programmes assignés <span className="text-gray-600 normal-case tracking-normal">(vide = aucun programme)</span></label>
              <div className="flex flex-wrap gap-2">
                {programs.map(p => {
                  const selected = form.programIds.includes(p.id);
                  const pColor = p.type === 'fixed' ? '#3B82F6' : '#8B5CF6';
                  return (
                    <button key={p.id} type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        programIds: selected ? f.programIds.filter(id => id !== p.id) : [...f.programIds, p.id],
                      }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        selected
                          ? 'border-transparent scale-105'
                          : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                      }`}
                      style={selected ? { backgroundColor: `${pColor}25`, color: pColor, borderColor: `${pColor}50` } : {}}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pColor }} />
                      {p.title}
                    </button>
                  );
                })}
              </div>
              {form.programIds.length > 0 && form.groupIds.length === 0 && (
                <p className="text-[11px] text-gray-500 mt-1.5">Ce WOD apparaîtra dans le whiteboard des membres de ces programmes.</p>
              )}
            </div>
          )}

          {/* Deux restrictions posees separement se combinent en OU, jamais en ET :
              l'enoncer evite de croire qu'on a restreint deux fois. */}
          {isWhiteboard && form.programIds.length > 0 && form.groupIds.length > 0 && (
            <p className="text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
              Visible par : les acheteurs de{' '}
              {nomsJoints(programs.filter(p => form.programIds.includes(p.id)).map(p => p.title))}
              {' '}ou les membres de{' '}
              {nomsJoints(groups.filter(g => form.groupIds.includes(g.id)).map(g => g.name))}
            </p>
          )}

          {/* Programme verrouillé — contexte Programme uniquement : la séance
              appartient au programme de la page, et à lui seul. */}
          {isProgram && lockedProgram && (
            <div data-testid="programme-verrouille">
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Programme</label>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-default"
                style={{
                  backgroundColor: `${lockedProgram.type === 'fixed' ? '#3B82F6' : '#8B5CF6'}25`,
                  color: lockedProgram.type === 'fixed' ? '#3B82F6' : '#8B5CF6',
                  borderColor: `${lockedProgram.type === 'fixed' ? '#3B82F6' : '#8B5CF6'}50`,
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lockedProgram.type === 'fixed' ? '#3B82F6' : '#8B5CF6' }} />
                {lockedProgram.title}
              </span>
              <p className="text-[11px] text-gray-500 mt-1.5">Visible par les acheteurs de ce programme uniquement — pas de groupe, pas d&apos;autre programme.</p>
            </div>
          )}

          {isWhiteboard ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Date *</label>
                <input type="date" className={inp} value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Block</label>
                <select className={inp} value={form.block}
                  onChange={e => setForm(f => ({ ...f, block: e.target.value }))}>
                  <option value="" className="text-black">— Aucun —</option>
                  {BLOCKS.map(b => <option key={b.value} value={b.value} className="text-black">{b.label}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Semaine *</label>
                  <select className={inp} value={form.week}
                    onChange={e => setForm(f => ({ ...f, week: parseInt(e.target.value, 10) }))}>
                    {Array.from({ length: Math.max(1, weeksCount) }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w} className="text-black">Semaine {w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Jour *</label>
                  <select className={inp} value={form.dayOfWeek}
                    onChange={e => setForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value, 10) }))}>
                    {DAY_LABELS.map((d, i) => (
                      <option key={d} value={i + 1} className="text-black">
                        {d}{isProgram && estJourRepos(restDays, form.week, i + 1) ? ' — repos' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Block</label>
                <select className={inp} value={form.block}
                  onChange={e => setForm(f => ({ ...f, block: e.target.value }))}>
                  <option value="" className="text-black">— Aucun —</option>
                  {BLOCKS.map(b => <option key={b.value} value={b.value} className="text-black">{b.label}</option>)}
                </select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Type <span className="text-gray-600 normal-case tracking-normal">(optionnel)</span></label>
              <select className={inp} value={form.wod_type}
                onChange={e => setForm(f => ({ ...f, wod_type: e.target.value }))}>
                <option value="" className="text-black">— Aucun —</option>
                {WOD_TYPES.map(t => <option key={t.value} value={t.value} className="text-black">{t.label}</option>)}
              </select>
            </div>
          </div>

          {form.wod_type === 'emom' && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Intervalle EMOM</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(v => {
                  const selected = parseInt(form.emomInterval) === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, emomInterval: String(v) }))}
                      className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                        selected
                          ? 'bg-[#8B5CF6]/25 text-[#C4B5FD] border-[#8B5CF6]/60'
                          : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {v === 1 ? 'EMOM' : `E${v}MOM`}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">Un intervalle = {form.emomInterval} min entre chaque départ.</p>
            </div>
          )}

          {form.wod_type === 'tabata' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Travail (sec)</label>
                <input type="number" min={5} max={300} className={inp} value={form.tabataWork}
                  onChange={e => setForm(f => ({ ...f, tabataWork: e.target.value }))}
                  placeholder="20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Repos (sec)</label>
                <input type="number" min={0} max={300} className={inp} value={form.tabataRest}
                  onChange={e => setForm(f => ({ ...f, tabataRest: e.target.value }))}
                  placeholder="10" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Titre *</label>
            <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Fran, Cindy, Helen…" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Programme / Mouvements</label>
              <button type="button" onClick={addMovement} className="text-xs text-white font-semibold flex items-center gap-1 hover:opacity-80">
                <Plus size={12} /> Ajouter
              </button>
            </div>
            <datalist id="box-movement-catalog">
              {MOVEMENT_CATALOG.map(mv => <option key={mv.name} value={mv.name} />)}
            </datalist>
            <div className="space-y-2">
              {wodRows.map((parsed, i) => {
                const showWeight = movementRowShowsWeight(parsed);
                const showUnit = movementRowShowsUnit(parsed);
                return (
                  <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                    {showUnit ? (
                      <>
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">♂</span>
                          <input type="number" min={0} inputMode="numeric"
                            className={`${inp} !px-0 !pl-7 !pr-2 text-center`}
                            value={parsed.reps ?? ''}
                            onChange={e => patchMovement(i, { reps: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                            placeholder="H" aria-label="Quantité hommes" />
                        </div>
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">♀</span>
                          <input type="number" min={0} inputMode="numeric"
                            className={`${inp} !px-0 !pl-7 !pr-2 text-center`}
                            value={parsed.repsWomen ?? ''}
                            onChange={e => patchMovement(i, { repsWomen: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                            placeholder="F" aria-label="Quantité femmes" />
                        </div>
                        <select className={`${inp} !w-20 shrink-0 px-2`} value={parsed.unit === 'reps' ? 'm' : parsed.unit}
                          onChange={e => patchMovement(i, { unit: e.target.value as MovementUnit })}
                          aria-label="Unité de la quantité">
                          {CARDIO_UNITS.map(u => <option key={u.value} value={u.value} className="text-black">{u.label}</option>)}
                        </select>
                      </>
                    ) : (
                      <input type="number" min={0} inputMode="numeric"
                        className={`${inp} !w-20 shrink-0 text-center px-2`}
                        value={parsed.reps ?? ''}
                        onChange={e => patchMovement(i, { reps: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                        placeholder="Reps" aria-label="Répétitions" />
                    )}
                    <input list="box-movement-catalog"
                      className={`${inp} flex-1 min-w-0`}
                      value={parsed.name}
                      onChange={e => patchMovement(i, { name: e.target.value })}
                      placeholder="Exercice (rechercher…)" aria-label="Exercice" />
                    {/* Sur mobile, les charges et la corbeille passent sur une seconde ligne
                        pour laisser la première au nom de l'exercice. */}
                    <div className={`flex gap-2 items-center ${showWeight ? 'basis-full sm:basis-auto' : ''}`}>
                      {showWeight && (
                        <>
                          <div className="relative w-24 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">♂</span>
                            <input type="number" min={0} step={0.5} inputMode="decimal"
                              className={`${inp} !px-0 !pl-7 !pr-6 text-center`}
                              value={parsed.weightKg ?? ''}
                              onChange={e => patchMovement(i, { weightKg: e.target.value === '' ? null : parseFloat(e.target.value) })}
                              placeholder="H" aria-label="Charge hommes en kilos" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">kg</span>
                          </div>
                          <div className="relative w-24 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">♀</span>
                            <input type="number" min={0} step={0.5} inputMode="decimal"
                              className={`${inp} !px-0 !pl-7 !pr-6 text-center`}
                              value={parsed.weightKgWomen ?? ''}
                              onChange={e => patchMovement(i, { weightKgWomen: e.target.value === '' ? null : parseFloat(e.target.value) })}
                              placeholder="F" aria-label="Charge femmes en kilos" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">kg</span>
                          </div>
                        </>
                      )}
                      <button type="button" onClick={() => removeMovement(i)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {wodRows.length === 0 && (
                <button type="button" onClick={addMovement}
                  className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-gray-600 hover:border-white/30 hover:text-white/60 transition-colors">
                  + Ajouter un mouvement
                </button>
              )}
              <p className="text-[11px] text-gray-600 pt-1">
                Reps + exercice (liste officielle) + charges ♂ hommes / ♀ femmes : garantit le comptage des badges de mouvement des athlètes.
                Les exercices cardio (Row, Bike, SkiErg, Run…) se comptent en mètres ou calories, avec une quantité ♂/♀ séparée si besoin.
              </p>
            </div>
          </div>

          {/* Bloc Musculation — séries × reps × charge (kg ou %1RM) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Dumbbell size={13} /> Musculation <span className="text-gray-600 normal-case tracking-normal">(optionnel)</span>
              </label>
              <button type="button" onClick={addStrength} className="text-xs text-white font-semibold flex items-center gap-1 hover:opacity-80">
                <Plus size={12} /> Ajouter une série
              </button>
            </div>
            <div className="space-y-2">
              {strengthRows.map((e, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <input list="box-movement-catalog"
                      className={`${inp} flex-1 min-w-0`}
                      value={e.name}
                      onChange={ev => updateStrength(i, { name: ev.target.value })}
                      placeholder="Exercice (rechercher…)" aria-label="Exercice de musculation" />
                    <button type="button" onClick={() => removeStrength(i)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="number" min={1} inputMode="numeric"
                      className={`${inp} !w-20 shrink-0 text-center px-2`}
                      value={e.sets}
                      onChange={ev => updateStrength(i, { sets: parseInt(ev.target.value, 10) || 1 })}
                      placeholder="5" aria-label="Séries" />
                    <span className="text-gray-500 text-sm">×</span>
                    <input type="number" min={1} inputMode="numeric"
                      className={`${inp} !w-20 shrink-0 text-center px-2`}
                      value={e.reps}
                      onChange={ev => updateStrength(i, { reps: parseInt(ev.target.value, 10) || 1 })}
                      placeholder="3" aria-label="Répétitions par série" />
                    <span className="text-gray-500 text-sm">@</span>
                    <input type="number" min={0} step={0.5} inputMode="decimal"
                      className={`${inp} !w-20 shrink-0 text-center px-2`}
                      value={e.load ?? ''}
                      onChange={ev => updateStrength(i, { load: ev.target.value === '' ? null : parseFloat(ev.target.value) })}
                      placeholder="Charge" aria-label="Charge par série" />
                    <select className={`${inp} !w-24 shrink-0 px-2`} value={e.unit}
                      onChange={ev => updateStrength(i, { unit: ev.target.value as StrengthLoadUnit })}
                      aria-label="Unité de charge">
                      <option value="kg" className="text-black">kg</option>
                      <option value="%1RM" className="text-black">%1RM</option>
                    </select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="text"
                      className={`${inp} flex-1 min-w-0`}
                      value={e.restSec != null ? String(e.restSec) : ''}
                      onChange={ev => updateStrength(i, { restSec: ev.target.value === '' ? null : parseInt(ev.target.value, 10) || null })}
                      placeholder="Repos (sec)" aria-label="Repos entre séries en secondes" />
                    <input type="text"
                      className={`${inp} flex-1 min-w-0`}
                      value={e.tempo ?? ''}
                      onChange={ev => updateStrength(i, { tempo: ev.target.value || null })}
                      placeholder="Tempo (30X1)" aria-label="Tempo" />
                    <input type="text"
                      className={`${inp} flex-1 min-w-0`}
                      value={e.loadNote ?? ''}
                      onChange={ev => updateStrength(i, { loadNote: ev.target.value || null })}
                      placeholder="Charge libre (RPE 9, RM du jour…)" aria-label="Charge libre" />
                  </div>
                  <p className="text-[11px] text-gray-600">{serializeStrength(e) || 'Nomme l’exercice pour enregistrer cette série.'}</p>
                </div>
              ))}
              {strengthRows.length === 0 && (
                <button type="button" onClick={addStrength}
                  className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-gray-600 hover:border-white/30 hover:text-white/60 transition-colors">
                  + Ajouter une série de musculation
                </button>
              )}
              <p className="text-[11px] text-gray-600 pt-1">
                Une charge en %1RM s’affiche en kilos chez l’athlète, calculée sur son propre 1RM.
                Ces séries ne comptent pas de reps de badge : ce n’est pas du metcon.
              </p>
            </div>
          </div>

          {/* Bloc Cardio — séries × quantité (m ou cal) × cible watts ou allure */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <HeartPulse size={13} /> Cardio <span className="text-gray-600 normal-case tracking-normal">(optionnel)</span>
              </label>
              <button type="button" onClick={addCardio} className="text-xs text-white font-semibold flex items-center gap-1 hover:opacity-80">
                <Plus size={12} /> Ajouter une série cardio
              </button>
            </div>
            <div className="space-y-2">
              {cardioRows.map((e, i) => {
                const targetMode = e.pace ? 'pace' : 'watts';
                const paceRef = e.pace?.per ?? (/run|course/i.test(e.name) ? 'km' : '500 m');
                return (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <select className={`${inp} flex-1 min-w-0`} value={e.name}
                        onChange={ev => {
                          const name = ev.target.value;
                          const cat = cardioCatalog.find(mv => mv.name === name);
                          updateCardio(i, { name, unit: (cat?.unit as CardioUnit | undefined) ?? e.unit });
                        }}
                        aria-label="Exercice cardio">
                        <option value="" className="text-black">— Exercice —</option>
                        {cardioCatalog.map(mv => <option key={mv.name} value={mv.name} className="text-black">{mv.name}</option>)}
                      </select>
                      <button type="button" onClick={() => removeCardio(i)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input type="number" min={1} inputMode="numeric"
                        className={`${inp} !w-20 shrink-0 text-center px-2`}
                        value={e.sets}
                        onChange={ev => updateCardio(i, { sets: parseInt(ev.target.value, 10) || 1 })}
                        placeholder="2" aria-label="Séries cardio" />
                      <span className="text-gray-500 text-sm">×</span>
                      <input type="number" min={1} inputMode="numeric"
                        className={`${inp} !w-24 shrink-0 text-center px-2`}
                        value={e.quantity}
                        onChange={ev => updateCardio(i, { quantity: parseInt(ev.target.value, 10) || 1 })}
                        placeholder="500" aria-label="Quantité par série" />
                      <select className={`${inp} !w-20 shrink-0 px-2`} value={e.unit}
                        onChange={ev => updateCardio(i, { unit: ev.target.value as CardioUnit })}
                        aria-label="Unité cardio">
                        {CARDIO_UNITS.map(u => <option key={u.value} value={u.value} className="text-black">{u.label}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select className={`${inp} !w-28 shrink-0 px-2`} value={targetMode}
                        onChange={ev => (ev.target.value === 'pace'
                          ? updateCardio(i, { watts: null, pace: { mmss: '', per: paceRef } })
                          : updateCardio(i, { pace: null }))}
                        aria-label="Type de cible">
                        <option value="watts" className="text-black">Watts</option>
                        <option value="pace" className="text-black">Allure</option>
                      </select>
                      {targetMode === 'watts' ? (
                        <div className="relative flex-1 min-w-0">
                          <input type="number" min={0} inputMode="numeric"
                            className={`${inp} !pr-8`}
                            value={e.watts ?? ''}
                            onChange={ev => updateCardio(i, { watts: ev.target.value === '' ? null : parseInt(ev.target.value, 10) })}
                            placeholder="Cible (250)" aria-label="Cible en watts" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">W</span>
                        </div>
                      ) : (
                        <>
                          <input type="text" inputMode="numeric"
                            className={`${inp} flex-1 min-w-0`}
                            value={e.pace?.mmss ?? ''}
                            onChange={ev => updateCardio(i, { pace: { mmss: ev.target.value, per: paceRef } })}
                            placeholder="mm:ss (2:00)" aria-label="Allure cible" />
                          <select className={`${inp} !w-24 shrink-0 px-2`} value={paceRef}
                            onChange={ev => updateCardio(i, { pace: { mmss: e.pace?.mmss ?? '', per: ev.target.value as '500 m' | 'km' } })}
                            aria-label="Référence d’allure">
                            <option value="500 m" className="text-black">/500 m</option>
                            <option value="km" className="text-black">/km</option>
                          </select>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <input type="text"
                        className={`${inp} flex-1 min-w-0`}
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
                        className={`${inp} flex-1 min-w-0`}
                        value={e.rpe ?? ''}
                        onChange={ev => updateCardio(i, { rpe: ev.target.value || null })}
                        placeholder="RPE (6)" aria-label="RPE" />
                    </div>
                    <p className="text-[11px] text-gray-600">{serializeCardio(e) || 'Choisis l’exercice pour enregistrer cette série.'}</p>
                  </div>
                );
              })}
              {cardioRows.length === 0 && (
                <button type="button" onClick={addCardio}
                  className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-gray-600 hover:border-white/30 hover:text-white/60 transition-colors">
                  + Ajouter une série cardio
                </button>
              )}
              <p className="text-[11px] text-gray-600 pt-1">
                Les mètres et calories de ces séries comptent dans les badges cardio de l’athlète.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Time Cap (mm:ss)</label>
              <input type="text" inputMode="numeric" className={inp} value={form.timeCap}
                onChange={e => setForm(f => ({ ...f, timeCap: e.target.value }))} placeholder="12:30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Rounds <span className="text-gray-600 normal-case tracking-normal">(optionnel)</span></label>
              <input type="number" className={inp} value={form.rounds}
                onChange={e => setForm(f => ({ ...f, rounds: e.target.value }))} placeholder="—" min="0" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Notes Coach</label>
            <textarea rows={2} className={`${inp} resize-none`} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Conseils, scaling options…" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><Video size={13} className="text-red-400" /> Vidéo YouTube <span className="text-gray-600 normal-case tracking-normal">(optionnel)</span></label>
            <input className={inp} value={form.videoUrl}
              onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..." />
          </div>

          {/* Publication — Whiteboard et Programme : une programmation vendue
              n'a pas de date de publication, elle est révélée à l'application
              par la box. L'heure programmée n'existe que datée (Whiteboard). */}
          {(isWhiteboard || isProgram) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Publier</p>
                  <p className="text-xs text-gray-500">{isProgram ? 'Visible par les acheteurs du programme' : 'Visible par les athlètes de la box'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.published ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          )}
          {isWhiteboard && form.published && (
            <div className="bg-white/5 rounded-xl px-4 py-3 space-y-3">
              <div className="flex gap-2">
                {(['now', 'scheduled'] as const).map(mode2 => (
                  <button key={mode2} type="button"
                    onClick={() => setForm(f => ({ ...f, publishMode: mode2 }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${form.publishMode === mode2 ? 'bg-white/20 text-white border border-white/40' : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'}`}>
                    {mode2 === 'now' ? 'Maintenant' : 'Programmer'}
                  </button>
                ))}
              </div>
              {form.publishMode === 'scheduled' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Heure :</span>
                  <input type="number" min={0} max={23} value={form.publishHour}
                    onChange={e => setForm(f => ({ ...f, publishHour: e.target.value }))}
                    className="w-14 bg-[#0A0A0A] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-white/50" />
                  <span className="text-gray-500 font-bold">:</span>
                  <input type="number" min={0} max={59} value={form.publishMin}
                    onChange={e => setForm(f => ({ ...f, publishMin: e.target.value }))}
                    className="w-14 bg-[#0A0A0A] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-white/50" />
                  <span className="text-[10px] text-gray-600 ml-1">Le WOD sera visible à cette heure le jour programmé</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Classement</p>
              <p className="text-xs text-gray-500">{form.leaderboard ? 'Les scores sont classés entre membres' : 'Scores enregistrés en historique uniquement'}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, leaderboard: !f.leaderboard }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.leaderboard ? 'bg-white' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.leaderboard ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {isProgram && (
            <p className="text-[11px] text-gray-500">
              Une séance de programme n&apos;a pas de date : chaque acheteur la reçoit la semaine {form.week},
              le {DAY_LABELS[form.dayOfWeek - 1] ?? ''}, comptés depuis son propre démarrage — en plus des WOD du Whiteboard de la box.
            </p>
          )}

          {mode === 'programming' && (
            <p className="text-[11px] text-gray-500">
              Une programmation n&apos;a ni date ni accès : la box abonnée choisit la semaine
              calendaire et les groupes au moment où elle applique la semaine sur son Whiteboard.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              Annuler
            </button>
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white hover:bg-white disabled:opacity-50 text-[#0A0A0A] text-sm font-bold transition-colors"
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
