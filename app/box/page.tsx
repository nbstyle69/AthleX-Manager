import { createServiceClient } from '@/lib/supabase/server';
import { LandingHeader } from '@/components/landing/header';
import { LandingFooter } from '@/components/landing/footer';
import BoxDirectory, { type DirectoryBox } from './BoxDirectory';

export const revalidate = 300;

export const metadata = {
  title: 'Trouver une box — AthleX',
  description:
    'Découvre les boxs de functional fitness, hybrid et cross training qui utilisent AthleX. Trouve la salle proche de chez toi et rejoins la communauté.',
};

const ACTIVE_SUB_STATUSES = ['active', 'trialing', 'past_due'];

export default async function BoxDirectoryPage() {
  const supabase = createServiceClient();

  const { data: boxesRaw } = await supabase
    .from('boxes')
    .select('id, name, slug, tagline, logo_url, cover_url, city, sport_type, member_count, stripe_onboarding_complete')
    .eq('is_active', true)
    .eq('is_listed', true)
    .not('slug', 'is', null)
    .order('member_count', { ascending: false, nullsFirst: false });

  const boxes = (boxesRaw ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    logo_url: string | null;
    cover_url: string | null;
    city: string | null;
    sport_type: string[] | null;
    member_count: number | null;
    stripe_onboarding_complete: boolean | null;
  }>;

  // A box is publicly listed if it can take payments (Stripe onboarded)
  // OR is a live AthleX customer (active/trialing subscription).
  const { data: subsRaw } = await supabase
    .from('box_subscriptions')
    .select('box_id, status')
    .in('status', ACTIVE_SUB_STATUSES);

  const subscribedBoxIds = new Set(
    ((subsRaw ?? []) as Array<{ box_id: string }>).map((s) => s.box_id),
  );

  const eligible: DirectoryBox[] = boxes
    .filter((b) => b.stripe_onboarding_complete || subscribedBoxIds.has(b.id))
    .map((b) => ({
      name: b.name,
      slug: b.slug,
      tagline: b.tagline,
      logo_url: b.logo_url,
      cover_url: b.cover_url,
      city: b.city,
      sport_type: b.sport_type ?? [],
      member_count: b.member_count ?? 0,
    }));

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader />
      <main className="pb-16">
        <BoxDirectory boxes={eligible} />
      </main>
      <LandingFooter />
    </div>
  );
}
