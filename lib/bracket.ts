export interface BracketMatchRow {
  round: number;
  side: string | null;
  participant1_id: string | null;
  participant2_id: string | null;
  winner_id: string | null;
  loser_id: string | null;
  status: string;
}

export interface BracketStanding {
  athlete_id: string;
  rank: number;
  eliminatedRound: number | null; // null = champion (never lost) or still competing
  placement: string;
}

const DISTANCE_LABEL = ['Finaliste', 'Demi-finaliste', 'Quart de finaliste', '8e de finale', '16e de finale', '32e de finale'];

/**
 * Placement label from the tier position (0 = best). Tier 0 is the champion,
 * tier 1 the finalist, tier 2 the semi-finalists, etc. Athletes still in the
 * running (bracket not finished) are labelled "En lice".
 */
function tierLabel(tier: number, isChampion: boolean, stillAlive: boolean): string {
  if (isChampion) return 'Champion';
  if (stillAlive) return 'En lice';
  if (tier <= 0) return 'Champion';
  return DISTANCE_LABEL[tier - 1] ?? `Top ${tier + 1}`;
}

/** A ranked athlete before competition ranks/labels are assigned. Higher `key` = better placement. */
interface Seed {
  athlete_id: string;
  key: number;
  isChampion: boolean;
  stillAlive: boolean;
  eliminatedRound: number | null;
}

/**
 * Turn ranking seeds into standings with competition ranks (ties share a rank,
 * the next block skips accordingly: 1, 2, 3, 3, 5, …) and tiered placement labels.
 */
function finalize(seeds: Seed[]): BracketStanding[] {
  seeds.sort((a, b) => b.key - a.key);
  const result: BracketStanding[] = [];
  let processed = 0;
  let i = 0;
  let tier = 0;
  while (i < seeds.length) {
    let j = i;
    while (j < seeds.length && seeds[j].key === seeds[i].key) j++;
    const rank = processed + 1;
    for (let k = i; k < j; k++) {
      result.push({
        athlete_id: seeds[k].athlete_id,
        rank,
        eliminatedRound: seeds[k].eliminatedRound,
        placement: tierLabel(tier, seeds[k].isChampion, seeds[k].stillAlive),
      });
    }
    processed += j - i;
    i = j;
    tier++;
  }
  return result;
}

/**
 * Ranking seeds for a single-elimination bracket: the champion is 1st, the
 * finalist 2nd, both semi-final losers share 3rd, the four quarter-final losers
 * share 5th, etc. Athletes eliminated in the same round tie.
 */
function singleElimSeeds(wb: BracketMatchRow[]): Seed[] {
  if (wb.length === 0) return [];
  const maxRound = Math.max(...wb.map(m => m.round));

  const participants = new Set<string>();
  for (const m of wb) {
    if (m.participant1_id) participants.add(m.participant1_id);
    if (m.participant2_id) participants.add(m.participant2_id);
  }

  // Round in which each athlete was eliminated (lost a match).
  const eliminatedRound = new Map<string, number>();
  for (const m of wb) {
    if (m.loser_id) {
      const prev = eliminatedRound.get(m.loser_id);
      if (prev == null || m.round > prev) eliminatedRound.set(m.loser_id, m.round);
    }
  }

  // Champion = winner of the final (highest-round decided match) who never lost.
  const finalMatch = wb.find(m => m.round === maxRound && m.winner_id);
  const championId = finalMatch && !eliminatedRound.has(finalMatch.winner_id!) ? finalMatch.winner_id! : null;

  return [...participants].map(id => {
    const er = eliminatedRound.get(id) ?? null;
    const isChampion = id === championId;
    const stillAlive = !isChampion && er === null;
    return {
      athlete_id: id,
      isChampion,
      stillAlive,
      eliminatedRound: er,
      key: isChampion ? Number.POSITIVE_INFINITY : er === null ? maxRound + 0.5 : er,
    };
  });
}

/**
 * Ranking seeds for a double-elimination bracket ("swiss" format here: Winner
 * Bracket + Loser Bracket + Grand Final).
 *
 * A player is only out on their *loser-bracket* loss — a winner-bracket loss just
 * drops them to the LB. So placement is driven by how deep they got in the LB:
 * the grand-final winner is champion, the grand-final loser is 2nd, then the LB
 * losers ranked by their elimination round (the later, the better), ties shared.
 */
function doubleElimSeeds(matches: BracketMatchRow[]): Seed[] {
  const wb = matches.filter(m => m.side == null || m.side === 'winner');
  const lb = matches.filter(m => m.side === 'loser');
  const gf = matches.find(m => m.side === 'grand_final') ?? null;

  // No loser bracket / grand final generated yet → behave like single elimination
  // on the winner side (shows partial standings mid-tournament).
  if (lb.length === 0 && !gf) return singleElimSeeds(wb);

  const participants = new Set<string>();
  for (const m of matches) {
    if (m.participant1_id) participants.add(m.participant1_id);
    if (m.participant2_id) participants.add(m.participant2_id);
  }

  const maxLb = lb.length ? Math.max(...lb.map(m => m.round)) : 0;

  // Loser-bracket round in which each athlete was finally eliminated.
  const lbLoss = new Map<string, number>();
  for (const m of lb) {
    if (m.loser_id) {
      const prev = lbLoss.get(m.loser_id);
      if (prev == null || m.round > prev) lbLoss.set(m.loser_id, m.round);
    }
  }

  const gfDecided = gf && gf.winner_id ? gf : null;
  const championId = gfDecided?.winner_id ?? null;
  const runnerUpId = gfDecided?.loser_id ?? null;

  const RUNNER_UP_KEY = maxLb + 2; // above every LB elimination round
  const ALIVE_KEY = maxLb + 1;     // still competing, below the runner-up

  return [...participants].map(id => {
    const isChampion = id === championId;
    const isRunnerUp = id === runnerUpId;
    const lbRound = lbLoss.get(id) ?? null;
    const eliminated = isRunnerUp || lbRound !== null;
    const stillAlive = !isChampion && !eliminated;
    const key = isChampion ? Number.POSITIVE_INFINITY
      : isRunnerUp ? RUNNER_UP_KEY
      : lbRound !== null ? lbRound
      : ALIVE_KEY;
    return { athlete_id: id, isChampion, stillAlive, eliminatedRound: lbRound, key };
  });
}

/**
 * Derive the final standings of a bracket from its matches.
 *
 * `doubleElim` selects the format: false = single-elimination (`bracket`), true =
 * double-elimination (`swiss`: Winner Bracket + Loser Bracket + Grand Final).
 * Both return competition ranking (1-2-3-3-5-…) so tied placements share ELO fairly.
 */
export function computeBracketStandings(matches: BracketMatchRow[], doubleElim = false): BracketStanding[] {
  if (!matches || matches.length === 0) return [];
  const seeds = doubleElim
    ? doubleElimSeeds(matches)
    : singleElimSeeds(matches.filter(m => m.side == null || m.side === 'winner'));
  if (seeds.length === 0) return [];
  return finalize(seeds);
}
