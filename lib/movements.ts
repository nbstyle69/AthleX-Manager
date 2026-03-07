export const MOVEMENT_BADGE_LEVELS = [
  { level: 1, reps: 100,   label: 'Bronze',   emoji: '🥉', color: '#A0714F' },
  { level: 2, reps: 500,   label: 'Argent',   emoji: '🥈', color: '#9E9E9E' },
  { level: 3, reps: 1000,  label: 'Or',       emoji: '🥇', color: '#C9A227' },
  { level: 4, reps: 5000,  label: 'Platine',  emoji: '💎', color: '#67E8F9' },
  { level: 5, reps: 10000, label: 'Légend',   emoji: '👑', color: '#A855F7' },
];

const MOVEMENT_ALIASES: Record<string, { key: string; label: string }> = {
  'thruster': { key: 'thruster', label: 'Thruster' },
  'thrusters': { key: 'thruster', label: 'Thruster' },
  'pull-up': { key: 'pullup', label: 'Pull-up' },
  'pull up': { key: 'pullup', label: 'Pull-up' },
  'pullup': { key: 'pullup', label: 'Pull-up' },
  'pullups': { key: 'pullup', label: 'Pull-up' },
  'burpee': { key: 'burpee', label: 'Burpee' },
  'burpees': { key: 'burpee', label: 'Burpee' },
  'clean': { key: 'clean', label: 'Clean' },
  'cleans': { key: 'clean', label: 'Clean' },
  'snatch': { key: 'snatch', label: 'Snatch' },
  'deadlift': { key: 'deadlift', label: 'Deadlift' },
  'deadlifts': { key: 'deadlift', label: 'Deadlift' },
  'box jump': { key: 'boxjump', label: 'Box Jump' },
  'box jumps': { key: 'boxjump', label: 'Box Jump' },
  'double under': { key: 'doubleunder', label: 'Double Under' },
  'double unders': { key: 'doubleunder', label: 'Double Under' },
  'push up': { key: 'pushup', label: 'Push-up' },
  'push ups': { key: 'pushup', label: 'Push-up' },
  'push-up': { key: 'pushup', label: 'Push-up' },
  'push-ups': { key: 'pushup', label: 'Push-up' },
  'squat': { key: 'squat', label: 'Squat' },
  'squats': { key: 'squat', label: 'Squat' },
  'kettlebell swing': { key: 'kbswing', label: 'KB Swing' },
  'kb swing': { key: 'kbswing', label: 'KB Swing' },
  'toes to bar': { key: 'toes2bar', label: 'Toes to Bar' },
  'toes-to-bar': { key: 'toes2bar', label: 'Toes to Bar' },
  'handstand push-up': { key: 'hspu', label: 'HSPU' },
  'hspu': { key: 'hspu', label: 'HSPU' },
  'wall ball': { key: 'wallball', label: 'Wall Ball' },
  'wall balls': { key: 'wallball', label: 'Wall Ball' },
  'row': { key: 'row', label: 'Rowing' },
  'rowing': { key: 'row', label: 'Rowing' },
};

export function normalizeMovement(raw: string): { key: string; label: string } {
  const lower = raw.toLowerCase().trim();
  return MOVEMENT_ALIASES[lower] ?? { key: lower.replace(/\s+/g, '_'), label: raw };
}
