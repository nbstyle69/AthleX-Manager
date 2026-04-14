import Link from 'next/link';
import {
  CalendarClock, Dumbbell, Trophy, Users, MessageSquare,
  ChevronRight, Zap, BarChart3, ArrowRight,
  CheckCircle2, Shield,
} from 'lucide-react';

const FEATURES = [
  {
    icon: CalendarClock,
    title: 'Horaires & Réservations',
    desc: 'Planifiez vos cours, gérez les capacités et laissez vos membres réserver en un tap.',
  },
  {
    icon: Dumbbell,
    title: 'Whiteboard WOD',
    desc: 'Publiez le WOD du jour, suivez les scores de vos membres en temps réel.',
  },
  {
    icon: Trophy,
    title: 'Tournois & Classement ELO',
    desc: 'Organisez des compétitions internes avec soumission vidéo et classement automatique.',
  },
  {
    icon: Users,
    title: 'Gestion des membres',
    desc: "Invitez, gérez et suivez l'activité de tous vos adhérents.",
  },
  {
    icon: MessageSquare,
    title: 'Messagerie temps réel',
    desc: 'Communiquez avec votre communauté via un chat intégré. Annonces, groupes, échanges.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Rapports',
    desc: 'Suivez les KPIs de votre box : fréquentation, rétention, engagement.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased">

      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-lg font-black tracking-tight">
              Athle<span className="text-[#C9A227]">X</span>
            </span>
            <div className="hidden md:flex items-center gap-6">
              {[
                ['#fonctionnalites', 'Fonctionnalités'],
                ['#pour-qui', 'Pour qui'],
                ['#comment', 'Comment ça marche'],
                ['/pricing', 'Tarifs'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="text-sm text-gray-500 hover:text-white transition-colors">
                  {label}
                </a>
              ))}
            </div>
          </div>
          <Link
            href="/login"
            className="text-sm font-semibold text-white border border-white/15 hover:bg-white/5 px-5 py-2 rounded-lg transition-colors"
          >
            Essayer gratuitement
          </Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-[4.5rem] font-black leading-[1.08] tracking-tight mb-6">
            Le standard tout-en-un
            <br />
            <span className="text-[#C9A227]">de la gestion de box</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed mb-10">
            Gagnez du temps grâce à une solution complète.
            <br />
            Offrez la meilleure expérience à vos athlètes et développez votre box.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white font-semibold px-7 py-3.5 rounded-lg text-sm transition-colors"
            >
              Démarrer gratuitement 30 jours <ChevronRight size={15} />
            </Link>
            <div className="flex flex-col items-start gap-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle2 size={13} className="text-[#C9A227]" />
                Annulez à tout moment
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Shield size={13} className="text-[#C9A227]" />
                Aucune carte de crédit requise
              </div>
            </div>
          </div>
        </div>

        {/* Product mockup */}
        <div className="max-w-5xl mx-auto mt-20">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
              <div className="ml-4 bg-white/5 rounded-md px-3 py-1 text-[11px] text-gray-600 font-mono">
                app.athlex.io/horaires
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-7 gap-3">
                {[
                  { d: 'Lun', n: 16 },
                  { d: 'Mar', n: 17 },
                  { d: 'Mer', n: 18 },
                  { d: 'Jeu', n: 19 },
                  { d: 'Ven', n: 20 },
                  { d: 'Sam', n: 21 },
                  { d: 'Dim', n: 22 },
                ].map(({ d, n }, i) => (
                  <div key={d} className="space-y-2">
                    <div
                      className={`rounded-lg px-2 py-2.5 text-center ${
                        i === 0
                          ? 'bg-[#C9A227]/15 border border-[#C9A227]/30'
                          : 'border border-white/[0.06]'
                      }`}
                    >
                      <p className={`text-[10px] font-medium ${i === 0 ? 'text-[#C9A227]' : 'text-gray-600'}`}>{d}</p>
                      <p className={`text-sm font-bold ${i === 0 ? 'text-[#C9A227]' : 'text-gray-400'}`}>{n}</p>
                    </div>
                    {i < 5 && (
                      <>
                        <div className="border border-white/[0.06] rounded-lg p-2.5">
                          <p className="text-[9px] text-[#C9A227]/70 font-medium">09:00</p>
                          <p className="text-[10px] text-white/80 font-semibold mt-0.5">CrossFit</p>
                          <p className="text-[9px] text-gray-600 mt-0.5">15/20 inscrits</p>
                        </div>
                        <div className="border border-white/[0.06] rounded-lg p-2.5">
                          <p className="text-[9px] text-[#C9A227]/70 font-medium">11:00</p>
                          <p className="text-[10px] text-white/80 font-semibold mt-0.5">Haltérophilie</p>
                          <p className="text-[9px] text-gray-600 mt-0.5">8/12 inscrits</p>
                        </div>
                        {i < 3 && (
                          <div className="border border-white/[0.06] rounded-lg p-2.5">
                            <p className="text-[9px] text-[#C9A227]/70 font-medium">18:00</p>
                            <p className="text-[10px] text-white/80 font-semibold mt-0.5">Open Gym</p>
                            <p className="text-[9px] text-gray-600 mt-0.5">12/20 inscrits</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="h-20 bg-gradient-to-t from-[#0A0A0A] to-transparent -mt-20 relative z-10 pointer-events-none" />
        </div>
      </section>

      {/* ─── SOCIAL PROOF BAR ─── */}
      <section className="py-12 px-6 border-y border-white/[0.04]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-center">
          {[
            { val: '3 profils', sub: 'Athlète · Coach · Gérant' },
            { val: 'iOS & Android', sub: 'Application native' },
            { val: 'Temps réel', sub: 'Scores & messagerie' },
            { val: '30 jours', sub: 'Essai gratuit' },
          ].map(({ val, sub }) => (
            <div key={val} className="px-4">
              <p className="text-lg font-bold text-white">{val}</p>
              <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FONCTIONNALITÉS ─── */}
      <section id="fonctionnalites" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-lg mb-16">
            <p className="text-xs font-semibold text-[#C9A227] uppercase tracking-widest mb-3">
              Fonctionnalités
            </p>
            <h2 className="text-4xl font-black leading-tight">
              Tout ce dont votre box a besoin. Rien de superflu.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.04] rounded-2xl overflow-hidden border border-white/[0.06]">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[#0A0A0A] p-7 hover:bg-[#0E0E0E] transition-colors">
                <Icon size={20} className="text-[#C9A227] mb-4" strokeWidth={1.5} />
                <h3 className="text-[15px] font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── POUR QUI ─── */}
      <section id="pour-qui" className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-[#C9A227] uppercase tracking-widest mb-3">
              Pour qui ?
            </p>
            <h2 className="text-4xl font-black">
              Une plateforme, trois expériences
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                emoji: '🏋️',
                role: 'Athlète',
                desc: 'Réserve, performe, compétis.',
                items: [
                  'Réservation de créneaux en 2 taps',
                  'WOD du jour + timer vidéo',
                  'Classement ELO & tournois',
                  'Records personnels (PR)',
                  'Chat avec la box',
                ],
                accent: true,
              },
              {
                emoji: '📋',
                role: 'Coach',
                desc: 'Programme, encadre, valide.',
                items: [
                  'Publication du WOD quotidien',
                  'Validation des scores',
                  'Gestion des créneaux',
                  'Communication en temps réel',
                  'Stats de la box',
                ],
                accent: false,
              },
              {
                emoji: '🏢',
                role: 'Gérant',
                desc: 'Pilote, développe, maîtrise.',
                items: [
                  'Dashboard avec KPIs clés',
                  'Modèle de semaine automatique',
                  'Gestion des membres & rôles',
                  'Analytics & rapports',
                  'Données sécurisées',
                ],
                accent: false,
              },
            ].map(({ emoji, role, desc, items, accent }) => (
              <div
                key={role}
                className={`rounded-2xl p-7 border ${
                  accent
                    ? 'border-[#C9A227]/20 bg-[#C9A227]/[0.03]'
                    : 'border-white/[0.06] bg-transparent'
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <h3 className="text-xl font-black mt-3">{role}</h3>
                <p className="text-sm text-gray-500 mt-1 mb-6">{desc}</p>
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-400">
                      <CheckCircle2
                        size={14}
                        className={`mt-0.5 shrink-0 ${accent ? 'text-[#C9A227]' : 'text-gray-600'}`}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMMENT ÇA MARCHE ─── */}
      <section id="comment" className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-[#C9A227] uppercase tracking-widest mb-3">
              Comment ça marche
            </p>
            <h2 className="text-4xl font-black">Opérationnel en 5 minutes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Créez votre box',
                desc: "Inscrivez-vous et configurez votre espace. Nom, horaires, logo — c'est tout.",
              },
              {
                step: '02',
                title: 'Invitez vos membres',
                desc: "Partagez un code d'invitation. Vos athlètes rejoignent depuis l'app en un tap.",
              },
              {
                step: '03',
                title: 'Gérez tout au même endroit',
                desc: 'Horaires, WODs, tournois, messages — tout est accessible partout, tout le temps.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step}>
                <span className="text-4xl font-black text-[#C9A227]/20">{step}</span>
                <h3 className="text-lg font-bold mt-2 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── APPLICATION MOBILE ─── */}
      <section className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold text-[#C9A227] uppercase tracking-widest mb-3">
              Application mobile
            </p>
            <h2 className="text-4xl font-black leading-tight mb-4">
              Vos athlètes ont leur app.
              <br />
              <span className="text-[#C9A227]">iOS & Android.</span>
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Réservation de créneaux, WOD du jour, timer avec enregistrement vidéo,
              tournois, messagerie et profil personnel — tout dans une seule application.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Timer CrossFit avec enregistrement vidéo',
                'Soumission et validation des scores',
                'Classement ELO et tournois internes',
                'Chat en temps réel avec la box',
                'Profil athlète avec records personnels',
              ].map((text) => (
                <li key={text} className="flex items-center gap-3 text-sm text-gray-400">
                  <CheckCircle2 size={14} className="text-[#C9A227] shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#C9A227] hover:text-[#B8911F] transition-colors"
            >
              Commencer maintenant <ArrowRight size={15} />
            </Link>
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="w-64 bg-[#111111] border border-white/[0.08] rounded-[2.8rem] p-3 shadow-2xl shadow-black/50">
              <div className="bg-[#0A0A0A] rounded-[2.4rem] overflow-hidden p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white">AthleX</span>
                  <div className="w-6 h-6 rounded-full bg-[#C9A227]/15 flex items-center justify-center">
                    <Zap size={11} className="text-[#C9A227]" />
                  </div>
                </div>
                <div className="border border-white/[0.06] rounded-xl p-3.5">
                  <p className="text-[9px] text-[#C9A227] font-semibold uppercase tracking-wider mb-1.5">
                    WOD du jour
                  </p>
                  <p className="text-xs font-bold text-white">AMRAP 20min</p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                    5 Pull-ups · 10 Push-ups · 15 Squats
                  </p>
                </div>
                <div className="bg-[#C9A227] rounded-xl py-3 text-center">
                  <p className="text-[10px] font-bold text-white tracking-wide">▶ DÉMARRER LE TIMER</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] text-gray-600 font-medium uppercase tracking-wider">
                    Leaderboard
                  </p>
                  {[
                    ['Alex M.', '12 rounds', '1'],
                    ['Sara K.', '11 rounds', '2'],
                    ['Tom B.', '10 rounds', '3'],
                  ].map(([name, score, rank]) => (
                    <div
                      key={name}
                      className="flex items-center gap-2.5 border border-white/[0.06] rounded-lg px-3 py-2"
                    >
                      <span className="text-[10px] font-bold text-[#C9A227] w-3">{rank}</span>
                      <span className="text-[10px] text-gray-300 flex-1">{name}</span>
                      <span className="text-[10px] text-gray-600">{score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-32 px-6 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black leading-tight mb-5">
            Prêt à passer
            <br />
            <span className="text-[#C9A227]">au niveau supérieur ?</span>
          </h2>
          <p className="text-gray-500 text-base mb-10 max-w-md mx-auto">
            Rejoignez AthleX et donnez à votre communauté les outils qu&apos;elle mérite. Essai gratuit, sans engagement.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white font-semibold px-8 py-4 rounded-lg text-sm transition-colors"
          >
            Créer ma box — c&apos;est gratuit <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.04] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="text-sm font-black tracking-tight">
            Athle<span className="text-[#C9A227]">X</span>
          </span>
          <div className="flex items-center gap-6">
            {[
              ['#fonctionnalites', 'Fonctionnalités'],
              ['#pour-qui', 'Pour qui'],
              ['/pricing', 'Tarifs'],
              ['/login', 'Connexion'],
            ].map(([href, label]) =>
              href.startsWith('#') ? (
                <a key={href} href={href} className="text-xs text-gray-600 hover:text-white transition-colors">
                  {label}
                </a>
              ) : (
                <Link key={href} href={href} className="text-xs text-gray-600 hover:text-white transition-colors">
                  {label}
                </Link>
              )
            )}
          </div>
          <p className="text-[11px] text-gray-700">© 2026 AthleX. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
