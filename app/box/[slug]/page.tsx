import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import {
  BoxPublicView,
  type PublicBox,
  type PublicPlan,
  type PublicProgram,
} from './BoxPublicView';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface BoxRow extends Omit<PublicBox, 'sport_type' | 'services' | 'member_count'> {
  sport_type: string[] | null;
  services: string[] | null;
  member_count: number | null;
  latitude: number | null;
  longitude: number | null;
  founded_at: string | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: box } = await supabase
    .from('boxes')
    .select('name, tagline, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!box) return { title: 'Box introuvable — AthleX' };

  return {
    title: `${box.name} — AthleX`,
    description: box.tagline ?? `Découvrez ${box.name} sur AthleX`,
    openGraph: {
      title: box.name,
      description: box.tagline ?? '',
      images: box.logo_url ? [{ url: box.logo_url }] : [],
    },
  };
}

export default async function BoxPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: box } = await supabase
    .from('boxes')
    .select(
      'id, name, slug, description, tagline, logo_url, cover_url, address, city, phone, contact_email, website_url, instagram_url, google_maps_url, latitude, longitude, sport_type, services, opening_hours, founded_at, member_count, terms_pdf_url',
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!box) notFound();

  const row = box as unknown as BoxRow;

  const { count: memberCount } = await supabase
    .from('box_members')
    .select('id', { count: 'exact', head: true })
    .eq('box_id', row.id)
    .eq('status', 'active');

  const { data: programsRaw } = await supabase
    .from('programs')
    .select('id, title, description, price_cents, type, duration_weeks, days_per_week, image_url')
    .eq('box_id', row.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Only paid formulas are shown publicly.
  const { data: plansRaw } = await supabase
    .from('membership_plans')
    .select('id, name, description, price_cents, max_sessions_per_week, color, plan_type, credits, validity_days, commitment_months, terms')
    .eq('box_id', row.id)
    .eq('is_active', true)
    .gt('price_cents', 0)
    .order('price_cents', { ascending: true });

  const allPlans = (plansRaw ?? []) as unknown as PublicPlan[];
  const plans = allPlans.filter((pl) => (pl.plan_type ?? 'subscription') === 'subscription');
  const creditOffers = allPlans.filter((pl) => pl.plan_type === 'drop_in' || pl.plan_type === 'pack');

  // Keyless Google Maps embed: prefer exact coordinates, else fall back to the address.
  const mapQuery =
    row.latitude != null && row.longitude != null
      ? `${row.latitude},${row.longitude}`
      : [row.address, row.city].filter(Boolean).join(', ') || null;
  const mapsLink =
    row.google_maps_url ??
    (mapQuery ? `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}` : null);

  const publicBox: PublicBox = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    tagline: row.tagline,
    logo_url: row.logo_url,
    cover_url: row.cover_url,
    address: row.address,
    city: row.city,
    phone: row.phone,
    contact_email: row.contact_email,
    website_url: row.website_url,
    instagram_url: row.instagram_url,
    google_maps_url: row.google_maps_url,
    sport_type: row.sport_type ?? [],
    services: row.services ?? [],
    opening_hours: row.opening_hours,
    member_count: row.member_count ?? 0,
    terms_pdf_url: row.terms_pdf_url,
  };

  return (
    <BoxPublicView
      box={publicBox}
      memberCount={memberCount ?? 0}
      foundedYear={row.founded_at ? new Date(row.founded_at).getFullYear() : null}
      plans={plans}
      creditOffers={creditOffers}
      programs={(programsRaw ?? []) as unknown as PublicProgram[]}
      mapQuery={mapQuery}
      mapsLink={mapsLink}
    />
  );
}
