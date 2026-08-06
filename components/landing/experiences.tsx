'use client';

import { Dumbbell, Users, LayoutDashboard, Check, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { FadeUp } from './fade-up';

const ICONS: LucideIcon[] = [Dumbbell, Users, LayoutDashboard];

/** Emerald accent, three intensities — one per persona. */
const GRADIENTS = [
  'linear-gradient(137deg, #6EE7B7 0%, #10B981 45%, #047857 100%)',
  'linear-gradient(137deg, #FFFFFF 0%, #6EE7B7 45%, #10B981 100%)',
  'linear-gradient(137deg, #047857 0%, #2DD4BF 45%, #A7F3D0 100%)',
];

/** Tint of the bullet checkmarks, matched to each card's gradient. */
const BULLETS = ['#34D399', '#A7F3D0', '#5EEAD4'];

export function Experiences() {
  const { t } = useLanguage();

  return (
    <section id="experiences" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="mb-16 max-w-2xl">
          <FadeUp>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {t.experiences.title}
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="mt-4 text-muted-foreground">{t.experiences.subtitle}</p>
          </FadeUp>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-5">
          {t.experiences.items.map((item, i) => {
            const Icon = ICONS[i] ?? Dumbbell;
            const gradient = GRADIENTS[i % GRADIENTS.length];

            return (
              <FadeUp key={item.role} delay={0.1 * i} className="h-full">
                <div className="group relative mx-auto flex h-full w-full flex-col">
                  {/* Diffuse halo bleeding out from behind the card. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-2 inset-y-6 rounded-[40px] opacity-50 transition-opacity duration-500 group-hover:opacity-75"
                    style={{ background: gradient, filter: 'blur(45px)' }}
                  />

                  {/* Card: solid fill on the padding box, gradient on the border box. */}
                  <div
                    className="relative z-10 flex h-full min-h-[300px] flex-col overflow-hidden rounded-[40px]"
                    style={{
                      border: '8px solid transparent',
                      background:
                        `linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, ${gradient} border-box`,
                    }}
                  >
                    <div className="flex h-full w-full flex-col p-7">
                      <div className="text-foreground/90">
                        <Icon size={32} strokeWidth={2.5} />
                      </div>

                      <h3 className="mb-3 mt-6 text-xl font-medium tracking-tight text-foreground">
                        {item.role}
                      </h3>
                      <p className="text-[14px] font-normal leading-[1.6] text-muted-foreground selection:bg-foreground/20">
                        {item.desc}
                      </p>

                      <ul className="mt-auto space-y-2.5 border-t border-border pt-6">
                        {item.benefits.map((b) => (
                          <li
                            key={b}
                            className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground/80"
                          >
                            <Check
                              className="mt-[3px] h-3.5 w-3.5 shrink-0"
                              strokeWidth={3}
                              style={{ color: BULLETS[i % BULLETS.length] }}
                            />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}
