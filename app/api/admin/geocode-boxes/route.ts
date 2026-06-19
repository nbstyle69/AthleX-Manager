import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

type GeoResult = {
  latitude: number; longitude: number; city: string | null;
  postal_code: string | null; country: string | null;
};

// Géocode une adresse via Nominatim (OpenStreetMap, gratuit, sans clé API).
async function geocodeAddress(address: string): Promise<GeoResult | null> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=' +
      encodeURIComponent(address);
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'fr', 'User-Agent': 'AthleX/1.0 (box-geocoding)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0];
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    const a = hit.address ?? {};
    return {
      latitude: lat,
      longitude: lon,
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
      postal_code: a.postcode ?? null,
      country: a.country ?? null,
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST /api/admin/geocode-boxes
// Parcourt toutes les box ayant une adresse mais pas de coordonnées et les géocode.
export async function POST(_req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const supabase = createServiceClient();

  const { data: boxes, error } = await supabase
    .from('boxes')
    .select('id, name, address, latitude, longitude')
    .not('address', 'is', null)
    .or('latitude.is.null,longitude.is.null');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { id: string; name: string; status: string }[] = [];
  let updated = 0;
  let failed = 0;

  for (const box of boxes ?? []) {
    const address = (box.address ?? '').trim();
    if (!address) {
      results.push({ id: box.id, name: box.name, status: 'skipped (no address)' });
      continue;
    }

    const geo = await geocodeAddress(address);
    if (!geo) {
      failed++;
      results.push({ id: box.id, name: box.name, status: 'not found' });
      await sleep(1100); // respect Nominatim rate limit (1 req/s)
      continue;
    }

    const payload: Record<string, any> = {
      latitude: geo.latitude,
      longitude: geo.longitude,
    };
    if (geo.city) payload.city = geo.city;
    if (geo.postal_code) payload.postal_code = geo.postal_code;
    if (geo.country) payload.country = geo.country;

    const { error: upErr } = await supabase.from('boxes').update(payload).eq('id', box.id);
    if (upErr) {
      failed++;
      results.push({ id: box.id, name: box.name, status: `error: ${upErr.message}` });
    } else {
      updated++;
      results.push({ id: box.id, name: box.name, status: 'geocoded' });
    }

    await sleep(1100); // respect Nominatim rate limit (1 req/s)
  }

  return NextResponse.json({
    total: boxes?.length ?? 0,
    updated,
    failed,
    results,
  });
}
