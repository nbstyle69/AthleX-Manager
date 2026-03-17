'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Globe2, ChevronLeft, Pencil, Loader2, Plus, Trash2,
  CheckCircle2, XCircle, Clock, Users, Trophy, Dumbbell, Video,
} from 'lucide-react';

const TABS = ['WODs', 'Participants', 'Scores', 'Classement'] as const;
type Tab = typeof TABS[number];

const STATUS_STYLE: Record<string, string> = {
  draft:  'bg-gray-500/15 text-gray-400',
  open:   'bg-emerald-500/15 text-emerald-400',
  active: 'bg-[#C9A227]/15 text-[#C9A227]',
  closed: 'bg-blue-500/15 text-blue-400',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon', open: 'Ouvert', active: 'En cours', closed: 'Terminé',
};

export default function InterCompDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('WODs');
  const [comp, setComp] = useState<any>(null);
  const [wods, setWods] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const [showWodForm, setShowWodForm] = useState(false);
  const [editingWod, setEditingWod] = useState<any>(null);
  const [wodForm, setWodForm] = useState({
    title: '', description: '', order_index: 1,
    time_cap: '', scoring_type: 'reps', revealed_at: '',
  });
  const [savingWod, setSavingWod] = useState(false);

  const load = useCallback(async () => {
    const [{ data: c }, { data: w }, { data: r }, { data: s }] = await Promise.all([
      supabase.from('inter_competitions').select('*').eq('id', id).single(),
      supabase.from('inter_competition_wods').select('*').eq('competition_id', id).order('order_index'),
      supabase.from('inter_registrations')
        .select('*, athlete:profiles!athlete_id(username, level), team:inter_teams(name)')
        .eq('competition_id', id).order('registered_at', { ascending: false }),
      supabase.from('inter_scores')
        .select('*, athlete:profiles!athlete_id(username, level), wod:inter_competition_wods(title, order_index)')
        .eq('competition_id', id).order('submitted_at', { ascending: false }),
    ]);
    setComp(c);
    setWods(w ?? []);
    setRegistrations((r ?? []).map((x: any) => ({
      ...x,
      athlete: Array.isArray(x.athlete) ? x.athlete[0] : x.athlete,
      team: Array.isArray(x.team) ? x.team[0] : x.team,
    })));
    setScores((s ?? []).map((x: any) => ({
      ...x,
      athlete: Array.isArray(x.athlete) ? x.athlete[0] : x.athlete,
      wod: Array.isArray(x.wod) ? x.wod[0] : x.wod,
    })));
    const { data: st } = await supabase
      .from('inter_standings').select('*').eq('competition_id', id).order('rank');
    setStandings(st ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function openNewWod() {
    setEditingWod(null);
    setWodForm({ title: '', description: '', order_index: wods.length + 1, time_cap: '', scoring_type: 'reps', revealed_at: '' });
    setShowWodForm(true);
  }
  function openEditWod(w: any) {
    setEditingWod(w);
    setWodForm({
      title: w.title, description: w.description ?? '',
      order_index: w.order_index, time_cap: w.time_cap?.toString() ?? '',
      scoring_type: w.scoring_type ?? 'reps',
      revealed_at: w.revealed_at ? w.revealed_at.slice(0, 16) : '',
    });
    setShowWodForm(true);
  }
  async function saveWod(e: React.FormEvent) {
    e.preventDefault();
    setSavingWod(true);
    const payload = {
      competition_id: id, title: wodForm.title,
      description: wodForm.description || null,
      order_index: Number(wodForm.order_index),
      time_cap: wodForm.time_cap ? Number(wodForm.time_cap) : null,
      scoring_type: wodForm.scoring_type,
      revealed_at: wodForm.revealed_at || null,
    };
    if (editingWod) await supabase.from('inter_competition_wods').update(payload).eq('id', editingWod.id);
    else await supabase.from('inter_competition_wods').insert(payload);
    await load();
    setShowWodForm(false);
    setSavingWod(false);
  }
  async function deleteWod(wid: string) {
    if (!confirm('Supprimer ce WOD ?')) return;
    await supabase.from('inter_competition_wods').delete().eq('id', wid);
    await load();
  }
  async function revealNow(w: any) {
    setProcessing(w.id);
    await supabase.from('inter_competition_wods')
      .update({ revealed_at: new Date().toISOString() }).eq('id', w.id);
    await load();
    setProcessing(null);
  }
  async function validateScore(sid: string, action: 'validated' | 'rejected', reason?: string) {
    setProcessing(sid);
    const update: any = { status: action, reviewed_at: new Date().toISOString() };
    if (action === 'rejected' && reason) update.rejection_reason = reason;
    await supabase.from('inter_scores').update(update).eq('id', sid);
    await load();
    setProcessing(null);
  }
  async function removeReg(rid: string) {
    if (!confirm('Retirer ce participant ?')) return;
    await supabase.from('inter_registrations').delete().eq('id', rid);
    await load();
  }
  async function disqualifyReg(rid: string) {
    if (!confirm('Disqualifier ?')) return;
    await supabase.from('inter_registrations').update({ status: 'disqualified' }).eq('id', rid);
    await load();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="text-[#C9A227] animate-spin" />
    </div>
  );
  if (!comp) return <div className="text-center py-24 text-gray-400">Compétition introuvable.</div>;

  const pendingScores = scores.filter(s => s.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/inter-competitions"
            className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div className="w-11 h-11 rounded-xl bg-[#C9A227]/20 flex items-center justify-center">
            <Globe2 size={22} className="text-[#C9A227]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">{comp.title}</h1>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${STATUS_STYLE[comp.status] ?? 'bg-white/5 text-gray-400'}`}>
                {STATUS_LABEL[comp.status] ?? comp.status}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              {comp.format} · {comp.type === 'individual' ? 'Individuel' : `Équipe ×${comp.team_size}`}
              {comp.starts_at && ` · Début ${new Date(comp.starts_at).toLocaleDateString('fr-FR')}`}
            </p>
          </div>
        </div>
        <Link href={`/admin/inter-competitions/new?edit=${comp.id}`}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/8 text-gray-300 hover:text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all">
          <Pencil size={14} /> Modifier
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Inscrits',    val: registrations.length,   icon: Users,    color: '#8B5CF6' },
          { label: 'WODs',        val: `${wods.length}/3`,     icon: Dumbbell, color: '#C9A227' },
          { label: 'Scores',      val: scores.length,          icon: Trophy,   color: '#22C55E' },
          { label: 'En attente',  val: pendingScores.length,   icon: Clock,    color: '#D97706' },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} className="bg-[#111111] border border-white/8 rounded-2xl p-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${color}20` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-2xl font-black text-white">{val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[#111111] border border-white/8 rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all relative ${
              tab === t ? 'bg-[#C9A227] text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t}
            {t === 'Scores' && pendingScores.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {pendingScores.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── WODs ── */}
      {tab === 'WODs' && (
        <div className="space-y-3">
          {wods.map(w => (
            <div key={w.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#C9A227]/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-[#C9A227]">W{w.order_index}</span>
                  </div>
                  <div>
                    <p className="font-bold text-white">{w.title}</p>
                    {w.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{w.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {w.time_cap && <span className="text-[10px] text-gray-500">{w.time_cap} min cap</span>}
                      <span className="text-[10px] text-gray-500 uppercase">{w.scoring_type}</span>
                      {w.revealed_at && w.revealed_at <= new Date().toISOString()
                        ? <span className="text-[10px] font-bold text-emerald-400">✓ Révélé</span>
                        : w.revealed_at
                          ? <span className="text-[10px] text-[#C9A227]">{new Date(w.revealed_at).toLocaleString('fr-FR')}</span>
                          : <span className="text-[10px] text-gray-600">Non révélé</span>
                      }
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {(!w.revealed_at || w.revealed_at > new Date().toISOString()) && (
                    <button onClick={() => revealNow(w)} disabled={processing === w.id}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400 text-xs font-bold transition-colors">
                      {processing === w.id ? <Loader2 size={12} className="animate-spin" /> : 'Révéler ▶'}
                    </button>
                  )}
                  <button onClick={() => openEditWod(w)} className="p-2 rounded-lg bg-[#0A0A0A] hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteWod(w.id)} className="p-2 rounded-lg bg-[#0A0A0A] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {wods.length < 3 && (
            <button onClick={openNewWod}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-white/15 rounded-2xl py-4 text-sm font-semibold text-gray-500 hover:text-white hover:border-white/25 transition-all">
              <Plus size={16} /> Ajouter WOD {wods.length + 1}/3
            </button>
          )}

          {/* WOD Form modal */}
          {showWodForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                <h2 className="text-base font-black text-white mb-4">{editingWod ? 'Modifier le WOD' : 'Nouveau WOD'}</h2>
                <form onSubmit={saveWod} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Titre *</label>
                    <input required value={wodForm.title}
                      onChange={e => setWodForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Ex : WOD 1 — Fran"
                      className="mt-1 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</label>
                    <textarea rows={4} value={wodForm.description}
                      onChange={e => setWodForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Mouvements, reps, consignes..."
                      className="mt-1 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Time cap (min)</label>
                      <input type="number" min="1" value={wodForm.time_cap}
                        onChange={e => setWodForm(p => ({ ...p, time_cap: e.target.value }))}
                        placeholder="20"
                        className="mt-1 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Scoring</label>
                      <select value={wodForm.scoring_type}
                        onChange={e => setWodForm(p => ({ ...p, scoring_type: e.target.value }))}
                        className="mt-1 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50">
                        <option value="reps">Reps</option>
                        <option value="time">Temps</option>
                        <option value="weight">Poids</option>
                        <option value="rounds_reps">Rounds + Reps</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date de révélation</label>
                    <input type="datetime-local" value={wodForm.revealed_at}
                      onChange={e => setWodForm(p => ({ ...p, revealed_at: e.target.value }))}
                      className="mt-1 w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowWodForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-white/8 text-sm font-bold text-gray-400 hover:text-white transition-all">
                      Annuler
                    </button>
                    <button type="submit" disabled={savingWod}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
                      {savingWod ? <Loader2 size={14} className="animate-spin" /> : null}
                      {editingWod ? 'Enregistrer' : 'Créer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Participants ── */}
      {tab === 'Participants' && (
        <div className="space-y-2">
          {registrations.length === 0
            ? <div className="text-center py-16 text-gray-500">Aucun inscrit pour le moment.</div>
            : registrations.map(r => (
              <div key={r.id} className={`bg-[#111111] border rounded-2xl px-5 py-3 flex items-center justify-between gap-3 ${
                r.status === 'disqualified' ? 'border-red-500/20 opacity-60' : 'border-white/8'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#C9A227]/20 flex items-center justify-center text-[#C9A227] text-xs font-black">
                    {(r.athlete?.username ?? r.team?.name ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{r.athlete?.username ?? r.team?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">
                      {r.athlete?.level ?? (r.team ? 'équipe' : '')}
                      {r.status === 'disqualified' && ' · ⛔ Disqualifié'}
                    </p>
                  </div>
                </div>
                {r.status !== 'disqualified' && (
                  <div className="flex gap-1.5">
                    <button onClick={() => disqualifyReg(r.id)} title="Disqualifier"
                      className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-xs font-bold transition-colors">
                      DQ
                    </button>
                    <button onClick={() => removeReg(r.id)}
                      className="p-1.5 rounded-lg bg-[#0A0A0A] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* ── Scores ── */}
      {tab === 'Scores' && (
        <div className="space-y-3">
          {scores.length === 0
            ? <div className="text-center py-16 text-gray-500">Aucun score soumis.</div>
            : scores.map(s => (
              <div key={s.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#C9A227]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-[#C9A227]">W{s.wod?.order_index ?? '?'}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{s.athlete?.username ?? '—'}</p>
                      <p className="text-xs text-gray-500">{s.wod?.title ?? '—'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-black text-[#C9A227]">{s.score_display ?? s.score_value}</span>
                        {s.video_url && (
                          <a href={s.video_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                            <Video size={11} /> Voir vidéo
                          </a>
                        )}
                      </div>
                      {s.notes && <p className="text-xs text-gray-600 mt-1 italic">{s.notes}</p>}
                      {s.status === 'rejected' && s.rejection_reason &&
                        <p className="text-xs text-red-400 mt-1">Motif : {s.rejection_reason}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {s.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => validateScore(s.id, 'validated')}
                          disabled={processing === s.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold transition-colors disabled:opacity-40">
                          {processing === s.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Valider
                        </button>
                        <button
                          onClick={async () => {
                            const reason = prompt('Motif de rejet (optionnel) :') ?? undefined;
                            await validateScore(s.id, 'rejected', reason);
                          }}
                          disabled={processing === s.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-bold transition-colors disabled:opacity-40">
                          <XCircle size={12} /> Rejeter
                        </button>
                      </div>
                    )}
                    {s.status === 'validated' && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded-lg px-2 py-1">✓ Validé</span>}
                    {s.status === 'rejected'  && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 rounded-lg px-2 py-1">✗ Rejeté</span>}
                    <span className="text-[10px] text-gray-600">{new Date(s.submitted_at).toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Classement ── */}
      {tab === 'Classement' && (
        <div className="space-y-4">
          {wods.length === 0
            ? <div className="text-center py-16 text-gray-500">Aucun WOD créé.</div>
            : wods.map(w => {
              const ws = standings.filter(s => s.wod_id === w.id);
              return (
                <div key={w.id} className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
                    <span className="text-xs font-black text-[#C9A227] bg-[#C9A227]/10 rounded-lg px-2 py-0.5">WOD {w.order_index}</span>
                    <span className="text-sm font-bold text-white">{w.title}</span>
                  </div>
                  {ws.length === 0
                    ? <p className="text-sm text-gray-600 px-5 py-4">Aucun score validé.</p>
                    : <div className="divide-y divide-white/[0.04]">
                      {ws.map(s => (
                        <div key={s.athlete_id ?? s.team_id}
                          className={`flex items-center gap-4 px-5 py-3 ${s.rank <= 3 ? 'bg-[#C9A227]/[0.03]' : ''}`}>
                          <span className={`w-8 text-center text-sm font-black ${
                            s.rank === 1 ? 'text-[#C9A227]' : s.rank === 2 ? 'text-gray-300' : s.rank === 3 ? 'text-amber-600' : 'text-gray-500'
                          }`}>
                            {s.rank <= 3 ? ['🥇','🥈','🥉'][s.rank - 1] : s.rank}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">{s.username ?? '—'}</p>
                            <p className="text-xs text-gray-500">{s.box_name ?? 'Box inconnue'}</p>
                          </div>
                          <span className="text-sm font-black text-[#C9A227]">{s.score_display ?? s.score_value}</span>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}
