import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import BoxDirectory, { type DirectoryBox } from './BoxDirectory';

export const revalidate = 300;

export const metadata = {
  title: 'Trouver une box — AthleX',
  description:
    'Découvre les box CrossFit, Hyrox et functional training qui utilisent AthleX. Trouve la salle proche de chez toi et rejoins la communauté.',
};

const GOLD = '#FFFFFF';

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
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/landing"
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="AthleX" width={24} height={24} className="w-6 h-6 object-contain" />
            <span className="font-black tracking-tight text-white">
              Athle<span style={{ color: GOLD }}>X</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="text-xs font-semibold border border-white/15 hover:bg-white/5 px-4 py-2 rounded-lg transition-colors"
          >
            Espace gérant
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 pb-8 max-w-5xl mx-auto px-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Trouver une box</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-xl">
          Découvre les salles qui utilisent AthleX — CrossFit, Hyrox, functional training. Trouve
          celle proche de chez toi et rejoins sa communauté.
        </p>
      </section>

      <BoxDirectory boxes={eligible} />

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 mt-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            © {new Date().getFullYear()} Athle<span style={{ color: GOLD }}>X</span> — Tous droits réservés
          </span>
          <Link href="/landing" className="text-xs text-gray-600 hover:text-white transition-colors">
            Découvrir AthleX
          </Link>
        </div>
      </footer>
    </div>
  );
}
