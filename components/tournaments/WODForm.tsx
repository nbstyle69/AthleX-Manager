'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Loader2, X, Sparkles, ChevronDown, ChevronUp, Timer } from 'lucide-react';

const WOD_TYPES = ['AMRAP', 'For Time', 'EMOM', 'Tabata', 'Max Reps', 'Strength'];
const LEVELS    = ['scaled', 'inter', 'rx', 'rx+', 'gx', 'pro'];
const EQUIPMENT = ['Barre olympique', 'Haltères', 'Kettlebell', 'Barre de traction', 'Anneaux', 'Rameur', 'Vélo assault', 'Corde à sauter', 'Box', 'Sac de sable', 'Médecine ball', 'GHD'];
const DURATIONS = [5, 8, 10, 12, 15, 20, 25, 30];

const WOD_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'active',  label: 'Ouvert' },
  { value: 'closed',  label: 'Fermé' },
];

function timerInfoForType(type: string, form: any) {
  switch (type) {
    case 'For Time':  return `⏱ Countdown ${form.time_cap ?? 20} min → 0 (score = temps)`;
    case 'AMRAP':     return `⏱ Stopwatch 0 → ${form.duration_minutes} min (score = rounds+reps)`;
    case 'EMOM':      return `⏱ EMOM ${form.rounds ?? form.duration_minutes} rounds × 1 min`;
    case 'Tabata':    return `⚡ ${form.work_seconds ?? 20}s travail / ${form.rest_seconds ?? 10}s repos × ${form.rounds ?? 8} rounds`;
    case 'Max Reps':  return `⏱ Countdown ${form.time_cap ?? 10} min (score = reps totaux)`;
    case 'Strength':  return `💪 Pas de timer — score = charge max`;
    default: return '';
  }
}

// ── Local WOD Generation Engine ─────────────────────────────────────────
const LI: Record<string, number> = { scaled: 0, inter: 1, rx: 2, 'rx+': 3, gx: 4, pro: 5 };

interface MvDef { name: string; eq: string[]; reps: number[]; load?: string[] }

