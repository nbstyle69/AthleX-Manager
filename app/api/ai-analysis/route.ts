import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      scoreId, athleteName, wodTitle, wodType,
      scoreValue, tiebreakValue, athleteLevel, athleteElo, notes,
    } = body;

    if (!scoreValue) {
      return NextResponse.json({ error: 'Données insuffisantes' }, { status: 400 });
    }

    const prompt = `Tu es un juge expert functional fitness chargé d'analyser un score soumis par un athlète.

Contexte :
- Athlète : ${athleteName ?? 'Inconnu'} (Niveau: ${athleteLevel ?? 'rx'}, ELO: ${athleteElo ?? 1000})
- WOD : ${wodTitle ?? 'Inconnu'} (Type: ${wodType ?? 'AMRAP'})
- Score soumis : ${scoreValue}${tiebreakValue ? ` (Tiebreak: ${tiebreakValue})` : ''}
${notes ? `- Notes de l'athlète : ${notes}` : ''}

En tant que juge expert, analyse ce score selon ces critères :
1. **Plausibilité** : Ce score est-il réaliste pour le niveau et l'ELO de cet athlète ?
2. **Cohérence** : Le score semble-t-il correct pour ce type de WOD ?
3. **Anomalies** : Y a-t-il des signaux d'alerte ?
4. **Recommandation** : Valider, rejeter, ou demander plus de vérifications ?

Sois concis et direct. Maximum 150 mots.`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = message.content[0].type === 'text' ? message.content[0].text : '';

    // Persist analysis to tournament_scores (column ai_analysis exists)
    if (scoreId) {
      const supabase = createServiceClient();
      await supabase.from('tournament_scores').update({ ai_analysis: analysis }).eq('id', scoreId);
    }

    return NextResponse.json({ analysis, scoreId });
  } catch (error: any) {
    console.error('[AI Analysis] Error:', error);
    return NextResponse.json({ error: error.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
