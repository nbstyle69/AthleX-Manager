import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { DayPage, PdfPage } from './types';
import { GENERIC_SYSTEM_PROMPT, llmDayToDayPage, type LlmDay } from './profiles/generic';

/**
 * Découpage structurel par Claude Haiku pour le profil `generic` (§16.4).
 * Une requête par page, JSON strict validé par zod ; toute page invalide est
 * simplement ignorée (jamais de WOD inventé).
 */

export const HAIKU_MODEL = 'claude-3-5-haiku-latest';

const llmDaySchema = z.object({
  day: z.number().int().min(0).max(6).nullable(),
  sections: z.array(z.object({
    title: z.string().min(1),
    block_hint: z.enum(['skill-gym', 'skill-haltero', 'wod', 'pre-wod', 'post-wod']).nullable().default(null),
    level_lines: z.array(z.string()).default([]),
    lines: z.array(z.string()).default([]),
  })).default([]),
});

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Réponse LLM sans JSON');
  return JSON.parse(text.slice(start, end + 1));
}

export async function llmSplitPage(client: Anthropic, page: PdfPage): Promise<LlmDay | null> {
  const res = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 4000,
    temperature: 0,
    system: GENERIC_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Page ${page.index} :\n\n${page.text}` }],
  });
  const text = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
  const parsed = llmDaySchema.safeParse(extractJson(text));
  return parsed.success ? parsed.data : null;
}

export async function llmSplitDays(pages: PdfPage[], apiKey: string): Promise<DayPage[]> {
  const client = new Anthropic({ apiKey });
  const results = await Promise.all(pages.map(async p => {
    try { return llmDayToDayPage(p, (await llmSplitPage(client, p)) ?? { day: null, sections: [] }); }
    catch { return null; }
  }));
  const days = results.filter((d): d is DayPage => d != null);
  // Deux pages pour le même jour : on les concatène.
  const merged = new Map<number, DayPage>();
  for (const d of days) {
    const prev = merged.get(d.day);
    if (prev) prev.lines.push(...d.lines);
    else merged.set(d.day, { ...d, lines: [...d.lines] });
  }
  return Array.from(merged.values()).sort((a, b) => a.day - b.day);
}
