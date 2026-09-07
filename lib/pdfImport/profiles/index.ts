import type { PdfPage, SourceProfile } from '../types';
import { kplusPerf } from './kplus-perf';
import { generic } from './generic';

export const DETECTION_THRESHOLD = 0.7;

export const PROFILES: SourceProfile[] = [kplusPerf, generic];

export function profileBySlug(slug: string | null | undefined): SourceProfile | null {
  return PROFILES.find(p => p.slug === slug) ?? null;
}

export function detectProfile(pages: PdfPage[]): { profile: SourceProfile; scores: Record<string, number> } {
  const scores: Record<string, number> = {};
  let best: SourceProfile | null = null;
  for (const p of PROFILES) {
    if (p.slug === 'generic') continue;
    const s = p.detect(pages);
    scores[p.slug] = Math.round(s * 100) / 100;
    if (s >= DETECTION_THRESHOLD && (!best || s > scores[best.slug])) best = p;
  }
  return { profile: best ?? generic, scores };
}
