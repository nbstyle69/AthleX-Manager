import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser, getAdminUser } from '@/lib/supabase/server';

const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'webp']);
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

async function canManageBox(userId: string, boxId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data: box } = await supabase
    .from('boxes').select('owner_id').eq('id', boxId).maybeSingle();
  if (box?.owner_id === userId) return true;

  const { data: membership } = await supabase
    .from('box_members')
    .select('member_id')
    .eq('box_id', boxId).eq('member_id', userId).eq('role', 'owner').eq('status', 'active')
    .maybeSingle();
  return !!membership;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const formData = await req.formData();
    const boxId = formData.get('box_id') as string;
    const file = formData.get('logo') as File;

    if (!boxId || !file) {
      return NextResponse.json({ error: 'box_id et logo requis' }, { status: 400 });
    }

    const isAdmin = !!(await getAdminUser());
    if (!isAdmin && !(await canManageBox(user.id, boxId))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Format invalide (png, jpg, webp uniquement)' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const fileName = `${boxId}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from('box-logos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('box-logos').getPublicUrl(fileName);
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('boxes').update({ logo_url: logoUrl }).eq('id', boxId);

    return NextResponse.json({ logo_url: logoUrl });
  } catch (err: any) {
    console.error('upload-box-logo error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
