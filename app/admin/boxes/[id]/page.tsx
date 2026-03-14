'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, ArrowLeft, Users, Dumbbell, Trophy, Crown,
  CheckCircle, XCircle, Calendar, Clock, Shield, Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = ['Infos', 'Membres', 'Whiteboard', 'Tournois'];

interface BoxData {
  box: any;
  members: any[];
  wods: any[];
  scores: any[];
  competitions: any[];
}

export default function BoxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<BoxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/admin/boxes/${id}`);
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.box) {
    return (
      <div className="text-center py-32">
        <Building2 size={48} className="text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Box introuvable.</p>
      </div>
    );
  }

  const { box, members, wods, scores, competitions } = data;
  const owner = Array.isArray(box.owner) ? box.owner[0] : box.owner;

  const planColor =
    box.plan === 'elite' ? 'text-yellow-400 bg-yellow-500/15 border-yellow-500/20' :
    box.plan === 'pro' ? 'text-purple-400 bg-purple-500/15 border-purple-500/20' :
    'text-gray-400 bg-white/5 border-white/10';

  const levelColor = (l: string) =>
    l === 'pro' ? 'text-red-400' : l === 'gx' ? 'text-purple-400' :
    l === 'rx+' ? 'text-orange-400' : l === 'rx' ? 'text-emerald-400' :
    l === 'inter' ? 'text-blue-400' : 'text-gray-400';

  function getWodScores(wodId: string) {
    return scores.filter((s: any) => s.wod_id === wodId);
  }

  function formatScore(value: number, type: string) {
    if (type === 'time') {
      const m = Math.floor(value / 60);
      const s = Math.round(value % 60);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${value}`;
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button onClick={() => router.push('/admin/boxes')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={14} /> Retour aux boxes
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/15 flex items-center justify-center text-orange-400 font-black text-xl">
              {box.name?.[0]?.toUpperCase() ?? 'B'}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{box.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                {box.city && <span className="text-sm text-gray-400">{box.city}</span>}
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${planColor}`}>
                  {box.plan ?? 'free'}
                </span>
                {box.is_active ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-lg">
                    <CheckCircle size={10} /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-lg">
                    <XCircle size={10} /> Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111111] border border-white/[0.06] rounded-xl p-1">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all',
              tab === i ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            {t}
            {i === 1 && <span className="ml-1.5 text-[10px] opacity-60">({members.length})</span>}
            {i === 2 && <span className="ml-1.5 text-[10px] opacity-60">({wods.length})</span>}
            {i === 3 && <span className="ml-1.5 text-[10px] opacity-60">({competitions.length})</span>}
          </button>
        ))}
      </div>

      {/* TAB: Infos */}
      {tab === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Informations</h3>
            <div className="space-y-3">
              <InfoRow label="Nom" value={box.name} />
              <InfoRow label="Slug" value={box.slug ?? '—'} />
              <InfoRow label="Ville" value={box.city ?? '—'} />
              <InfoRow label="Description" value={box.description ?? 'Aucune description'} />
              <InfoRow label="Code invitation" value={box.invite_code} mono />
              <InfoRow label="Créée le" value={new Date(box.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </div>
          </div>

          <div className="space-y-4">
            {/* Owner card */}
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Propriétaire</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Crown size={18} className="text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{owner?.username ?? 'Inconnu'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black uppercase text-yellow-400 bg-yellow-500/15 px-2 py-0.5 rounded">{owner?.role}</span>
                    <span className={`text-[10px] font-black uppercase ${levelColor(owner?.level)}`}>{owner?.level}</span>
                    <span className="text-xs font-bold text-yellow-500">ELO {owner?.elo}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Users} label="Membres" value={members.length} color="text-blue-400" bg="bg-blue-500/15" />
              <StatCard icon={Dumbbell} label="WODs" value={wods.length} color="text-emerald-400" bg="bg-emerald-500/15" />
              <StatCard icon={Trophy} label="Tournois" value={competitions.length} color="text-purple-400" bg="bg-purple-500/15" />
            </div>
          </div>
        </div>
      )}

      {/* TAB: Membres */}
      {tab === 1 && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
          {members.length === 0 ? (
            <div className="text-center py-16">
              <Users size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucun membre.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-left">
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Membre</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Niveau</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">ELO</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Matchs</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Wins</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Rejoint le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {members.map((m: any) => {
                  const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
                  const isOwner = p?.id === owner?.id;
                  return (
                    <tr key={m.id} className={cn('hover:bg-white/[0.02] transition-colors', isOwner && 'bg-yellow-500/[0.03]')}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black',
                            isOwner ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-gray-400'
                          )}>
                            {isOwner ? <Crown size={14} /> : p?.username?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <span className="font-bold text-white">{p?.username ?? 'Inconnu'}</span>
                            {isOwner && <span className="ml-2 text-[9px] font-black text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded">OWNER</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-white/5 text-gray-400">
                          {p?.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-black uppercase ${levelColor(p?.level)}`}>{p?.level}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-black text-yellow-500">{p?.elo ?? 0}</span>
                      </td>
                      <td className="px-5 py-4 text-gray-300">{p?.total_matches ?? 0}</td>
                      <td className="px-5 py-4 text-gray-300">{p?.wins ?? 0}</td>
                      <td className="px-5 py-4">
                        {m.status === 'active' ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-lg">Actif</span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-lg">Banni</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {new Date(m.joined_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB: Whiteboard */}
      {tab === 2 && (
        <div className="space-y-4">
          {wods.length === 0 ? (
            <div className="text-center py-16">
              <Dumbbell size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucun WOD publié.</p>
            </div>
          ) : (
            wods.map((wod: any) => {
              const wodScores = getWodScores(wod.id);
              return (
                <div key={wod.id} className="bg-[#111111] border border-white/[0.06] rounded-2xl overflow-hidden">
                  {/* WOD header */}
                  <div className="p-5 border-b border-white/[0.04]">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-white">{wod.title}</h3>
                        {wod.description && (
                          <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap max-h-24 overflow-y-auto">{wod.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                          {wod.wod_type ?? 'custom'}
                        </span>
                        {wod.is_published ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">Publié</span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-lg">Brouillon</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(wod.scheduled_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                      {wod.time_cap_seconds && (
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          {Math.floor(wod.time_cap_seconds / 60)} min
                        </div>
                      )}
                      {wod.rounds && (
                        <div className="flex items-center gap-1">
                          <Hash size={11} />
                          {wod.rounds} rounds
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users size={11} />
                        {wodScores.length} score{wodScores.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Scores leaderboard */}
                  {wodScores.length > 0 && (
                    <div className="divide-y divide-white/[0.03]">
                      {wodScores.map((s: any, idx: number) => {
                        const sp = Array.isArray(s.profile) ? s.profile[0] : s.profile;
                        return (
                          <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black',
                                idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                                idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                                'bg-white/5 text-gray-500'
                              )}>
                                {idx + 1}
                              </span>
                              <span className="text-sm font-semibold text-white">{sp?.username ?? 'Inconnu'}</span>
                              <span className={`text-[10px] font-black uppercase ${levelColor(sp?.level)}`}>{sp?.level}</span>
                              {s.rx && <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">RX</span>}
                            </div>
                            <span className="text-sm font-black text-white">{formatScore(s.score_value, s.score_type)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB: Tournois */}
      {tab === 3 && (
        <div className="space-y-4">
          {competitions.length === 0 ? (
            <div className="text-center py-16">
              <Trophy size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucun tournoi créé pour cette box.</p>
            </div>
          ) : (
            competitions.map((c: any) => (
              <div key={c.id} className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{c.name}</h3>
                    {c.description && <p className="text-xs text-gray-400 mt-1">{c.description}</p>}
                  </div>
                  <span className={cn(
                    'text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg',
                    c.status === 'open' ? 'text-emerald-400 bg-emerald-500/15' :
                    c.status === 'completed' ? 'text-blue-400 bg-blue-500/15' :
                    'text-gray-400 bg-white/5'
                  )}>
                    {c.status === 'open' ? 'En cours' : c.status === 'completed' ? 'Terminé' : c.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </div>
                  {c.max_participants && (
                    <div className="flex items-center gap-1">
                      <Users size={11} />
                      Max {c.max_participants}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 font-semibold shrink-0">{label}</span>
      <span className={cn('text-sm text-white text-right', mono && 'font-mono bg-white/5 px-2 py-0.5 rounded')}>{value}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4 text-center">
      <div className={cn('w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center', bg)}>
        <Icon size={16} className={color} />
      </div>
      <p className="text-xl font-black text-white">{value}</p>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}
