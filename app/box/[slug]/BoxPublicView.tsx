'use client';

import {
  MapPin, Phone, Mail, Globe, Instagram, Calendar,
  Clock, Dumbbell, ShoppingCart, Users, ChevronRight, CalendarCheck,
} from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { LandingFooter } from '@/components/landing/footer';
import { StoreBadges } from '@/components/store-badges';
import { useLanguage } from '@/components/language-provider';
import ProgramBuyButton from './ProgramBuyButton';
import MembershipSubscribeButton from './MembershipSubscribeButton';
import MembershipManageButton from './MembershipManageButton';
import TrialBookingCta from './TrialBookingCta';

export interface PublicBox {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
  sport_type: string[];
  services: string[];
  opening_hours: Record<string, string> | null;
  member_count: number;
  terms_pdf_url: string | null;
}

export interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_sessions_per_week: number | null;
  color: string;
  plan_type: 'subscription' | 'drop_in' | 'pack' | 'trial';
  credits: number | null;
  validity_days: number | null;
  commitment_months: number | null;
  terms: string | null;
}

export interface PublicProgram {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  type: 'fixed' | 'ongoing';
  duration_weeks: number | null;
  days_per_week: number;
  image_url: string | null;
}

const DAY_KEYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

export function BoxPublicView({
  box,
  memberCount,
  foundedYear,
  plans,
  creditOffers,
  trialOffer,
  programs,
  mapQuery,
  mapsLink,
}: {
  box: PublicBox;
  memberCount: number;
  foundedYear: number | null;
  plans: PublicPlan[];
  creditOffers: PublicPlan[];
  trialOffer: PublicPlan | null;
  programs: PublicProgram[];
  mapQuery: string | null;
  mapsLink: string | null;
}) {
  const { t } = useLanguage();
  const b = box;
  const p = t.boxPage;

  const formatPrice = (cents: number) =>
    cents === 0 ? p.free : `${(cents / 100).toFixed(2)} €`;

  return (
    <div className="min-h-screen bg-ax-background font-sans text-ax-text antialiased">
      <LandingHeader />

      {/* Hero */}
      <section className="relative">
        <div className="relative h-56 bg-ax-hover md:h-72">
          {b.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-ax-surface-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        <div className="relative mx-auto -mt-20 max-w-5xl px-6">
          <div className="flex items-end gap-5">
            {b.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.logo_url}
                alt={b.name}
                className="h-24 w-24 rounded-ax-card border-4 border-ax-background object-cover shadow-xl md:h-28 md:w-28"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-ax-card border-4 border-ax-background bg-ax-surface md:h-28 md:w-28">
                <span className="font-display text-4xl font-bold text-ax-text">{b.name.charAt(0)}</span>
              </div>
            )}
            <div className="pb-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{b.name}</h1>
              {b.tagline && <p className="mt-1 text-sm text-ax-text-secondary">{b.tagline}</p>}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            {memberCount > 0 && (
              <div className="flex items-center gap-2 rounded-ax-control bg-ax-hover px-4 py-2.5">
                <Users size={15} className="text-ax-text" />
                <span className="text-sm font-bold">{memberCount}</span>
                <span className="text-xs text-ax-text-secondary">{p.members}</span>
              </div>
            )}
            {foundedYear && (
              <div className="flex items-center gap-2 rounded-ax-control bg-ax-hover px-4 py-2.5">
                <Calendar size={15} className="text-ax-text" />
                <span className="text-sm font-bold">{foundedYear}</span>
                <span className="text-xs text-ax-text-secondary">{p.founded}</span>
              </div>
            )}
            {b.city && (
              <div className="flex items-center gap-2 rounded-ax-control bg-ax-hover px-4 py-2.5">
                <MapPin size={15} className="text-ax-text" />
                <span className="text-sm font-semibold">{b.city}</span>
              </div>
            )}
            {b.sport_type.map((s) => (
              <div key={s} className="flex items-center gap-2 rounded-ax-control bg-ax-hover px-4 py-2.5">
                <Dumbbell size={15} className="text-ax-text" />
                <span className="text-sm font-semibold">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {b.description && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">{p.about}</h2>
              <p className="whitespace-pre-line leading-relaxed text-ax-text-secondary">{b.description}</p>
            </section>
          )}

          {b.services.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">{p.services}</h2>
              <div className="flex flex-wrap gap-2">
                {b.services.map((s) => (
                  <span
                    key={s}
                    className="rounded-ax-control bg-ax-hover px-3 py-1.5 text-xs font-semibold text-ax-text"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {b.opening_hours && Object.keys(b.opening_hours).length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                <Clock size={18} /> {p.hours}
              </h2>
              <div className="divide-y divide-ax-border rounded-ax-card border border-ax-border bg-ax-surface">
                {DAY_KEYS.map((key) => {
                  const val = b.opening_hours?.[key];
                  if (!val) return null;
                  return (
                    <div key={key} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm font-semibold text-ax-text">{p.days[key]}</span>
                      <span className="text-sm text-ax-text-secondary">{val}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {trialOffer && (
            <section>
              <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
                <CalendarCheck size={18} /> {p.trial.section}
              </h2>
              <p className="mb-4 text-xs text-ax-text-secondary">
                {p.trial.subtitle.replace('{box}', b.name)}
              </p>
              <div className="rounded-ax-card border border-ax-border bg-ax-surface p-5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: trialOffer.color }}
                  />
                  <h3 className="font-semibold text-ax-text">{trialOffer.name}</h3>
                  <span className="rounded-md bg-ax-hover px-2 py-0.5 text-[10px] font-bold text-ax-text">
                    {p.trial.badge}
                  </span>
                </div>
                {trialOffer.description && (
                  <p className="mt-1 text-xs text-ax-text-secondary">{trialOffer.description}</p>
                )}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-ax-text-secondary">
                  <Calendar size={12} /> {p.trial.detail}
                </div>
                {trialOffer.terms && (
                  <p className="mt-3 whitespace-pre-line rounded-ax-control border border-ax-border bg-ax-background p-3 text-[11px] text-ax-text-secondary">
                    <span className="font-bold text-ax-text">{p.trial.terms} — </span>
                    {trialOffer.terms}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-ax-border pt-4">
                  <span className="text-sm font-bold text-ax-text">{p.free}</span>
                  <TrialBookingCta boxId={b.id} planName={trialOffer.name} />
                </div>
              </div>
            </section>
          )}

          {plans.length > 0 && (
            <section>
              <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
                <Users size={18} /> {p.memberships}
              </h2>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs text-ax-text-secondary">
                  {p.membershipsSubtitle.replace('{box}', b.name)}
                </p>
                {plans.length > 1 && (
                  <MembershipManageButton
                    plans={plans.map((pl) => ({
                      id: pl.id,
                      name: pl.name,
                      priceLabel: `${formatPrice(pl.price_cents)}${p.perMonth}`,
                    }))}
                  />
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {plans.map((pl) => (
                  <div key={pl.id} className="flex flex-col rounded-ax-card border border-ax-border bg-ax-surface p-5">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: pl.color }} />
                      <h3 className="font-semibold text-ax-text">{pl.name}</h3>
                    </div>
                    {pl.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-ax-text-secondary">{pl.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-ax-text-secondary">
                      <Calendar size={12} />
                      {pl.max_sessions_per_week
                        ? `${pl.max_sessions_per_week} ${
                            pl.max_sessions_per_week > 1 ? p.sessionsPerWeek : p.sessionPerWeek
                          }`
                        : p.unlimitedSessions}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-ax-border pt-4">
                      <span className="text-sm font-bold text-ax-text">
                        {formatPrice(pl.price_cents)}
                        <span className="text-[10px] font-semibold text-ax-text-secondary"> {p.perMonth}</span>
                      </span>
                      <MembershipSubscribeButton
                        planId={pl.id}
                        planName={pl.name}
                        priceLabel={`${formatPrice(pl.price_cents)}${p.perMonth}`}
                        commitmentMonths={pl.commitment_months ?? 0}
                        description={pl.description}
                        maxSessionsPerWeek={pl.max_sessions_per_week}
                        terms={pl.terms}
                        termsPdfUrl={b.terms_pdf_url}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {creditOffers.length > 0 && (
            <section>
              <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
                <Users size={18} /> {p.alaCarte}
              </h2>
              <p className="mb-4 text-xs text-ax-text-secondary">{p.alaCarteSubtitle}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {creditOffers.map((pl) => (
                  <div key={pl.id} className="flex flex-col rounded-ax-card border border-ax-border bg-ax-surface p-5">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: pl.color }} />
                      <h3 className="font-semibold text-ax-text">{pl.name}</h3>
                      <span className="rounded-md bg-ax-hover px-2 py-0.5 text-[10px] font-bold text-ax-text">
                        {pl.plan_type === 'drop_in' ? p.dropIn : p.pack}
                      </span>
                    </div>
                    {pl.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-ax-text-secondary">{pl.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-ax-text-secondary">
                      <Calendar size={12} />
                      {pl.plan_type === 'drop_in'
                        ? p.dropInDetail.replace('{days}', String(pl.validity_days ?? 14))
                        : p.packDetail
                            .replace('{credits}', String(pl.credits ?? 0))
                            .replace('{months}', String(Math.round((pl.validity_days ?? 0) / 30)))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-ax-border pt-4">
                      <span className="text-sm font-bold text-ax-text">{formatPrice(pl.price_cents)}</span>
                      <MembershipSubscribeButton
                        planId={pl.id}
                        planName={pl.name}
                        priceLabel={formatPrice(pl.price_cents)}
                        mode="oneshot"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {programs.length > 0 && (
            <section>
              <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
                <ShoppingCart size={18} /> {p.programming}
              </h2>
              <p className="mb-4 text-xs text-ax-text-secondary">
                {p.programmingSubtitle.replace('{box}', b.name)}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {programs.map((prog) => (
                  <div key={prog.id} className="overflow-hidden rounded-ax-card border border-ax-border bg-ax-surface">
                    {prog.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={prog.image_url} alt="" className="h-36 w-full object-cover" />
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-ax-text">{prog.title}</h3>
                        <span className="rounded-md bg-ax-hover px-2 py-0.5 text-[10px] font-bold text-ax-text">
                          {prog.type === 'fixed'
                            ? `${prog.duration_weeks ?? 0} ${p.weeksShort}`
                            : p.ongoing}
                        </span>
                      </div>
                      {prog.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-ax-text-secondary">{prog.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs text-ax-text-secondary">
                        <Calendar size={12} /> {prog.days_per_week} {p.daysPerWeek}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="rounded-ax-control bg-ax-hover px-3 py-1 text-sm font-bold text-ax-text">
                          {formatPrice(prog.price_cents)}
                          {prog.type === 'ongoing' && prog.price_cents > 0 && (
                            <span className="text-[10px] font-semibold text-ax-text-secondary"> {p.perMonth}</span>
                          )}
                        </span>
                        {prog.price_cents > 0 ? (
                          <ProgramBuyButton
                            programId={prog.id}
                            priceLabel={formatPrice(prog.price_cents)}
                            recurring={prog.type === 'ongoing'}
                          />
                        ) : (
                          <span className="px-4 py-2 text-xs font-bold text-ax-text-secondary">
                            {p.freeInApp}
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

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="space-y-4 rounded-ax-card border border-ax-border bg-ax-surface p-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-ax-text-secondary">{p.contact}</h3>
            {b.address && (
              <a
                href={b.google_maps_url ?? `https://maps.google.com/?q=${encodeURIComponent(b.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3"
              >
                <MapPin size={16} className="mt-0.5 text-ax-text-secondary transition-colors group-hover:text-ax-text" />
                <span className="text-sm text-ax-text-secondary transition-colors group-hover:text-ax-text">
                  {b.address}
                </span>
              </a>
            )}
            {b.phone && (
              <a href={`tel:${b.phone}`} className="group flex items-center gap-3">
                <Phone size={16} className="text-ax-text-secondary transition-colors group-hover:text-ax-text" />
                <span className="text-sm text-ax-text-secondary transition-colors group-hover:text-ax-text">
                  {b.phone}
                </span>
              </a>
            )}
            {b.contact_email && (
              <a href={`mailto:${b.contact_email}`} className="group flex items-center gap-3">
                <Mail size={16} className="text-ax-text-secondary transition-colors group-hover:text-ax-text" />
                <span className="text-sm text-ax-text-secondary transition-colors group-hover:text-ax-text">
                  {b.contact_email}
                </span>
              </a>
            )}
            {b.website_url && (
              <a href={b.website_url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3">
                <Globe size={16} className="text-ax-text-secondary transition-colors group-hover:text-ax-text" />
                <span className="truncate text-sm text-ax-text-secondary transition-colors group-hover:text-ax-text">
                  {b.website_url}
                </span>
              </a>
            )}
            {b.instagram_url && (
              <a href={b.instagram_url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3">
                <Instagram size={16} className="text-ax-text-secondary transition-colors group-hover:text-ax-text" />
                <span className="text-sm text-ax-text-secondary transition-colors group-hover:text-ax-text">
                  Instagram
                </span>
              </a>
            )}
          </div>

          {mapQuery && (
            <div className="overflow-hidden rounded-ax-card border border-ax-border bg-ax-surface">
              <iframe
                title={`${p.mapTitle} — ${b.name}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`}
                className="h-44 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {mapsLink && (
                <div className="p-3 text-center">
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs font-semibold text-ax-text-secondary transition-colors hover:text-ax-text"
                  >
                    {p.openInMaps} <ChevronRight size={13} />
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="rounded-ax-card border border-ax-border bg-ax-surface p-5 text-center">
            <p className="mb-2 text-sm font-bold">{p.joinTitle.replace('{box}', b.name)}</p>
            <p className="mb-4 text-xs text-ax-text-secondary">{p.joinSubtitle}</p>
            <StoreBadges layout="stacked" />
          </div>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