const MVTS: MvDef[] = [
  // Barre olympique
  { name: 'Thrusters',          eq: ['Barre olympique'], reps: [8,10,12,15,15,18], load: ['30/20','40/28','43/30','50/35','60/42','70/48'] },
  { name: 'Clean & Jerk',       eq: ['Barre olympique'], reps: [5,7,9,10,12,15], load: ['30/20','43/30','60/43','70/48','80/55','102/70'] },
  { name: 'Power Cleans',       eq: ['Barre olympique'], reps: [6,8,10,12,12,15], load: ['40/28','50/35','60/43','70/48','80/55','90/63'] },
  { name: 'Squat Cleans',       eq: ['Barre olympique'], reps: [0,5,7,9,10,12], load: ['','45/32','60/43','70/48','80/55','90/63'] },
  { name: 'Power Snatches',     eq: ['Barre olympique'], reps: [5,7,9,10,12,15], load: ['20/15','35/25','50/35','60/42','70/50','85/60'] },
  { name: 'Deadlifts',          eq: ['Barre olympique'], reps: [8,10,12,15,15,18], load: ['70/50','100/70','120/80','140/95','160/110','180/120'] },
  { name: 'Front Squats',       eq: ['Barre olympique'], reps: [6,8,10,12,12,15], load: ['40/28','55/38','70/48','85/58','100/68','120/80'] },
  { name: 'OHS',                eq: ['Barre olympique'], reps: [0,5,8,10,12,15], load: ['','35/25','50/35','60/42','70/48','80/55'] },
  { name: 'Push Press',         eq: ['Barre olympique'], reps: [6,8,10,12,12,15], load: ['30/20','40/28','50/35','60/42','70/48','80/55'] },
  { name: 'Shoulder to OH',     eq: ['Barre olympique'], reps: [6,8,10,12,12,15], load: ['25/18','35/25','45/32','55/38','65/45','75/50'] },
  { name: 'Hang Squat Cleans',  eq: ['Barre olympique'], reps: [0,5,7,9,10,12], load: ['','40/28','50/35','60/42','70/48','80/55'] },
  { name: 'Sumo Deadlift HP',   eq: ['Barre olympique'], reps: [6,8,10,12,12,15], load: ['25/18','30/20','35/25','40/28','50/35','55/38'] },
  // Haltères
  { name: 'DB Thrusters',       eq: ['Haltères'], reps: [6,8,10,12,15,18], load: ['10/7','15/10','20/14','22/15','25/17','30/20'] },
  { name: 'DB Snatches alt.',   eq: ['Haltères'], reps: [8,10,12,15,18,21], load: ['10/7','15/10','20/14','22/15','25/17','30/20'] },
  { name: "Devil's Press",      eq: ['Haltères'], reps: [4,6,8,10,12,15], load: ['10/7','15/10','20/14','22/15','25/17','30/20'] },
  { name: 'DB Clean & Jerk',    eq: ['Haltères'], reps: [6,8,10,12,15,18], load: ['10/7','15/10','20/14','22/15','25/17','30/20'] },
  { name: 'DB Lunges',          eq: ['Haltères'], reps: [8,10,12,16,20,24], load: ['10/7','15/10','20/14','22/15','25/17','30/20'] },
  // Kettlebell
  { name: 'KB Swings',          eq: ['Kettlebell'], reps: [12,15,18,21,24,30], load: ['16/12','20/16','24/16','28/20','32/24','36/28'] },
  { name: 'Goblet Squats',      eq: ['Kettlebell'], reps: [8,10,12,15,18,21], load: ['16/12','20/16','24/16','28/20','32/24','36/28'] },
  { name: 'KB Snatches alt.',   eq: ['Kettlebell'], reps: [6,8,10,12,15,18], load: ['16/12','20/16','24/16','28/20','32/24','36/28'] },
  { name: 'Turkish Get-ups',    eq: ['Kettlebell'], reps: [2,3,4,5,6,8], load: ['10/8','14/10','16/12','20/14','24/16','28/20'] },
  // Barre de traction
  { name: 'Pull-ups',           eq: ['Barre de traction'], reps: [5,8,10,12,15,18] },
  { name: 'Chest-to-Bar',       eq: ['Barre de traction'], reps: [0,0,8,10,12,15] },
  { name: 'Toes to Bar',        eq: ['Barre de traction'], reps: [5,8,10,12,15,18] },
  { name: 'Bar Muscle-ups',     eq: ['Barre de traction'], reps: [0,0,0,3,5,7] },
  { name: 'HSPU',               eq: ['Barre de traction'], reps: [0,3,5,7,10,12] },
  // Anneaux
  { name: 'Ring Dips',          eq: ['Anneaux'], reps: [3,5,8,10,12,15] },
  { name: 'Ring Muscle-ups',    eq: ['Anneaux'], reps: [0,0,0,2,4,6] },
  { name: 'Ring Rows',          eq: ['Anneaux'], reps: [8,10,12,15,15,18] },
  // Rameur
  { name: 'Cal Rameur',         eq: ['Rameur'], reps: [10,12,15,18,20,25] },
  { name: 'Row (m)',            eq: ['Rameur'], reps: [200,250,300,400,500,750] },
  // Vélo assault
  { name: 'Cal Assault Bike',   eq: ['Vélo assault'], reps: [8,10,12,15,18,22] },
  // Corde à sauter
  { name: 'Double Unders',      eq: ['Corde à sauter'], reps: [0,20,30,40,50,60] },
  { name: 'Cross Overs',        eq: ['Corde à sauter'], reps: [0,0,10,15,20,25] },
  // Box
  { name: 'Box Jumps',          eq: ['Box'], reps: [10,12,15,18,20,24] },
  { name: 'Box Jump Overs',     eq: ['Box'], reps: [8,10,12,15,18,21] },
  // Sac de sable
  { name: 'Sandbag Cleans',     eq: ['Sac de sable'], reps: [5,7,10,12,15,18], load: ['20','30','40','50','60','70'] },
  // Médecine ball
  { name: 'Wall Balls',         eq: ['Médecine ball'], reps: [12,15,18,21,25,30], load: ['6/4','7/5','9/6','10/7','12/9','14/10'] },
  { name: 'MB Slams',           eq: ['Médecine ball'], reps: [8,10,12,15,18,21], load: ['6','8','9','10','12','14'] },
  // GHD
  { name: 'GHD Sit-ups',        eq: ['GHD'], reps: [8,12,15,18,21,25] },
  { name: 'GHD Hip Extensions', eq: ['GHD'], reps: [8,10,12,15,18,21] },
  // Bodyweight (toujours dispo)
  { name: 'Burpees',            eq: [], reps: [5,8,10,12,15,18] },
  { name: 'Air Squats',         eq: [], reps: [12,15,20,25,30,40] },
  { name: 'Push-ups',           eq: [], reps: [8,10,15,18,21,25] },
  { name: 'Sit-ups',            eq: [], reps: [10,12,15,18,21,25] },
  { name: 'Lunges',             eq: [], reps: [10,12,16,20,24,30] },
  { name: 'Wall Walks',         eq: [], reps: [0,1,2,3,4,5] },
];

