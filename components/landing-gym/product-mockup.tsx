"use client";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Dumbbell,
  Home,
  LayoutDashboard,
  LockKeyhole,
  Medal,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { translations, type Locale } from "@/data/landing";
export function StoreBadges({ locale }: { locale: Locale }) {
  const t = translations[locale].common;
  return (
    <div className="store-badges">
      {[t.appStore, t.playStore].map((s, i) => (
        <div className="store-badge" key={s}>
          {i === 0 ? (
            <Smartphone size={25} aria-hidden="true" />
          ) : (
            <span className="play-glyph" aria-hidden="true" />
          )}
          <span>
            <small>{t.soon}</small>
            <strong>{s}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}
export function ProductMockup({
  locale,
  zone,
  screenshotSrc,
}: {
  locale: Locale;
  zone: number;
  screenshotSrc?: string;
}) {
  const t = translations[locale].common;
  const pro = zone >= 10;
  const [mode, setMode] = useState(0);
  const [track, setTrack] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [tracks, setTracks] = useState([true, true, true]);
  const titles = [t.functional, t.hybrid, t.strength];
  const generator = zone >= 3 && zone <= 5;
  const arena = zone === 7 || zone === 14;
  const program = zone === 10;
  return (
    <div className={`mockup-wrap ${pro ? "browser-wrap" : "phone-wrap"}`}>
      <div className={pro ? "browser-mockup" : "phone-mockup"}>
        {pro ? (
          <div className="browser-chrome">
            <div className="browser-dots">
              <i />
              <i />
              <i />
            </div>
            <span>athlexapp.eu</span>
            <LockKeyhole size={12} />
          </div>
        ) : (
          <div className="phone-status">
            <span>9:41</span>
            <span className="phone-island" />
            <span>••• ▰</span>
          </div>
        )}
        {screenshotSrc ? (
          <img
            className="mockup-screenshot"
            src={screenshotSrc}
            alt={t.screenshot}
            loading="lazy"
          />
        ) : (
          <div className={`mockup-body ${pro ? "manager-body" : ""}`}>
            {pro && (
              <aside className="manager-sidebar" aria-hidden="true">
                <img
                  src="/athex-mark-light.png"
                  width={25}
                  height={25}
                  alt=""
                />
                {[
                  LayoutDashboard,
                  CalendarDays,
                  Users,
                  Dumbbell,
                  MessageCircle,
                  ShieldCheck,
                ].map((Icon, i) => (
                  <Icon
                    key={i}
                    size={18}
                    className={i === 1 ? "selected" : ""}
                  />
                ))}
              </aside>
            )}
            <div className="mockup-main">
              <div className="mockup-brand">
                <span>{pro ? "ATHLEX MANAGER" : "ATHLEX"}</span>
                <span className="mini-avatar">A</span>
              </div>
              {program ? (
                <>
                  <div className="mockup-eyebrow">{t.programs}</div>
                  <h3>{t.week}</h3>
                  <div className="program-toggles">
                    {titles.map((title, i) => (
                      <button
                        key={title}
                        role="switch"
                        aria-checked={tracks[i]}
                        onClick={() =>
                          setTracks(tracks.map((v, n) => (n === i ? !v : v)))
                        }
                      >
                        <span>{title}</span>
                        <span
                          className={`tiny-switch ${tracks[i] ? "on" : ""}`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="preview-tabs">
                    {titles.map((title, i) => (
                      <button
                        key={title}
                        aria-pressed={track === i}
                        onClick={() => setTrack(i)}
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                  <div className="week-grid">
                    {t.days.slice(0, track === 2 ? 5 : 6).map((day, i) => (
                      <div key={day} className="week-day">
                        <span>{day}</span>
                        <Dumbbell size={19} />
                        <strong>{titles[track]}</strong>
                        <span aria-label={`${t.session} ${i + 1}`}>
                          {i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="program-actions">
                    <span>
                      <CalendarDays size={14} />
                      {t.schedule}
                    </span>
                    <button onClick={() => setGeneration((g) => g + 1)}>
                      <RefreshCw size={14} />
                      {generation ? t.regenerate : t.generate}
                    </button>
                  </div>
                  <p className="program-reveal">{t.reveal}</p>
                  <div className="generation-log" aria-live="polite">
                    <CheckCheck size={16} />
                    {generation ? `${t.success} · ${generation}` : t.log}
                  </div>
                </>
              ) : generator ? (
                <>
                  <div className="mockup-eyebrow">{titles[zone - 3]}</div>
                  <h3>{zone === 5 ? t.target : t.training}</h3>
                  <div className="preview-tabs">
                    {[t.express, t.after].map((m, i) => (
                      <button
                        key={m}
                        aria-pressed={mode === i}
                        onClick={() => setMode(i)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className="workout-card">
                    <div>
                      <span>{mode ? "EMOM" : "AMRAP"}</span>
                      <Timer size={17} />
                    </div>
                    <strong className="timer-digits">
                      {mode ? "12:00" : "20:00"}
                    </strong>
                    <span>{t.timer}</span>
                  </div>
                  {(zone === 5 ? t.goals : t.movementsList).map((m, i) => (
                    <div key={m} className="movement-row">
                      <span className="movement-icon">
                        <Dumbbell size={19} />
                      </span>
                      <span>{m}</span>
                      <strong>
                        {zone === 5 ? (
                          <ChevronRight size={15} />
                        ) : (
                          String((i + 1) * 5)
                        )}
                      </strong>
                    </div>
                  ))}
                  <a className="mockup-cta" href="/signup">
                    {t.generate}
                    <Zap size={16} />
                  </a>
                </>
              ) : zone === 6 ? (
                <>
                  <div className="mockup-eyebrow">{t.timer}</div>
                  <div className="clock-preview">
                    <span>AMRAP</span>
                    <strong>20:00</strong>
                    <Timer size={36} />
                  </div>
                  <div className="timer-formats">
                    {[
                      "AMRAP",
                      "EMOM",
                      "For Time",
                      "Tabata",
                      "Split",
                      "YWYR",
                    ].map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                  <a href="/signup" className="mockup-cta">
                    {t.start}
                    <ArrowUpRight size={16} />
                  </a>
                </>
              ) : zone === 8 ? (
                <>
                  <div className="mockup-eyebrow">{t.record}</div>
                  <div className="badge-preview">
                    <Medal size={74} />
                    <h3>{t.badge}</h3>
                    <span>{t.movements}</span>
                  </div>
                  <div className="badge-shelf">
                    <Medal />
                    <Trophy />
                    <Activity />
                  </div>
                </>
              ) : arena ? (
                <>
                  <div className="mockup-eyebrow">{t.competition}</div>
                  <div className="arena-preview">
                    <Trophy size={60} />
                    <h3>{t.noResults}</h3>
                  </div>
                  {t.formats.map((f, i) => (
                    <div className="movement-row" key={f}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <span>{f}</span>
                    </div>
                  ))}
                  <a className="mockup-cta" href="/classement">
                    {translations[locale].nav.ranking}
                    <ArrowUpRight size={16} />
                  </a>
                </>
              ) : zone === 16 ? (
                <>
                  <div className="security-preview">
                    <ShieldCheck size={74} />
                    <h3>{t.secure}</h3>
                  </div>
                  {translations[locale].zones[15].features.map((f) => (
                    <div className="movement-row" key={f}>
                      <Check size={16} />
                      <span>{f}</span>
                    </div>
                  ))}
                </>
              ) : [9, 15].includes(zone) ? (
                <>
                  <div className="mockup-eyebrow">{t.community}</div>
                  <h3>{t.messages}</h3>
                  <div className="community-symbol">
                    <MessageCircle size={64} />
                  </div>
                  {[t.coachRole, t.training, t.explore].map((m) => (
                    <div className="movement-row" key={m}>
                      <span className="movement-icon">
                        <Users size={18} />
                      </span>
                      <span>{m}</span>
                      <ChevronRight size={15} />
                    </div>
                  ))}
                </>
              ) : [12, 17].includes(zone) ? (
                <>
                  <div className="mockup-eyebrow">{t.manager}</div>
                  <h3>{t.members}</h3>
                  {[t.ownerRole, t.coachRole, t.athleteRole].map((m) => (
                    <div className="movement-row" key={m}>
                      <span className="mini-avatar">
                        <Users size={16} />
                      </span>
                      <span>{m}</span>
                      <span className="role-status">
                        <Check size={14} />
                        {t.active}
                      </span>
                    </div>
                  ))}
                  <div className="security-inline">
                    <ShieldCheck size={20} />
                    {t.secure}
                  </div>
                </>
              ) : zone === 13 ? (
                <>
                  <div className="mockup-eyebrow">{t.booking}</div>
                  <h3>{t.available}</h3>
                  <div className="booking-days">
                    {t.days.map((d, i) => (
                      <span key={d} className={i === 2 ? "selected" : ""}>
                        {d}
                      </span>
                    ))}
                  </div>
                  {["07:00", "12:00", "18:00"].map((time, i) => (
                    <div className="movement-row" key={time}>
                      <strong>{time}</strong>
                      <span>{titles[i]}</span>
                      <CalendarDays size={17} />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="mockup-eyebrow">
                    {zone === 1 ? t.app : t.today}
                  </div>
                  <h3>
                    {zone === 1
                      ? translations[locale].hero.athleteLine
                      : t.functional}
                  </h3>
                  <div className="workout-card">
                    <div>
                      <span>AMRAP</span>
                      <Dumbbell size={20} />
                    </div>
                    <strong className="timer-digits">20:00</strong>
                    <span>{t.training}</span>
                  </div>
                  {t.movementsList.map((m, i) => (
                    <div className="movement-row" key={m}>
                      <span>{(i + 1) * 5}</span>
                      <span>{m}</span>
                      <Check size={14} />
                    </div>
                  ))}
                  <a
                    href={pro ? "/pricing/onboarding" : "/signup"}
                    className="mockup-cta"
                  >
                    {zone === 11 ? t.import : t.signup}
                    <ArrowUpRight size={16} />
                  </a>
                </>
              )}
            </div>
          </div>
        )}
        {!pro && (
          <div className="phone-bottom">
            <Home size={17} />
            <Dumbbell size={17} />
            <Trophy size={17} />
            <Users size={17} />
          </div>
        )}
      </div>
      <p className="mockup-caption">{t.demo}</p>
      {program && generation > 0 && (
        <p className="mockup-disclaimer">{t.generatedNote}</p>
      )}
    </div>
  );
}
