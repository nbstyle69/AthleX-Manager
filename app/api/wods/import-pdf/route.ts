import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { createClient, createServiceClient, getAdminBoxes, getServerUser } from '@/lib/supabase/server';
import { parseDocument } from '@/lib/pdfImport/core';
import { detectProfile, profileBySlug } from '@/lib/pdfImport/profiles';
import { llmSplitDays } from '@/lib/pdfImport/llm';
import type { PdfPage } from '@/lib/pdfImport/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const SOURCE_BUCKET = 'wod-sources';

/**
 * POST multipart : `box_id`, `week_start` (lundi, AAAA-MM-JJ), `pdf` (File),
 * `profile` optionnel (forcer une source depuis la preview).
 *
 * Réponse : `ImportResult` + `source_pdf_url` (chemin privé dans `wod-sources`).
 * Le PDF est conservé pour la traçabilité `box_wods.source_pdf_url`.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getServerUser();
    if (!caller) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const form = await req.formData();
    const boxId = form.get('box_id');
    const weekStart = form.get('week_start');
    const forced = form.get('profile');
    const file = form.get('pdf');

    if (typeof boxId !== 'string' || !boxId) return NextResponse.json({ error: 'box_id requis' }, { status: 400 });
    if (typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'week_start (AAAA-MM-JJ) requis' }, { status: 400 });
    }
    if (!(file instanceof File)) return NextResponse.json({ error: 'pdf requis' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'PDF trop volumineux (10 Mo max)' }, { status: 413 });

    const userClient = await createClient();
    const boxes = await getAdminBoxes(userClient);
    if (!boxes.some(b => b.id === boxId)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    let pages: PdfPage[];
    try {
      const text = await parser.getText();
      pages = text.pages.map(p => ({ index: p.num, text: p.text }));
    } finally {
      await parser.destroy();
    }
    if (!pages.some(p => p.text.trim())) {
      return NextResponse.json({ error: 'PDF sans texte exploitable (scan ?)' }, { status: 422 });
    }

    const detection = detectProfile(pages);
    const profile = (typeof forced === 'string' && profileBySlug(forced)) || detection.profile;

    let days;
    if (profile.slug === 'generic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) days = await llmSplitDays(pages, apiKey);
    }

    const result = parseDocument(pages, profile, weekStart, detection.scores, days);

    const admin = createServiceClient();
    const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-80) || 'programmation.pdf';
    const path = `${boxId}/${weekStart}-${Date.now()}-${safeName}`;
    const { error: upErr } = await admin.storage.from(SOURCE_BUCKET).upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
    const sourcePdfUrl = upErr ? null : path;
    if (upErr) console.error('import-pdf: upload wod-sources', upErr.message);

    return NextResponse.json({ ...result, source_pdf_url: sourcePdfUrl, llm_used: profile.slug === 'generic' && !!days });
  } catch (err) {
    console.error('import-pdf error:', err);
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