const WOD_NAMES: Record<string, string[]> = {
  'AMRAP':    ['Endless Engine','Non-Stop','The Grind','Reactor','Pulse','Dynamo','Voltage','Overdrive','Cyclone','Fuel'],
  'For Time': ['Iron Fist','Steel Storm','War Machine','Fire Breather','The Crusher','Ground Zero','Full Send','Red Line','Forge','Inferno'],
  'EMOM':     ['Clockwork','Metronome','Rhythm','Steady State','Tempo','The Beat','Chronos','Sequence','Epoch','The Grid'],
  'Tabata':   ['Tabata Terror','Short Fuse','Blast','Thunder','Lightning','Shock','Impact','Explosion','Strike','Hammer'],
  'Max Reps': ['Peak','Limit Tester','Max Out','The Summit','Threshold','Pinnacle','Zenith','Apex','Top Out','Redline'],
  'Strength': ['Heavy Day','PR Hunt','Max Effort','The Forge','Iron Will','Bone Crusher','Heavy Metal','The Test','Beast Mode','Power Hour'],
};

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pick<T>(arr: T[], n: number): T[] {
  const c = [...arr]; const r: T[] = [];
  for (let i = 0; i < Math.min(n, c.length); i++) { const idx = Math.floor(Math.random() * c.length); r.push(c.splice(idx, 1)[0]); }
  return r;
}

function fmtMv(m: MvDef, li: number): string {
  const r = m.reps[li];
  if (r === 0) return '';
  const ld = m.load?.[li];
  if (m.name === 'Row (m)') return `${r}m Rameur`;
  if (m.name.startsWith('Cal ')) return `${r} ${m.name}`;
  if (ld) return `${r} ${m.name} (${ld} kg)`;
  return `${r} ${m.name}`;
}

function fmtMvLabel(m: MvDef, li: number): string {
  const ld = m.load?.[li];
  if (ld) return `${m.name} (${ld} kg)`;
  return m.name;
}

