import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const boxId = formData.get('box_id') as string;
    const file = formData.get('logo') as File;

    if (!boxId || !file) {
      return NextResponse.json({ error: 'box_id et logo requis' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${boxId}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from('box-logos')
      .upload(fileName, buffer, {
        contentType: file.type || `image/${ext === 'png' ? 'png' : 'jpeg'}`,
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
