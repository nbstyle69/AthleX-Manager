'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, X, Dumbbell } from 'lucide-react';
import {
  groupStrengthSessions,
  readWeightliftingRecords,
  type StrengthSet,
} from '@/lib/athleteStrength';

// Fiche athlète du staff. Deux lectures, toutes deux par RPC `SECURITY DEFINER` :
// aucune colonne privée de `profiles` n'est lisible en direct par `authenticated`
// (lot 0-bis), et `strength_set_logs` est en RLS propriétaire stricte — le staff
// n'en lit pas une ligne en direct. L'isolation par box est donc portée par
// l'autorisation des RPC, jamais par un filtre d'écran.

interface PrivateProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  gender: string | null;
  personal_records: Record<string, unknown> | null;
  avatar_url: string | null;
  level: string | null;
  elo: number | null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const SOURCE_LABEL: Record<string, string> = {
  whiteboard: 'Whiteboard',
  program: 'Programme',
};

export default function AthleteSheet({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const [sets, setSets] = useState<StrengthSet[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [profileRes, setsRes] = await Promise.all([
        supabase.rpc('get_athlete_private_profile', { p_user_id: memberId }),
        supabase.rpc('list_athlete_strength_sets', { p_user_id: memberId, p_limit: 200 }),
      ]);
      if (cancelled) return;
      // Un refus d'autorisation doit se lire à l'écran : une fiche vide se
      // confondrait avec « cet athlète n'a rien fait ».
      const rpcError = profileRes.error ?? setsRes.error;
      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }
      setProfile(((profileRes.data ?? []) as PrivateProfile[])[0] ?? null);
      setSets((setsRes.data ?? []) as StrengthSet[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  const records = readWeightliftingRecords(profile?.personal_records ?? null);
  const sessions = groupStrengthSessions(sets);
  const prSetIds = new Set(records.map(r => r.sourceId).filter((v): v is string => v !== null));

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#0A0A0A] border-l border-white/10 z-50 overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/8 sticky top-0 bg-[#0A0A0A]">
          <div>
            <h2 className="text-lg font-black text-white">{profile?.username ?? 'Fiche athlète'}</h2>
            {profile?.full_name && <p className="text-sm text-gray-400">{profile.full_name}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-white" /></div>
        ) : error ? (
          <div className="m-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : (
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Niveau', value: profile?.level?.toUpperCase() ?? '—' },
                { label: 'ELO', value: profile?.elo != null ? String(profile.elo) : '—' },
                { label: 'Genre', value: profile?.gender ?? '—' },
              ].map(c => (
                <div key={c.label} className="bg-[#111111] border border-white/8 rounded-xl px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{c.label}</p>
                  <p className="text-sm font-bold text-white mt-1">{c.value}</p>
                </div>
              ))}
            </div>

            <section>
              <h3 className="text-sm font-bold text-white mb-2">Records 1RM</h3>
              {records.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Aucun record d&apos;haltérophilie enregistré.</p>
              ) : (
                <div className="bg-[#111111] border border-white/8 rounded-xl divide-y divide-white/5">
                  {records.map(r => (
                    <div key={r.movement} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-sm text-white font-semibold flex-1">{r.movement}</span>
                      <span className="text-sm font-mono text-white">{r.value} kg</span>
                      {r.date && <span className="text-[11px] text-gray-500">{r.date}</span>}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${r.sourceId ? 'bg-white/10 text-gray-300' : 'bg-white/5 text-gray-600'}`}>
                        {r.sourceId ? 'série tracée' : 'saisi à la main'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Dumbbell size={14} /> Séries réalisées
              </h3>
              {sessions.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Aucune série de musculation journalisée. Le journal se remplit quand l&apos;athlète
                  valide sa grille de séries dans l&apos;app.
                </p>
              ) : (
                <div className="space-y-3">
                  {sessions.map(s => (
                    <div key={s.key} className="bg-[#111111] border border-white/8 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                        <span className="text-sm font-bold text-white flex-1">{s.title}</span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400">
                          {SOURCE_LABEL[s.sourceType] ?? s.sourceType}
                        </span>
                        <span className="text-[11px] text-gray-500">{fmtDate(s.performedAt)}</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {s.sets.map(set => {
                          // Le prescrit ne s'affiche que s'il diffère du réalisé : c'est
                          // l'écart qui porte l'information, et c'est lui qui rend le 1RM juste.
                          const drift = set.prescribed_reps != null && set.prescribed_reps !== set.reps;
                          return (
                            <div key={set.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                              <span className="text-gray-500 w-14 shrink-0">Série {set.set_index}</span>
                              <span className="text-white font-semibold flex-1">
                                {set.movement_label ?? set.movement}
                              </span>
                              <span className="font-mono text-white">
                                {set.reps} × {set.load_kg != null ? `${set.load_kg} kg` : '—'}
                              </span>
                              {drift && (
                                <span className="text-[10px] text-gray-500">
                                  prescrit : {set.prescribed_reps}
                                  {set.prescribed_load_kg != null ? ` × ${set.prescribed_load_kg} kg` : ''}
                                </span>
                              )}
                              {prSetIds.has(set.id) && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/15 text-white">1RM</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
