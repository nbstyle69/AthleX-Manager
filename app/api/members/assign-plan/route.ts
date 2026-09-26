import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';

/**
 * Formule d'un membre (page Membres), écrite côté serveur : `plan_id` est une
 * colonne de facturation, qu'une garde athlex-app va fermer aux rôles client.
 *
 * Body: { box_id: string, member_id: string, plan_id: string | null }
 * - gérant ou co-gérant de la box (`is_box_owner_admin`), jamais le coach ;
 * - la formule appartient à la box ; le membre en fait partie ;
 * - écriture avec la clé serveur, sur la seule ligne du membre. Le déclencheur
 *   `sync_member_plan_groups` range le membre dans les groupes de la formule,
 *   comme avant (il ne dépend pas de l'appelant).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const { box_id, member_id, plan_id } = await req.json();
    if (!box_id || !member_id || (plan_id !== null && typeof plan_id !== 'string')) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    if (!(await isBoxOwnerAdmin(supabase, user.id, box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    if (plan_id !== null) {
      const { data: plan } = await supabase
        .from('membership_plans').select('id').eq('id', plan_id).eq('box_id', box_id).maybeSingle();
      if (!plan) return NextResponse.json({ error: 'Formule introuvable dans cette box.' }, { status: 404 });
    }

    const { data: member } = await supabase
      .from('box_members').select('id').eq('box_id', box_id).eq('member_id', member_id).maybeSingle();
    if (!member) return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });

    const { error } = await supabase
      .from('box_members').update({ plan_id }).eq('id', (member as { id: string }).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, plan_id });
  } catch (err: any) {
    console.error('members assign-plan error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
