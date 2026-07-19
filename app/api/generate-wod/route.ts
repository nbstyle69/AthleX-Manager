import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { type, level, duration_minutes, equipment } = await req.json();

    const timerGuide: Record<string, string> = {
      'For Time':   'timer_type: "countdown", time_cap_seconds = duration_minutes*60, rounds: null',
      'AMRAP':      'timer_type: "stopwatch", time_cap_seconds = duration_minutes*60, rounds: null',
      'EMOM':       'timer_type: "emom", time_cap_seconds = duration_minutes*60, rounds = duration_minutes',
      'Tabata':     'timer_type: "tabata", time_cap_seconds = null, rounds = 8, work_seconds = 20, rest_seconds = 10',
      'Strength':   'timer_type: "none", time_cap_seconds: null, rounds: null',
      'Max Reps':   'timer_type: "countdown", time_cap_seconds = duration_minutes*60, rounds: null',
    };

    const prompt = `Tu es un programmateur functional fitness expert. Génère un WOD de compétition.

Paramètres:
- Type: ${type}
- Niveau: ${level} (scaled/inter/rx/rx+/gx/pro)
- Durée/Cap: ${duration_minutes} minutes
- Équipement: ${equipment?.join(', ') || 'standard (barre olympique, haltères, barre de traction)'}
- Règle timer: ${timerGuide[type] ?? 'timer_type: "stopwatch"'}

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas d'explication):
{
  "title": "Nom court et accrocheur (2-4 mots)",
  "description": "Description courte du WOD en 1-2 phrases, ton compétition.",
  "movements": ["ex: 21 Thrusters 43kg/30kg", "21 Pull-Ups", "15 Thrusters", "15 Pull-Ups", "9 Thrusters", "9 Pull-Ups"],
  "scoring": "ex: Score = temps total (cap ${duration_minutes} min)",
  "timer_type": "countdown",
  "time_cap_seconds": ${duration_minutes * 60},
  "rounds": null,
  "work_seconds": null,
  "rest_seconds": null
}

Adapte les charges au niveau ${level}. Max 3-6 mouvements. Mouvements classiques de functional fitness.`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const clean = text.replace(/```json\n?|\n?```/g, '').trim();
    const wod = JSON.parse(clean);

    return NextResponse.json(wod);
  } catch (error: any) {
    console.error('[GenerateWOD]', error);
    return NextResponse.json({ error: error.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
