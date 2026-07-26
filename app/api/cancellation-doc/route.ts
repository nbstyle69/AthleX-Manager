import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/isBoxStaff';

const BUCKET = 'cancellation-docs';

/**
 * Renvoie une URL signée (60 s) vers le justificatif d'une demande de
 * résiliation. Réservé à l'auteur de la demande ou au staff de la box.
 * GET ?request_id=...
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const requestId = req.nextUrl.searchParams.get('request_id');
    if (!requestId) {
      return NextResponse.json({ error: 'request_id requis.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: reqRaw } = await supabase
      .from('membership_cancellation_requests')
      .select('box_id, member_id, document_path')
      .eq('id', requestId)
      .maybeSingle();
    const request = reqRaw as {
      box_id: string; member_id: string; document_path: string | null;
    } | null;

    if (!request?.document_path) {
      return NextResponse.json({ error: 'Aucun justificatif.' }, { status: 404 });
    }

    const allowed = request.member_id === user.id
      || (await isBoxStaff(supabase, user.id, request.box_id));
    if (!allowed) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(request.document_path, 60);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Justificatif indisponible.' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err: any) {
    console.error('cancellation-doc error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