function localGenerate(type: string, level: string, duration: number, eqList: string[]) {
  const li = LI[level] ?? 2;
  const pool = MVTS.filter(m => {
    if (m.reps[li] === 0) return false;
    if (m.eq.length === 0) return true;
    return m.eq.some(e => eqList.includes(e));
  });
  if (pool.length === 0) return null;

  // Force at least 1 move per selected equipment
  const forced: MvDef[] = [];
  for (const eq of eqList) {
    const eqPool = pool.filter(m => m.eq.includes(eq) && !forced.includes(m));
    if (eqPool.length > 0) forced.push(rand(eqPool));
  }
  const pickForced = (n: number): MvDef[] => {
    const need = Math.max(0, n - forced.length);
    const rem = pool.filter(m => !forced.includes(m));
    const extra = pick(rem, Math.min(need, rem.length));
    const res = [...forced, ...extra];
    for (let i = res.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [res[i], res[j]] = [res[j], res[i]]; }
    return res.slice(0, n);
  };

  const title = rand(WOD_NAMES[type] ?? WOD_NAMES['AMRAP']);
  let movements: string[] = [];
  let scoring = '';
  let description = '';
  let timer_type = 'stopwatch';
  let time_cap_seconds: number | null = null;
  let rounds: number | null = null;
  let work_seconds: number | null = null;
  let rest_seconds: number | null = null;
  let duration_minutes = duration;

  switch (type) {
    case 'AMRAP': {
      const count = duration <= 8 ? 3 : duration <= 15 ? rand([3,4]) : rand([4,5]);
      movements = pickForced(count).map(m => fmtMv(m, li)).filter(Boolean);
      scoring = `Max rounds + reps en ${duration} min`;
      description = `AMRAP ${duration} min — Enchaîne les mouvements, note ton score (rounds + reps).`;
      timer_type = 'stopwatch';
      time_cap_seconds = duration * 60;
      break;
    }
    case 'For Time': {
      const style = Math.random();
      if (style < 0.35) {
        const r = duration <= 8 ? 3 : duration <= 15 ? rand([3,4,5]) : rand([4,5,6]);
        const mvs = pickForced(3);
        movements = [`${r} Rounds For Time :`, ...mvs.map(m => fmtMv(m, li)).filter(Boolean)];
        scoring = `Temps total (cap ${duration} min)`;
        description = `${r} rounds for time — Termine le plus vite possible.`;
      } else if (style < 0.7) {
        const count = duration <= 8 ? 3 : duration <= 15 ? rand([4,5]) : rand([5,6,7]);
        const mvs = pickForced(count);
        const repMult = duration <= 10 ? [1,1.5,1,1.2,1] : [1.5,2,1.5,2,1,1.5,1];
        movements = mvs.map((m, i) => {
          const mult = repMult[i % repMult.length];
          const r = Math.round(m.reps[li] * mult);
          const ld = m.load?.[li];
          if (m.name === 'Row (m)') return `${r}m Rameur`;
          if (m.name.startsWith('Cal ')) return `${r} ${m.name}`;
          return ld ? `${r} ${m.name} (${ld} kg)` : `${r} ${m.name}`;
        }).filter(Boolean);
        scoring = `Chipper — Temps total (cap ${duration} min)`;
        description = `Chipper : enchaîne tout sans round. Sprint mode.`;
      } else {
        const scheme = duration <= 10 ? rand(['21-15-9','15-12-9']) : rand(['21-15-9','30-20-10']);
        const mvs = pickForced(2);
        movements = [`${scheme} :`, ...mvs.map(m => fmtMvLabel(m, li))];
        scoring = `${scheme} — Temps total (cap ${duration} min)`;
        description = `Scheme ${scheme} — Reps décroissantes, vitesse maximale.`;
      }
      timer_type = 'countdown';
      time_cap_seconds = duration * 60;
      break;
    }
    case 'EMOM': {
      const mins = duration <= 8 ? 2 : duration <= 12 ? 3 : rand([3,4]);
      const mvs = pickForced(mins);
      movements = mvs.map((m, i) => `Min ${i+1}: ${fmtMv(m, li)}`).filter(Boolean);
      scoring = `E${mins}MOM × ${duration} min — Score = rounds complétés`;
      description = `EMOM ${duration} min (cycle de ${mins} min) — Finis chaque minute avec 15s de repos.`;
      timer_type = 'emom';
      time_cap_seconds = duration * 60;
      rounds = duration;
      break;
    }
    case 'Tabata': {
      const count = rand([3,4,5]);
      const mvs = pickForced(count);
      movements = mvs.map(m => `20s ${m.name} / 10s repos × 8`);
      scoring = `Score = total de reps`;
      description = `Tabata — ${count} mouvements, 8 rounds de 20s travail / 10s repos chacun.`;
      timer_type = 'tabata';
      rounds = 8;
      work_seconds = 20;
      rest_seconds = 10;
      duration_minutes = count * 4;
      break;
    }
    case 'Max Reps': {
      const mvs = pickForced(rand([1,2]));
      movements = mvs.map(m => `Max ${fmtMvLabel(m, li)} en ${mvs.length === 1 ? duration : Math.floor(duration/mvs.length)} min`);
      scoring = `Score = total de reps`;
      description = `Max reps en ${duration} min — Pousse au maximum.`;
      timer_type = 'countdown';
      time_cap_seconds = duration * 60;
      break;
    }
    case 'Strength': {
      const mvs = pickForced(rand([1,2]));
      movements = mvs.map(m => `5 × 3 ${fmtMvLabel(m, li)} (montée en charge)`);
      scoring = `Score = charge max`;
      description = `Force — Montée progressive en charge. Repos 2-3 min entre les séries.`;
      timer_type = 'none';
      break;
    }
  }

  return { title, movements: movements.filter(Boolean), scoring, description, timer_type, time_cap_seconds, rounds, work_seconds, rest_seconds, duration_minutes };
}

