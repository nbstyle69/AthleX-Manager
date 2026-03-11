'use client';

import { useState } from 'react';
import { Trophy, Dumbbell, Star } from 'lucide-react';
import type { ParticipantRow, WodRanking } from './page';

interface Props {
  general: ParticipantRow[];
  wodRankings: WodRanking[];
}

const MEDAL = ['🥇', '🥈', '🥉'];
const LEVEL_COLORS: Record<string, string> = {
  scaled: '#6B7280', inter: '#3B82F6', rx: '#16A34A',
  'rx+': '#C9A227', gx: '#8B5CF6', pro: '#EF4444',
};

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) return <span className="text-xl w-9 text-center">{MEDAL[rank - 1]}</span>;
  return <span className="w-9 text-center text-sm font-black text-gray-500">#{rank}</span>;
}

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const color = LEVEL_COLORS[level] ?? '#6B7280';
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
      style={{ backgroundColor: `${color}20`, color }}>
      {level}
    </span>
  );
}

export default function LeaderboardClient({ general, wodRankings }: Props) {
  const tabs = ['general', ...wodRankings.map((_, i) => `wod_${i}`)];
  const [activeTab, setActiveTab] = useState('general');

  const tabLabel = (t: string) => {
    if (t === 'general') return 'Général';
    const idx = parseInt(t.split('_')[1]);
    return `WOD ${idx + 1}`;
  };

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl border transition-colors ${
              activeTab === t
                ? t === 'general'
                  ? 'bg-[#C9A227] border-[#C9A227] text-white'
                  : 'bg-blue-600 border-blue-600 text-white'
                : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
            }`}>
            {t === 'general' ? <Trophy size={13} /> : <Dumbbell size={13} />}
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {/* ── GÉNÉRAL ── */}
      {activeTab === 'general' && (
        <>
          {general.length === 0 ? (
            <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
              <Trophy size={36} className="text-[#C9A227]/40 mx-auto mb-3" />
              <p className="text-white font-bold">Aucun score validé</p>
              <p className="text-xs text-gray-500 mt-1">Le classement apparaîtra après les premières validations.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {general.map(p => (
                <div key={p.athlete_id}
                  className={`flex items-center gap-3 bg-[#111111] border rounded-2xl px-5 py-4 ${
                    p.rank === 1 ? 'border-[#C9A227]/30' :
                    p.rank === 2 ? 'border-gray-400/20' :
                    p.rank === 3 ? 'border-orange-700/20' : 'border-white/8'
                  }`}>
                  <RankBadge rank={p.rank} />
                  <div className="w-9 h-9 rounded-full bg-[#C9A227]/20 flex items-center justify-center text-[#C9A227] text-sm font-black shrink-0">
                    {(p.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{p.username ?? '?'}</p>
                      <LevelBadge level={p.level} />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star size={10} className="text-[#C9A227]" />
                      <p className="text-xs text-gray-500">ELO {p.elo ?? 1000}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-black text-white">{p.total_score}</p>
                    <p className="text-[10px] text-gray-500 font-semibold">pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── PAR WOD ── */}
      {wodRankings.map((wod, idx) => activeTab === `wod_${idx}` && (
        <div key={wod.wod_id} className="space-y-4">
          <div className="bg-[#111111] border border-white/8 rounded-2xl px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Dumbbell size={14} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">WOD {idx + 1}</p>
              <p className="text-sm font-black text-white">{wod.wod_title}</p>
            </div>
          </div>

          {wod.scores.length === 0 ? (
            <div className="bg-[#111111] border border-white/8 rounded-2xl p-10 text-center">
              <p className="text-white font-bold">Aucun score validé pour ce WOD</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wod.scores.map(s => (
                <div key={s.athlete_id}
                  className={`flex items-center gap-3 bg-[#111111] border rounded-2xl px-5 py-4 ${
                    s.rank === 1 ? 'border-[#C9A227]/30' :
                    s.rank === 2 ? 'border-gray-400/20' :
                    s.rank === 3 ? 'border-orange-700/20' : 'border-white/8'
                  }`}>
                  <RankBadge rank={s.rank} />
                  <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-400 text-sm font-black shrink-0">
                    {(s.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{s.username ?? '?'}</p>
                      <LevelBadge level={s.level} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-black text-white">{s.score_value}</p>
                    <p className="text-[10px] text-gray-500 font-semibold">score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
