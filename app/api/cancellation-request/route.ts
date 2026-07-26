import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';

const BUCKET = 'cancellation-docs';
const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/**
 * L'athlète connecté crée une demande de résiliation anticipée (motif légitime),
 * avec un justificatif optionnel (PDF/image) stocké dans un bucket privé.
 * Multipart form: box_id, reason_type, message?, document?(File)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const form = await req.formData();
    const boxId = String(form.get('box_id') ?? '');
    const reasonType = String(form.get('reason_type') ?? 'other');
    const message = (form.get('message') as string | null)?.trim() || null;
    const file = form.get('document') as File | null;

    if (!boxId) {
      return NextResponse.json({ error: 'box_id requis.' }, { status: 400 });
    }
    if (!['moving', 'medical', 'other'].includes(reasonType)) {
      return NextResponse.json({ error: 'Motif invalide.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Le demandeur doit être membre de cette box.
    const { data: membership } = await supabase
      .from('box_members')
      .select('id')
      .eq('box_id', boxId)
      .eq('member_id', user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'Tu n\'es pas membre de cette box.' }, { status: 403 });
    }

    // Une seule demande en attente à la fois.
    const { data: pending } = await supabase
      .from('membership_cancellation_requests')
      .select('id')
      .eq('box_id', boxId)
      .eq('member_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (pending) {
      return NextResponse.json({ error: 'Tu as déjà une demande en attente.' }, { status: 409 });
    }

    let documentPath: string | null = null;
    if (file && file.size > 0) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo).' }, { status: 400 });
      }
      if (file.type && !ALLOWED.includes(file.type)) {
        return NextResponse.json({ error: 'Format non supporté (PDF ou image).' }, { status: 400 });
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const path = `${boxId}/${user.id}/${Date.now()}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (upErr) {
        console.error('cancellation doc upload failed:', upErr.message);
        return NextResponse.json({ error: 'Échec de l\'envoi du justificatif.' }, { status: 500 });
      }
      documentPath = path;
    }

    const { error: insErr } = await supabase
      .from('membership_cancellation_requests')
      .insert({
        box_id: boxId,
        member_id: user.id,
        reason_type: reasonType,
        message,
        document_path: documentPath,
        status: 'pending',
      });
    if (insErr) {
      console.error('cancellation request insert failed:', insErr.message);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('cancellation-request error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