// ─────────────────────────────────────────────────────────────────────────

interface Props {
  tournamentId: string;
  initial?: any;
  onSaved: () => void;
  onCancel: () => void;
}

export default function WODForm({ tournamentId, initial, onSaved, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [form, setForm] = useState({
    title:            initial?.title            ?? '',
    description:      initial?.description      ?? '',
    type:             initial?.type             ?? 'AMRAP',
    duration_minutes: initial?.duration_minutes ?? 12,
    scoring:          initial?.scoring          ?? '',
    deadline_hours:   initial?.deadline_hours   ?? 24,
    status:           initial?.status           ?? 'pending',
    opens_at:         initial?.opens_at         ?? '',
    closes_at:        initial?.closes_at        ?? '',
    timer_type:       initial?.timer_type       ?? 'stopwatch',
    time_cap:         initial?.time_cap_seconds ? Math.floor(initial.time_cap_seconds / 60) : 20,
    rounds:           initial?.rounds           ?? 8,
    work_seconds:     initial?.work_seconds     ?? 20,
    rest_seconds:     initial?.rest_seconds     ?? 10,
  });

  const [movements, setMovements] = useState<string[]>(
    Array.isArray(initial?.movements) ? initial.movements : []
  );

  // AI Generator state
  const [showGen,      setShowGen]      = useState(false);
  const [genLoading,   setGenLoading]   = useState(false);
  const [genLevel,     setGenLevel]     = useState('rx');
  const [genType,      setGenType]      = useState('AMRAP');
  const [genDuration,  setGenDuration]  = useState(12);
  const [genEquipment, setGenEquipment] = useState<string[]>(['Barre olympique', 'Barre de traction', 'Haltères']);
  const [genError,     setGenError]     = useState<string | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  function onTypeChange(type: string) {
    const timerMap: Record<string, string> = {
      'AMRAP':    'stopwatch',
      'For Time': 'countdown',
      'EMOM':     'emom',
      'Tabata':   'tabata',
      'Max Reps': 'countdown',
      'Strength': 'none',
    };
    setForm(f => ({ ...f, type, timer_type: timerMap[type] ?? 'stopwatch' }));
  }

  function toggleEquipment(eq: string) {
    setGenEquipment(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]);
  }

  function addMovement()                 { setMovements(m => [...m, '']); }
  function removeMovement(i: number)     { setMovements(m => m.filter((_, idx) => idx !== i)); }
  function setMovement(i: number, v: string) { setMovements(m => m.map((x, idx) => idx === i ? v : x)); }

  function generateWOD() {
    setGenLoading(true);
    setGenError(null);
    try {
      const data = localGenerate(genType, genLevel, genDuration, genEquipment);
      if (!data) { setGenError('Pas assez de mouvements disponibles pour cet équipement.'); return; }

      const timerMap: Record<string, string> = {
        'AMRAP': 'stopwatch', 'For Time': 'countdown', 'EMOM': 'emom',
        'Tabata': 'tabata', 'Max Reps': 'countdown', 'Strength': 'none',
      };

      setForm(f => ({
        ...f,
        title:           data.title,
        description:     data.description,
        scoring:         data.scoring,
        type:            genType,
        timer_type:      timerMap[genType] ?? 'stopwatch',
        duration_minutes: data.duration_minutes ?? genDuration,
        time_cap:        data.time_cap_seconds ? Math.floor(data.time_cap_seconds / 60) : genDuration,
        rounds:          data.rounds ?? f.rounds,
        work_seconds:    data.work_seconds ?? f.work_seconds,
        rest_seconds:    data.rest_seconds ?? f.rest_seconds,
      }));
      setMovements(data.movements);
      setShowGen(false);
    } catch (e: any) {
      setGenError(e.message ?? 'Erreur inconnue');
    } finally {
      setGenLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const timeCap = (form.type === 'For Time' || form.type === 'AMRAP' || form.type === 'EMOM' || form.type === 'Max Reps')
      ? (form.type === 'AMRAP' ? form.duration_minutes * 60 : form.time_cap * 60)
      : null;

    const payload = {
      tournament_id:    tournamentId,
      title:            form.title,
      description:      form.description,
      type:             form.type,
      duration_minutes: form.type === 'AMRAP' || form.type === 'EMOM' ? form.duration_minutes : form.time_cap,
      scoring:          form.scoring,
      deadline_hours:   form.deadline_hours,
      status:           form.status,
      opens_at:         form.opens_at  || null,
      closes_at:        form.closes_at || null,
      movements:        movements.filter(Boolean),
      timer_type:       form.timer_type,
      time_cap_seconds: timeCap,
      rounds:           ['EMOM', 'Tabata'].includes(form.type) ? form.rounds : null,
      work_seconds:     form.type === 'Tabata' ? form.work_seconds : null,
      rest_seconds:     form.type === 'Tabata' ? form.rest_seconds : null,
    };

    let err;
    if (initial?.id) {
      ({ error: err } = await supabase.from('tournament_wods').update(payload).eq('id', initial.id));
    } else {
      ({ error: err } = await supabase.from('tournament_wods').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A227] transition-colors';
  const lbl = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

      {/* ── AI Generator panel ── */}
      <div className="border border-[#C9A227]/30 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowGen(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 bg-[#C9A227]/10 hover:bg-[#C9A227]/15 transition-colors text-left">
          <Sparkles size={15} className="text-[#C9A227]" />
          <span className="text-sm font-bold text-[#C9A227]">Générer avec l&apos;IA</span>
          <span className="ml-auto text-gray-500">{showGen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
        </button>

        {showGen && (
          <div className="p-4 space-y-4 bg-[#0A0A0A]/50">
            {/* Type + Level row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Type de WOD</label>
                <select className={inp} value={genType} onChange={e => setGenType(e.target.value)}>
                  {WOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Niveau athlètes</label>
                <select className={inp} value={genLevel} onChange={e => setGenLevel(e.target.value)}>
                  {LEVELS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
              </div>
            </div>

            {/* Duration */}
            {genType !== 'Strength' && (
              <div>
                <label className={lbl}>
                  {genType === 'For Time' || genType === 'Max Reps' ? 'Time Cap (minutes)' : genType === 'EMOM' ? 'Durée totale (minutes)' : 'Durée (minutes)'}
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DURATIONS.map(d => (
                    <button key={d} type="button" onClick={() => setGenDuration(d)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                        genDuration === d
                          ? 'bg-[#C9A227]/20 border-[#C9A227]/40 text-[#C9A227]'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                      }`}>{d} min</button>
                  ))}
                </div>
              </div>
            )}

            {/* Equipment */}
            <div>
              <label className={lbl}>Équipement disponible</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {EQUIPMENT.map(eq => (
                  <button key={eq} type="button" onClick={() => toggleEquipment(eq)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                      genEquipment.includes(eq)
                        ? 'bg-[#C9A227]/20 border-[#C9A227]/40 text-[#C9A227]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}>{eq}</button>
                ))}
              </div>
            </div>

            {genError && <p className="text-xs text-red-400">{genError}</p>}

            <button type="button" onClick={generateWOD} disabled={genLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] text-white disabled:opacity-60 transition-colors">
              {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {genLoading ? 'Génération en cours...' : 'Générer le WOD'}
            </button>
          </div>
        )}
      </div>

      {/* ── Identity ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Titre *</label>
          <input className={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Fire Breather" required />
        </div>
        <div>
          <label className={lbl}>Type de WOD</label>
          <select className={inp} value={form.type} onChange={e => onTypeChange(e.target.value)}>
            {WOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Statut</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {WOD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Timer config (adapts to type) ── */}
      <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <Timer size={14} className="text-[#C9A227]" />
          <span className="text-xs font-bold text-[#C9A227] uppercase tracking-wider">Configuration Timer</span>
        </div>
        <p className="text-xs text-gray-500 italic">{timerInfoForType(form.type, form)}</p>

        {(form.type === 'AMRAP' || form.type === 'EMOM') && (
          <div>
            <label className={lbl}>{form.type === 'EMOM' ? 'Nombre de rounds (1 round = 1 min)' : 'Durée (minutes)'}</label>
            <input type="number" min={1} max={120} className={inp}
              value={form.duration_minutes} onChange={e => set('duration_minutes', parseInt(e.target.value))} />
          </div>
        )}
        {(form.type === 'For Time' || form.type === 'Max Reps') && (
          <div>
            <label className={lbl}>Time Cap (minutes)</label>
            <input type="number" min={1} max={120} className={inp}
              value={form.time_cap} onChange={e => set('time_cap', parseInt(e.target.value))} />
          </div>
        )}
        {form.type === 'Tabata' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Travail (sec)</label>
              <input type="number" min={5} max={60} className={inp}
                value={form.work_seconds} onChange={e => set('work_seconds', parseInt(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Repos (sec)</label>
              <input type="number" min={5} max={60} className={inp}
                value={form.rest_seconds} onChange={e => set('rest_seconds', parseInt(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Rounds</label>
              <input type="number" min={1} max={32} className={inp}
                value={form.rounds} onChange={e => set('rounds', parseInt(e.target.value))} />
            </div>
          </div>
        )}
      </div>

      {/* ── Description ── */}
      <div>
        <label className={lbl}>Description</label>
        <textarea className={`${inp} min-h-[70px] resize-y`} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Instructions du WOD..." />
      </div>

      {/* ── Movements ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={lbl}>Programme / Mouvements</label>
          <button type="button" onClick={addMovement} className="text-xs text-[#C9A227] font-semibold flex items-center gap-1 hover:opacity-80">
            <Plus size={12} /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {movements.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${inp} flex-1`} value={m} onChange={e => setMovement(i, e.target.value)}
                placeholder="ex: 21 Thrusters 43kg (Rx) / 30kg (Scaled)" />
              <button type="button" onClick={() => removeMovement(i)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {movements.length === 0 && (
            <button type="button" onClick={addMovement}
              className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-gray-600 hover:border-[#C9A227]/30 hover:text-[#C9A227]/60 transition-colors">
              + Ajouter un mouvement
            </button>
          )}
        </div>
      </div>

      {/* ── Scoring + scheduling ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Scoring</label>
          <input className={inp} value={form.scoring} onChange={e => set('scoring', e.target.value)} placeholder="ex: Score = temps total (cap 20 min)" />
        </div>
        <div>
          <label className={lbl}>Ouverture programmée</label>
          <input type="datetime-local" className={inp} value={form.opens_at} onChange={e => set('opens_at', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Fermeture programmée</label>
          <input type="datetime-local" className={inp} value={form.closes_at} onChange={e => set('closes_at', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Délai soumission (h)</label>
          <input type="number" min={1} max={720} className={inp} value={form.deadline_hours} onChange={e => set('deadline_hours', parseInt(e.target.value))} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors flex items-center gap-1.5">
          <X size={13} /> Annuler
        </button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] text-white disabled:opacity-60 transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {initial?.id ? 'Mettre à jour' : 'Ajouter le WOD'}
        </button>
      </div>
    </form>
  );
}
