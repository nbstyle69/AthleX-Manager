'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { AssignMode, assignRestrictions, libelleAssignation } from '@/lib/wodAssignment';
import { RestrictionRef } from '@/components/wods/RestrictionBadges';

/**
 * « Assigner à… » pour une sélection de WOD.
 *
 * Le mode par défaut est l'ajout : un import pose des dizaines de WOD, et
 * répartir ne doit pas effacer ce qui existe déjà. Le remplacement existe,
 * mais il est coché explicitement et sa conséquence est écrite au-dessus du
 * bouton — y compris le cas « rien de coché », qui rend les WOD visibles par
 * toute la box.
 */
export default function AssignRestrictionsModal({
  wodIds, groups, programs, onClose, onDone,
}: {
  wodIds: string[];
  groups: RestrictionRef[];
  programs: RestrictionRef[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [mode, setMode] = useState<AssignMode>('ajouter');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const rienDeCoche = groupIds.length === 0 && programIds.length === 0;

  async function submit() {
    setSaving(true); setError(null);
    try {
      await assignRestrictions(wodIds, groupIds, programIds, mode);
      onDone(libelleAssignation(wodIds.length, {
        groupes: groupIds.map(id => groups.find(g => g.id === id)?.name ?? id),
        programmes: programIds.map(id => programs.find(p => p.id === id)?.name ?? id),
      }, mode));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-base font-bold text-white">
            Assigner {wodIds.length} WOD{wodIds.length > 1 ? 's' : ''}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Groupes</p>
            {groups.length === 0 ? (
              <p className="text-xs text-gray-600">Aucun groupe dans cette box.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => toggle(groupIds, setGroupIds, g.id)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                      groupIds.includes(g.id) ? 'border-white/40 text-white' : 'border-white/10 text-gray-400'
                    }`}
                    style={groupIds.includes(g.id) ? { backgroundColor: `${g.color}25` } : undefined}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Programmes</p>
            {programs.length === 0 ? (
              <p className="text-xs text-gray-600">Aucun programme actif dans cette box.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {programs.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggle(programIds, setProgramIds, p.id)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                      programIds.includes(p.id) ? 'border-white/40 text-white' : 'border-white/10 text-gray-400'
                    }`}
                    style={programIds.includes(p.id) ? { backgroundColor: `${p.color}25` } : undefined}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Comment</p>
            <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="radio" checked={mode === 'ajouter'} onChange={() => setMode('ajouter')} className="mt-1" />
              <span>
                Ajouter aux restrictions existantes
                <span className="block text-xs text-gray-500">Ce qui est déjà posé sur ces WOD reste en place.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="radio" checked={mode === 'remplacer'} onChange={() => setMode('remplacer')} className="mt-1" />
              <span>
                Remplacer les restrictions
                <span className="block text-xs text-gray-500">
                  Les WOD sélectionnés n&apos;auront plus que ce qui est coché ici — groupes et programmes.
                </span>
              </span>
            </label>
          </section>

          {mode === 'remplacer' && rienDeCoche && (
            <p className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              Rien n&apos;est coché : ces {wodIds.length} WOD perdront toute restriction et deviendront visibles par toute la box.
            </p>
          )}
          {mode === 'ajouter' && rienDeCoche && (
            <p className="text-xs text-gray-500">Coche au moins un groupe ou un programme pour assigner.</p>
          )}
          {error && (
            <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-gray-400 rounded-xl hover:bg-white/5">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving || (mode === 'ajouter' && rienDeCoche)}
            className="px-4 py-2 text-sm font-bold text-black bg-white rounded-xl disabled:opacity-40 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {mode === 'remplacer' ? 'Remplacer' : 'Assigner'}
          </button>
        </div>
      </div>
    </div>
  );
}
