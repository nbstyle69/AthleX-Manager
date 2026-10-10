import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { sendPlanChangeDecisionPush } from '@/lib/members/membershipPush';
import { codeFromDbError, type PlanChangeCode } from '@/lib/membership/planChange';
import { planChangeError } from '@/lib/membership/server';

const STATUT: Partial<Record<PlanChangeCode, number>> = { PLAN_CHANGE_FORBIDDEN: 403, PLAN_CHANGE_NOT_FOUND: 404 };

/**
 * Le gérant ou un co-gérant accepte ou refuse la demande de changement de
 * formule d'un membre au comptoir (session du Manager, cookie). La base
 * décide (`decide_plan_change_request` : jamais le coach, jamais une autre
 * box, une demande décidée ne bouge plus ; acceptée = formule appliquée).
 * Le membre est prévenu une seule fois : seulement si la décision vient
 * d'être prise (`decided`).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const { request_id, accept } = await req.json().catch(() => ({}));
    if (typeof request_id !== 'string' || !request_id || typeof accept !== 'boolean') {
      return NextResponse.json({ error: 'request_id et accept requis.' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: demande } = await service.from('box_plan_change_requests')
      .select('id, box_id, member_id, to_plan_id').eq('id', request_id).maybeSingle();
    const d = demande as { id: string; box_id: string; member_id: string; to_plan_id: string } | null;
    if (!d) return planChangeError('PLAN_CHANGE_NOT_FOUND', 404);
    if (!(await isBoxOwnerAdmin(service, user.id, d.box_id))) return planChangeError('PLAN_CHANGE_FORBIDDEN', 403);

    const { data, error } = await service.rpc('decide_plan_change_request', {
      p_request_id: d.id, p_actor_id: user.id, p_accept: accept,
    });
    if (error) {
      const code = codeFromDbError(error.message);
      if (code) return planChangeError(code, STATUT[code] ?? 409);
      throw new Error(error.message);
    }
    const r = data as { decided: boolean; status: string };

    if (r.decided) {
      const { data: plan } = accept
        ? await service.from('membership_plans').select('name').eq('id', d.to_plan_id).maybeSingle()
        : { data: null };
      await sendPlanChangeDecisionPush({
        userId: d.member_id, boxId: d.box_id, accepted: r.status === 'accepted',
        planName: (plan as { name: string } | null)?.name ?? null,
      });
    }
    return NextResponse.json({ ok: true, decided: r.decided, status: r.status });
  } catch (err: any) {
    console.error('plan-change-requests/decide error:', err?.message ?? err);
    return NextResponse.json({ error: 'La décision a échoué.' }, { status: 500 });
  }
}
