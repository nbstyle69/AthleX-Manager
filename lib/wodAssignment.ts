import { createClient } from '@/lib/supabase/client';

/**
 * Assignation de restrictions à plusieurs WOD en un geste.
 *
 * Deux modes, jamais implicites :
 * - `ajouter` : les restrictions cochées s'ajoutent à celles déjà posées. Les
 *   `UNIQUE (wod_id, group_id)` / `UNIQUE (wod_id, program_id)` rendent le
 *   geste idempotent, donc réassigner deux fois ne crée pas de doublon.
 * - `remplacer` : les WOD visés n'ont plus que les restrictions cochées. Le
 *   retrait est un DELETE explicite, jamais un effet de bord d'un INSERT.
 *
 * L'écriture est refusée côté serveur pour qui n'est pas admin de la box du
 * WOD (policies `wod_group_access_admin_write` / `wod_program_access_admin_write`
 * appuyées sur `is_box_admin`) : cette fonction ne prononce aucun droit.
 */

export type AssignMode = 'ajouter' | 'remplacer';

export type AssignResult = {
  wods: number;
  groupesAjoutes: number;
  programmesAjoutes: number;
  retires: number;
};

export async function assignRestrictions(
  wodIds: string[],
  groupIds: string[],
  programIds: string[],
  mode: AssignMode,
): Promise<AssignResult> {
  if (wodIds.length === 0) throw new Error('Aucun WOD sélectionné.');
  const supabase = createClient();
  let retires = 0;

  if (mode === 'remplacer') {
    const { data: gDel, error: gErr } = await supabase
      .from('wod_group_access').delete().in('wod_id', wodIds).select('wod_id');
    if (gErr) throw new Error(`retrait des groupes refusé — ${gErr.message}`);
    const { data: pDel, error: pErr } = await supabase
      .from('wod_program_access').delete().in('wod_id', wodIds).select('wod_id');
    if (pErr) throw new Error(`retrait des programmes refusé — ${pErr.message}`);
    retires = (gDel?.length ?? 0) + (pDel?.length ?? 0);
  }

  let groupesAjoutes = 0;
  if (groupIds.length > 0) {
    const rows = wodIds.flatMap(wod_id => groupIds.map(group_id => ({ wod_id, group_id })));
    const { data, error } = await supabase
      .from('wod_group_access')
      .upsert(rows, { onConflict: 'wod_id,group_id', ignoreDuplicates: true })
      .select('wod_id');
    if (error) throw new Error(`assignation aux groupes refusée — ${error.message}`);
    groupesAjoutes = data?.length ?? 0;
  }

  let programmesAjoutes = 0;
  if (programIds.length > 0) {
    const rows = wodIds.flatMap(wod_id => programIds.map(program_id => ({ wod_id, program_id })));
    const { data, error } = await supabase
      .from('wod_program_access')
      .upsert(rows, { onConflict: 'wod_id,program_id', ignoreDuplicates: true })
      .select('wod_id');
    if (error) throw new Error(`assignation aux programmes refusée — ${error.message}`);
    programmesAjoutes = data?.length ?? 0;
  }

  return { wods: wodIds.length, groupesAjoutes, programmesAjoutes, retires };
}

/**
 * Le compte-rendu nomme les destinataires. « 12 WOD assignés » sans dire à qui
 * ne se vérifie pas à l'œil ; « 12 WOD → Groupe : Muscu » se recoupe avec les
 * badges des cartes.
 */
export function libelleAssignation(
  nbWods: number,
  noms: { groupes: string[]; programmes: string[] },
  mode: AssignMode,
): string {
  const s = nbWods > 1 ? 's' : '';
  const wods = `${nbWods} WOD${s}`;
  const cibles = [
    ...noms.groupes.map(n => `Groupe : ${n}`),
    ...noms.programmes.map(n => `Programme : ${n}`),
  ];
  if (cibles.length === 0) {
    return `${wods} sans restriction — visible${s} par toute la box.`;
  }
  const verbe = mode === 'ajouter' ? `assigné${s} à` : `restreint${s} à (remplacement)`;
  return `${wods} ${verbe} ${cibles.join(', ')}.`;
}
