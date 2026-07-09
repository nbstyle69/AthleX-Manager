import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Phone, Mail, Globe, Instagram, Calendar,
  Clock, Dumbbell, ExternalLink, ShoppingCart, Users,
  ChevronRight, ArrowLeft,
} from 'lucide-react';
import ProgramBuyButton from './ProgramBuyButton';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface Box {
  id: string;
  name: string;
  slug: string;
  description?: string;
  tagline?: string;
  logo_url?: string;
  cover_url?: string;
  address?: string;
  city?: string;
  phone?: string;
  contact_email?: string;
  website_url?: string;
  instagram_url?: string;
  google_maps_url?: string;
  latitude?: number;
  longitude?: number;
  sport_type?: string[];
  services?: string[];
  opening_hours?: Record<string, string>;
  founded_at?: string;
  member_count?: number;
}

interface Program {
  id: string;
  title: string;
  description?: string;
  price_cents: number;
  type: 'fixed' | 'ongoing';
  duration_weeks?: number;
  days_per_week: number;
  image_url?: string;
  invite_code: string;
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

const GOLD = '#FFFFFF';
const DAY_LABELS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
};

export default async function BoxPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: box } = await supabase
    .from('boxes')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!box) notFound();

  const b = box as unknown as Box;

  // Fetch member count
  const { count: memberCount } = await supabase
    .from('box_members')
    .select('id', { count: 'exact', head: true })
    .eq('box_id', b.id)
    .eq('status', 'active');

  // Fetch programs
  const { data: programs } = await supabase
    .from('programs')
    .select('id, title, description, price_cents, type, duration_weeks, days_per_week, image_url, invite_code')
    .eq('box_id', b.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const progs = (programs ?? []) as Program[];
  const foundedYear = b.founded_at ? new Date(b.founded_at).getFullYear() : null;

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Gratuit';
    return `${(cents / 100).toFixed(2)} €`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm">
            <ArrowLeft size={16} />
            <span className="font-black tracking-tight">
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

      {/* Hero */}
      <section className="relative pt-14">
        {/* Cover */}
        <div className="h-56 md:h-72 bg-[#111]">
          {b.cover_url ? (
            <img src={b.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#111] to-[#1a1a1a]" />
          )}
          <div className="absolute inset-0 top-14 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
        </div>

        {/* Box info overlay */}
        <div className="relative max-w-5xl mx-auto px-6 -mt-20">
          <div className="flex items-end gap-5">
            {b.logo_url ? (
              <img
                src={b.logo_url} alt={b.name}
                className="w-24 h-24 md:w-28 md:h-28 rounded-2xl border-4 border-[#0A0A0A] object-cover shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl border-4 border-[#0A0A0A] bg-[#111] flex items-center justify-center">
                <span className="text-4xl font-black" style={{ color: GOLD }}>{b.name.charAt(0)}</span>
              </div>
            )}
            <div className="pb-1">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">{b.name}</h1>
              {b.tagline && <p className="text-sm text-gray-400 mt-1">{b.tagline}</p>}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-4 mt-6">
            {(memberCount ?? 0) > 0 && (
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                <Users size={15} style={{ color: GOLD }} />
                <span className="text-sm font-bold">{memberCount}</span>
                <span className="text-xs text-gray-500">membres</span>
              </div>
            )}
            {foundedYear && (
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                <Calendar size={15} style={{ color: GOLD }} />
                <span className="text-sm font-bold">{foundedYear}</span>
                <span className="text-xs text-gray-500">fondée</span>
              </div>
            )}
            {b.city && (
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                <MapPin size={15} style={{ color: GOLD }} />
                <span className="text-sm font-semibold">{b.city}</span>
              </div>
            )}
            {(b.sport_type ?? []).map(s => (
              <div key={s} className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5">
                <Dumbbell size={15} style={{ color: GOLD }} />
                <span className="text-sm font-semibold">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left — Main */}
        <div className="lg:col-span-2 space-y-10">
          {/* Description */}
          {b.description && (
            <section>
              <h2 className="text-lg font-black mb-3">À propos</h2>
              <p className="text-gray-400 leading-relaxed whitespace-pre-line">{b.description}</p>
            </section>
          )}

          {/* Services */}
          {(b.services ?? []).length > 0 && (
            <section>
              <h2 className="text-lg font-black mb-3">Services</h2>
              <div className="flex flex-wrap gap-2">
                {(b.services ?? []).map(s => (
                  <span key={s} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-gray-300">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Opening hours */}
          {b.opening_hours && Object.keys(b.opening_hours).length > 0 && (
            <section>
              <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                <Clock size={18} style={{ color: GOLD }} /> Horaires
              </h2>
              <div className="bg-[#111] border border-white/[0.06] rounded-2xl divide-y divide-white/[0.06]">
                {Object.entries(DAY_LABELS).map(([key, label]) => {
                  const val = b.opening_hours?.[key];
                  if (!val) return null;
                  return (
                    <div key={key} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm font-semibold text-gray-300">{label}</span>
                      <span className="text-sm text-gray-500">{val}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Programs */}
          {progs.length > 0 && (
            <section>
              <h2 className="text-lg font-black mb-1 flex items-center gap-2">
                <ShoppingCart size={18} style={{ color: GOLD }} /> Programmation
              </h2>
              <p className="text-xs text-gray-500 mb-4">Programmes d'entraînement proposés par {b.name}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {progs.map(p => (
                  <div key={p.id} className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden">
                    {p.image_url && (
                      <img src={p.image_url} alt="" className="w-full h-36 object-cover" />
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white">{p.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          p.type === 'fixed'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-purple-500/15 text-purple-400'
                        }`}>
                          {p.type === 'fixed' ? `${p.duration_weeks} sem.` : 'Ongoing'}
                        </span>
                      </div>
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Calendar size={12} /> {p.days_per_week} jours/semaine
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span
                          className="text-sm font-black px-3 py-1 rounded-lg"
                          style={{ color: GOLD, backgroundColor: `${GOLD}15` }}
                        >
                          {formatPrice(p.price_cents)}
                          {p.type === 'ongoing' && p.price_cents > 0 && (
                            <span className="text-[10px] text-gray-500 font-semibold"> /mois</span>
                          )}
                        </span>
                        {p.price_cents > 0 ? (
                          <ProgramBuyButton
                            programId={p.id}
                            priceLabel={formatPrice(p.price_cents)}
                            recurring={p.type === 'ongoing'}
                          />
                        ) : (
                          <span className="text-xs font-bold text-gray-400 px-4 py-2">
                            Gratuit — dans l'app
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right — Sidebar */}
        <div className="space-y-6">
          {/* Contact card */}
          <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">Contact</h3>
            {b.address && (
              <a
                href={b.google_maps_url ?? `https://maps.google.com/?q=${encodeURIComponent(b.address)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 group"
              >
                <MapPin size={16} className="mt-0.5 text-gray-600 group-hover:text-white transition-colors" />
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{b.address}</span>
              </a>
            )}
            {b.phone && (
              <a href={`tel:${b.phone}`} className="flex items-center gap-3 group">
                <Phone size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{b.phone}</span>
              </a>
            )}
            {b.contact_email && (
              <a href={`mailto:${b.contact_email}`} className="flex items-center gap-3 group">
                <Mail size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{b.contact_email}</span>
              </a>
            )}
            {b.website_url && (
              <a href={b.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                <Globe size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors truncate">{b.website_url}</span>
              </a>
            )}
            {b.instagram_url && (
              <a href={b.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                <Instagram size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">Instagram</span>
              </a>
            )}
          </div>

          {/* Map */}
          {b.latitude && b.longitude && (
            <div className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden">
              <a
                href={b.google_maps_url ?? `https://maps.google.com/?q=${b.latitude},${b.longitude}`}
                target="_blank" rel="noopener noreferrer"
              >
                <img
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${b.latitude},${b.longitude}&zoom=14&size=400x200&scale=2&markers=color:0xFFFFFF%7C${b.latitude},${b.longitude}&style=element:geometry%7Ccolor:0x1d1d1d&style=element:labels.text.fill%7Ccolor:0x8e8e8e&style=feature:road%7Celement:geometry%7Ccolor:0x2c2c2c&style=feature:water%7Celement:geometry%7Ccolor:0x0e0e0e&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''}`}
                  alt="Map"
                  className="w-full h-44 object-cover"
                />
              </a>
              <div className="p-3 text-center">
                <a
                  href={b.google_maps_url ?? `https://maps.google.com/?q=${b.latitude},${b.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-1"
                >
                  Ouvrir dans Google Maps <ChevronRight size={13} />
                </a>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-5 text-center">
            <p className="text-sm font-bold mb-2">Rejoindre {b.name}</p>
            <p className="text-xs text-gray-500 mb-4">
              Téléchargez l'app AthleX et rejoignez la communauté
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://apps.apple.com"
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold py-2.5 rounded-lg transition-colors text-white"
                style={{ backgroundColor: GOLD }}
              >
                App Store
              </a>
              <a
                href="https://play.google.com"
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white"
              >
                Google Play
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
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
