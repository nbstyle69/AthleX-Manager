import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { boxPlanInfo, type BoxSubscriptionTier } from '@/lib/boxPlanTier';

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const supabase = createServiceClient();
  // `?archived=1` bascule la liste sur les archivées. Le service role contourne
  // la policy `boxes_hide_archived`, donc le filtre est explicite ici — c'est
  // aussi ce qui permet de rouvrir une box archivée.
  const wantArchived = new URL(req.url).searchParams.get('archived') === '1';

  const base = () => supabase
    .from('boxes')
    .select('*, owner:profiles!boxes_owner_id_fkey(username)')
    .order('created_at', { ascending: false });

  // Tant que la migration `20261224` n'est pas appliquée, la colonne n'existe
  // pas : la liste normale reste juste (aucune box n'est archivée), et l'onglet
  // Archivées est simplement vide.
  let { data: boxes, error } = await (wantArchived
    ? base().not('archived_at', 'is', null)
    : base().is('archived_at', null));
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    if (wantArchived) { boxes = []; error = null; }
    else ({ data: boxes, error } = await base());
  }
  const { data: subs } = await supabase.from('box_subscriptions').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allSubs = (subs ?? []) as BoxSubscriptionTier[];
  const boxesWithTier = (boxes ?? []).map(b => ({
    ...b,
    ...boxPlanInfo(allSubs.filter(s => s.box_id === b.id)),
  }));
  return NextResponse.json(boxesWithTier);
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const supabase = createServiceClient();
  const body = await req.json();

  const { name, description, city, owner_id, invite_code } = body;

  if (!name || !owner_id || !invite_code) {
    return NextResponse.json({ error: 'name, owner_id and invite_code are required' }, { status: 400 });
  }

  const { data, error } = await supabase.from('boxes').insert({
    name,
    description: description || null,
    city: city || null,
    owner_id,
    invite_code,
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also add the owner as a member of the box
  await supabase.from('box_members').insert({
    box_id: data.id,
    member_id: owner_id,
    status: 'active',
  });

  return NextResponse.json(data);
}
