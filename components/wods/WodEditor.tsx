'use client';

import { Dispatch, SetStateAction } from 'react';
import { Plus, Trash2, X, Loader2, Video } from 'lucide-react';
import {
  MOVEMENT_CATALOG,
  isWeightedMovement,
  serializeMovement,
  parseMovementRow,
} from '@/lib/movements';
import { BLOCKS, DAY_LABELS, WOD_TYPES, WodFormState } from '@/lib/wodFields';

/**
 * Éditeur de WOD unique, deux contextes :
 *
 * - `whiteboard` : le WOD est posé sur le calendrier d'une box — date, groupes
 *   autorisés, programmes assignés, publication immédiate ou programmée.
 * - `programming` : le WOD est écrit dans une programmation vendue à d'autres
 *   boxs — semaine × jour, aucune notion d'accès ni de publication : l'accès se
 *   décide à l'application de la semaine par la box abonnée.
 *
 * Le contenu (mouvements du catalogue officiel, type, block, time cap, rounds,
 * notes, vidéo, EMOM/Tabata, classement) est identique dans les deux contextes.
 * C'est ici que viendra s'ajouter le bloc Musculation.
 */
export interface WodEditorGroup { id: string; name: string; color: string }
export interface WodEditorProgram { id: string; title: string; type: string }

interface WodEditorProps {
  mode: 'whiteboard' | 'programming';
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
  /** Contexte Programmation : nombre de semaines de l'offre. */
  weeksCount?: number;
}

const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors';

export default function WodEditor({
  mode, heading, submitLabel, form, setForm, movements, setMovements,
  saving, error, onClose, onSubmit, groups = [], programs = [], weeksCount = 1,
}: WodEditorProps) {
  const isWhiteboard = mode === 'whiteboard';

  const addMovement = () => setMovements(m => [...m, '']);
  const removeMovement = (i: number) => setMovements(m => m.filter((_, idx) => idx !== i));
  const setMovement = (i: number, v: string) => setMovements(m => m.map((x, idx) => (idx === i ? v : x)));

  const canSubmit = !!form.title.trim() && !saving && (!isWhiteboard || !!form.date);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
              {form.groupIds.length > 0 && (
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
              {form.programIds.length > 0 && (
                <p className="text-[11px] text-gray-500 mt-1.5">Ce WOD apparaîtra dans le whiteboard des membres de ces programmes.</p>
              )}
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
                      <option key={d} value={i + 1} className="text-black">{d}</option>
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
              {movements.map((line, i) => {
                const parsed = parseMovementRow(line);
                const showWeight = parsed.weightKg != null || parsed.weightKgWomen != null || isWeightedMovement(parsed.name);
                const update = (reps: number | null, name: string, weightKg: number | null, weightKgWomen: number | null) => {
                  const w  = showWeight ? weightKg : null;
                  const wW = showWeight ? weightKgWomen : null;
                  if (reps == null) setMovement(i, serializeMovement(0, name, w, wW).replace(/^0\s*/, '').trim());
                  else              setMovement(i, serializeMovement(reps, name, w, wW));
                };
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="number" min={0} inputMode="numeric"
                      className={`${inp} !w-16 shrink-0 text-center px-2`}
                      value={parsed.reps ?? ''}
                      onChange={e => update(e.target.value === '' ? null : parseInt(e.target.value, 10), parsed.name, parsed.weightKg, parsed.weightKgWomen)}
                      placeholder="Reps" aria-label="Répétitions" />
                    <input list="box-movement-catalog"
                      className={`${inp} flex-1 min-w-0`}
                      value={parsed.name}
                      onChange={e => update(parsed.reps, e.target.value, parsed.weightKg, parsed.weightKgWomen)}
                      placeholder="Exercice (rechercher…)" aria-label="Exercice" />
                    {showWeight && (
                      <>
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">♂</span>
                          <input type="number" min={0} step={0.5} inputMode="decimal"
                            className={`${inp} !px-0 !pl-7 !pr-6 text-center`}
                            value={parsed.weightKg ?? ''}
                            onChange={e => update(parsed.reps, parsed.name, e.target.value === '' ? null : parseFloat(e.target.value), parsed.weightKgWomen)}
                            placeholder="H" aria-label="Charge hommes en kilos" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">kg</span>
                        </div>
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">♀</span>
                          <input type="number" min={0} step={0.5} inputMode="decimal"
                            className={`${inp} !px-0 !pl-7 !pr-6 text-center`}
                            value={parsed.weightKgWomen ?? ''}
                            onChange={e => update(parsed.reps, parsed.name, parsed.weightKg, e.target.value === '' ? null : parseFloat(e.target.value))}
                            placeholder="F" aria-label="Charge femmes en kilos" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">kg</span>
                        </div>
                      </>
                    )}
                    <button type="button" onClick={() => removeMovement(i)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              {movements.length === 0 && (
                <button type="button" onClick={addMovement}
                  className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-gray-600 hover:border-white/30 hover:text-white/60 transition-colors">
                  + Ajouter un mouvement
                </button>
              )}
              <p className="text-[11px] text-gray-600 pt-1">
                Reps + exercice (liste officielle) + charges ♂ hommes / ♀ femmes : garantit le comptage des badges de mouvement des athlètes.
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

          {/* Publication — Whiteboard uniquement : une programmation n'a pas de
              date de publication, elle est révélée à l'application par la box. */}
          {isWhiteboard && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Publier</p>
                  <p className="text-xs text-gray-500">Visible par les athlètes de la box</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.published ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {form.published && (
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

          {!isWhiteboard && (
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
