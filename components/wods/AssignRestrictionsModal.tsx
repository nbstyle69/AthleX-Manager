'use client';

import { messageErreur } from '@/lib/erreurs';
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { AssignMode, assignRestrictions, libelleAssignation } from '@/lib/wodAssignment';
import { RestrictionRef } from '@/components/wods/RestrictionBadges';
import { softVar } from '@/lib/colorVars';

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
      setError(messageErreur(e));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ax-overlay flex items-center justify-center p-4">
      <div className="bg-ax-surface border border-ax-border rounded-ax-card w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ax-border">
          <h2 className="text-base font-bold text-ax-text">
            Assigner {wodIds.length} WOD{wodIds.length > 1 ? 's' : ''}
          </h2>
          <button onClick={onClose} className="p-1 rounded-ax-control hover:bg-ax-hover">
            <X size={16} className="text-ax-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section>
            <p className="text-xs font-black uppercase tracking-wider text-ax-text-muted mb-2">Groupes</p>
            {groups.length === 0 ? (
              <p className="text-xs text-ax-text-muted">Aucun groupe dans cette box.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => toggle(groupIds, setGroupIds, g.id)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                      groupIds.includes(g.id) ? 'border-ax-input-border text-ax-text' : 'border-ax-border text-ax-text-secondary'
                    }`}
                    style={groupIds.includes(g.id) ? { backgroundColor: softVar(g.color, 0.145) } : undefined}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="text-xs font-black uppercase tracking-wider text-ax-text-muted mb-2">Programmes</p>
            {programs.length === 0 ? (
              <p className="text-xs text-ax-text-muted">Aucun programme actif dans cette box.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {programs.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggle(programIds, setProgramIds, p.id)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                      programIds.includes(p.id) ? 'border-ax-input-border text-ax-text' : 'border-ax-border text-ax-text-secondary'
                    }`}
                    style={programIds.includes(p.id) ? { backgroundColor: softVar(p.color, 0.145) } : undefined}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ax-text-muted">Comment</p>
            <label className="flex items-start gap-2 text-sm text-ax-text-secondary cursor-pointer">
              <input type="radio" checked={mode === 'ajouter'} onChange={() => setMode('ajouter')} className="mt-1" />
              <span>
                Ajouter aux restrictions existantes
                <span className="block text-xs text-ax-text-muted">Ce qui est déjà posé sur ces WOD reste en place.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-ax-text-secondary cursor-pointer">
              <input type="radio" checked={mode === 'remplacer'} onChange={() => setMode('remplacer')} className="mt-1" />
              <span>
                Remplacer les restrictions
                <span className="block text-xs text-ax-text-muted">
                  Les WOD sélectionnés n&apos;auront plus que ce qui est coché ici — groupes et programmes.
                </span>
              </span>
            </label>
          </section>

          {mode === 'remplacer' && rienDeCoche && (
            <p className="text-xs font-semibold text-ax-warning bg-ax-warning-soft border border-ax-warning rounded-ax-control px-3 py-2">
              Rien n&apos;est coché : ces {wodIds.length} WOD perdront toute restriction et deviendront visibles par toute la box.
            </p>
          )}
          {/* Emplacement de hauteur constante : une ligne qui apparaît/disparaît
              déplace les puces sous le curseur entre deux clics. */}
          {mode === 'ajouter' && (
            <p className="text-xs text-ax-text-muted min-h-[16px]">
              {rienDeCoche
                ? 'Coche au moins un groupe ou un programme pour assigner.'
                : `${groupIds.length + programIds.length} destination${groupIds.length + programIds.length > 1 ? 's' : ''} cochée${groupIds.length + programIds.length > 1 ? 's' : ''}.`}
            </p>
          )}
          {error && (
            <p className="text-xs font-semibold text-ax-danger bg-ax-danger-soft border border-ax-danger rounded-ax-control px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ax-border">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-ax-text-secondary rounded-ax-control hover:bg-ax-hover">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving || (mode === 'ajouter' && rienDeCoche)}
            className="px-4 py-2 text-sm font-bold text-ax-background bg-ax-text rounded-ax-control disabled:opacity-40 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {mode === 'remplacer' ? 'Remplacer' : 'Assigner'}
          </button>
        </div>
      </div>
    </div>
  );
}
