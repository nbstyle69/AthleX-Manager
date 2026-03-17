import Link from 'next/link';
import {
  CalendarClock, LayoutTemplate, Dumbbell, Trophy,
  Users, MessageSquare, Smartphone, ChevronRight,
  CheckCircle2, Zap, Shield, BarChart3, Timer,
  Video, Star, TrendingUp,
} from 'lucide-react';

const FEATURES = [
  { icon: CalendarClock, title: 'Horaires & Créneaux',   desc: "Planifiez vos cours, gérez les capacités et visualisez toute votre semaine en un coup d'œil.",  color: '#C9A227' },
  { icon: LayoutTemplate, title: 'Modèle de semaine',    desc: 'Définissez votre semaine type une fois, générez automatiquement vos horaires à chaque semaine.', color: '#C9A227' },
  { icon: Dumbbell,       title: 'Whiteboard WOD',       desc: 'Publiez le WOD du jour, suivez et validez les scores de vos membres en temps réel.',              color: '#22C55E' },
  { icon: Trophy,         title: 'Tournois & ELO',       desc: 'Organisez des tournois internes avec classement ELO, soumission de scores et validation vidéo.',   color: '#D97706' },
  { icon: Users,          title: 'Gestion des membres',  desc: "Gérez vos adhérents, créez des groupes et suivez l'activité de votre communauté.",                color: '#8B5CF6' },
  { icon: MessageSquare,  title: 'Messagerie temps réel',desc: 'Communiquez avec vos membres via un chat en temps réel. Annonces, groupes, échanges.',             color: '#06B6D4' },
];

const PERSONAS = [
  {
    emoji: '🏋️',
    role: 'Athlète',
    sub: 'Performe. Compétis. Progresse.',
    highlight: true,
    items: [
      { icon: CalendarClock, text: 'Réserve tes créneaux de cours en 2 taps' },
      { icon: Dumbbell,      text: 'Découvre le WOD du jour à tout moment' },
      { icon: Timer,         text: 'Lance le timer et enregistre ta perf en vidéo' },
      { icon: TrendingUp,    text: 'Compare-toi au leaderboard de ta box' },
      { icon: Trophy,        text: 'Participe aux tournois et grimpe le classement ELO' },
      { icon: Star,          text: 'Suis tes records personnels (PR)' },
    ],
  },
  {
    emoji: '📋',
    role: 'Coach',
    sub: 'Programme. Encadre. Valide.',
    highlight: false,
    items: [
      { icon: Dumbbell,      text: 'Publie le WOD du jour sur le whiteboard' },
      { icon: CheckCircle2,  text: 'Valide les scores soumis par les athlètes' },
      { icon: CalendarClock, text: 'Gère les créneaux et capacités de tes cours' },
      { icon: MessageSquare, text: 'Communique avec ta communauté en temps réel' },
      { icon: Trophy,        text: 'Organise des tournois et compétitions internes' },
      { icon: BarChart3,     text: "Accède aux stats de ta box en un coup d'œil" },
    ],
  },
  {
    emoji: '🏢',
    role: 'Gérant de box',
    sub: 'Pilote. Développe. Maîtrise.',
    highlight: false,
    items: [
      { icon: Zap,           text: 'Crée et gère ton espace box en quelques minutes' },
      { icon: Users,         text: 'Invite tes membres via un code unique' },
      { icon: LayoutTemplate,text: 'Génère les horaires depuis un modèle hebdomadaire' },
      { icon: BarChart3,     text: 'Dashboard KPIs : membres, scores, tournois' },
      { icon: MessageSquare, text: 'Messagerie et annonces pour toute la box' },
      { icon: Shield,        text: 'Données sécurisées, accès contrôlé par rôle' },
    ],
  },
];

const STEPS = [
  { num: '01', title: 'Créez votre box', desc: 'Inscrivez-vous en 2 minutes et configurez votre espace en ligne.' },
  { num: '02', title: 'Invitez vos membres', desc: "Partagez un code d'invitation — vos athlètes rejoignent en un tap depuis l'app." },
  { num: '03', title: "Gérez tout depuis l'app", desc: 'Horaires, WODs, tournois, messages — tout est accessible partout.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased">

      {/* NAVBAR — same bg as sidebar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#C9A227]/20 flex items-center justify-center">
              <Zap size={15} className="text-[#C9A227]" />
            </div>
            <span className="text-base font-black tracking-tight">Athle<span className="text-[#C9A227]">X</span></span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {[['#pour-qui','Pour qui ?'],['#features','Fonctionnalités'],['#how','Comment ça marche'],['#app','Application']].map(([href, label]) => (
              <a key={href} href={href} className="px-3 py-2 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all">{label}</a>
            ))}
          </div>
          <Link href="/login" className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#B8911F] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            Se connecter <ChevronRight size={14} />
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#C9A227]/6 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-full px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#C9A227] mb-8">
            <Zap size={11} /> Plateforme tout-en-un pour box CrossFit
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight mb-6">
            Votre box a du niveau.<br /><span className="text-[#C9A227]">Votre outil aussi.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
            AthleX connecte <strong className="text-white">athlètes, coachs et gérants</strong> dans un seul espace.
          </p>
          <p className="text-base text-gray-500 max-w-xl mx-auto mb-10">
            Réserve tes cours, suis tes perfs, compétis — ou gère ta box. Horaires, WODs, tournois, messagerie, tout y est.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-[#C9A227]/20">
              Créer ma box gratuitement <ChevronRight size={16} />
            </Link>
            <a href="#pour-qui" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#111111] border border-white/8 hover:border-white/15 text-gray-300 hover:text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-all">
              Découvrir les fonctionnalités
            </a>
          </div>
        </div>

        {/* Dashboard mockup — same card style as admin */}
        <div className="relative max-w-5xl mx-auto mt-20">
          <div className="bg-[#080808] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
            {/* Fake titlebar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              <div className="ml-3 bg-white/5 rounded-lg px-3 py-0.5 text-[11px] text-gray-500">app.athlex.io/horaires</div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#C9A227]/30 flex items-center justify-center text-[#C9A227] text-[9px] font-black">A</div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-7 gap-2">
                {[{d:'Lun',n:16},{d:'Mar',n:17},{d:'Mer',n:18},{d:'Jeu',n:19},{d:'Ven',n:20},{d:'Sam',n:21},{d:'Dim',n:22}].map(({ d, n }, i) => (
                  <div key={d} className="space-y-1.5">
                    <div className={`rounded-xl px-2 py-2 text-center ${i === 0 ? 'bg-[#C9A227] border border-[#C9A227]' : 'bg-[#111111] border border-white/8'}`}>
                      <p className={`text-[10px] font-bold ${i === 0 ? 'text-white/80' : 'text-gray-500'}`}>{d}</p>
                      <p className={`text-sm font-black ${i === 0 ? 'text-white' : 'text-gray-400'}`}>{n}</p>
                    </div>
                    {i < 5 && (
                      <>
                        <div className="bg-[#111111] border border-white/8 rounded-xl p-2 hover:border-white/15 transition-colors">
                          <p className="text-[9px] text-[#C9A227] font-bold">09:00–10:00</p>
                          <p className="text-[10px] text-white font-semibold">CrossFit</p>
                          <p className="text-[9px] text-gray-600">15 places</p>
                        </div>
                        <div className="bg-[#111111] border border-white/8 rounded-xl p-2 hover:border-white/15 transition-colors">
                          <p className="text-[9px] text-[#C9A227] font-bold">11:00–12:00</p>
                          <p className="text-[10px] text-white font-semibold">Haltéro</p>
                          <p className="text-[9px] text-gray-600">10 places</p>
                        </div>
                        {i < 3 && (
                          <div className="bg-[#111111] border border-white/8 rounded-xl p-2 hover:border-white/15 transition-colors">
                            <p className="text-[9px] text-[#C9A227] font-bold">18:00–19:00</p>
                            <p className="text-[10px] text-white font-semibold">Open Gym</p>
                            <p className="text-[9px] text-gray-600">20 places</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 -bottom-8 h-16 bg-gradient-to-t from-[#0A0A0A] to-transparent pointer-events-none" />
        </div>
      </section>

      {/* STATS — KPI style like dashboard */}
      <section className="py-10 px-6 border-y border-white/[0.06]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { val: '3 profils', label: 'Athlète, Coach, Gérant', icon: Users, color: '#8B5CF6' },
            { val: 'iOS & Android', label: 'App disponible', icon: Smartphone, color: '#22C55E' },
            { val: 'Temps réel', label: 'Scores & messages', icon: Zap, color: '#D97706' },
            { val: 'Gratuit', label: 'Pour commencer', icon: Star, color: '#C9A227' },
          ].map(({ val, label, icon: Icon, color }) => (
            <div key={label} className="bg-[#111111] border border-white/8 rounded-2xl p-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p className="text-xl font-black text-white">{val}</p>
              <p className="text-xs text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* POUR QUI */}
      <section id="pour-qui" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-md px-2 py-0.5">Pour qui ?</span>
            <h2 className="text-4xl md:text-5xl font-black mt-4">Une app pour toute votre box</h2>
            <p className="text-gray-400 mt-3 text-base max-w-lg mx-auto">
              Athlètes, coachs, gérants — chacun a sa place sur AthleX.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PERSONAS.map(({ emoji, role, sub, highlight, items }) => (
              <div key={role} className={`rounded-2xl border p-6 flex flex-col ${
                highlight
                  ? 'bg-[#111111] border-[#C9A227]/40 relative overflow-hidden'
                  : 'bg-[#111111] border-white/8'
              }`}>
                {highlight && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#C9A227]" />
                )}
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white">{role}</h3>
                      {highlight && (
                        <span className="text-[9px] font-extrabold uppercase tracking-widest bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30 rounded px-1.5 py-0.5">
                          ★ App mobile
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{sub}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5">
                  {items.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        highlight ? 'bg-[#C9A227]/15' : 'bg-white/5'
                      }`}>
                        <Icon size={11} className={highlight ? 'text-[#C9A227]' : 'text-gray-500'} />
                      </div>
                      <span className="text-sm text-gray-400 leading-tight">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 bg-[#080808] border-y border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-md px-2 py-0.5">Fonctionnalités</span>
            <h2 className="text-4xl md:text-5xl font-black mt-4">Tout ce dont votre box a besoin</h2>
            <p className="text-gray-400 mt-3 text-base max-w-xl mx-auto">
              De la gestion quotidienne à l&apos;organisation de compétitions, AthleX couvre l&apos;essentiel.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="group bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <h3 className="font-bold text-white">{title}</h3>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-md px-2 py-0.5">Comment ça marche</span>
            <h2 className="text-4xl md:text-5xl font-black mt-4">Opérationnel en 5 minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="bg-[#111111] border border-white/8 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-[#C9A227]/20 flex items-center justify-center mb-4">
                  <span className="text-sm font-black text-[#C9A227]">{num}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APP MOBILE */}
      <section id="app" className="py-24 px-6 bg-[#080808] border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-10 md:p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/[0.06]">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-md px-2 py-0.5 w-fit mb-5">
                  Application mobile
                </span>
                <h2 className="text-3xl md:text-4xl font-black mb-3">
                  Vos athlètes ont leur app.<br /><span className="text-[#C9A227]">iOS & Android.</span>
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                  Réservation de créneaux, WOD du jour, timer avec enregistrement vidéo,
                  tournois, messagerie et profil personnel — tout dans une seule application.
                </p>
                <ul className="space-y-2.5 mb-8">
                  {[
                    { icon: Timer,         text: 'Timer CrossFit avec enregistrement vidéo' },
                    { icon: Video,         text: 'Soumission et validation des scores' },
                    { icon: Trophy,        text: 'Classement ELO et tournois internes' },
                    { icon: MessageSquare, text: 'Chat en temps réel avec la box' },
                    { icon: Star,          text: 'Profil athlète avec records personnels (PR)' },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-6 h-6 rounded-lg bg-[#C9A227]/15 flex items-center justify-center shrink-0">
                        <Icon size={12} className="text-[#C9A227]" />
                      </div>
                      {text}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors w-fit">
                  Commencer maintenant <ChevronRight size={15} />
                </Link>
              </div>

              {/* Phone mockup */}
              <div className="flex items-center justify-center p-10 bg-[#0d0d0d]">
                <div className="relative">
                  <div className="w-56 bg-[#111111] border-2 border-white/10 rounded-[2.5rem] p-3 shadow-2xl">
                    <div className="bg-[#0A0A0A] rounded-[2.2rem] overflow-hidden p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">AthleX</span>
                        <div className="w-5 h-5 rounded-lg bg-[#C9A227]/20 flex items-center justify-center">
                          <Zap size={11} className="text-[#C9A227]" />
                        </div>
                      </div>
                      <div className="bg-[#111111] border border-white/8 rounded-xl p-3">
                        <p className="text-[9px] text-[#C9A227] font-extrabold uppercase tracking-wider mb-1">WOD du jour</p>
                        <p className="text-[11px] font-black text-white">AMRAP 20min</p>
                        <p className="text-[9px] text-gray-500 mt-1">5 Pull-ups · 10 Push-ups · 15 Squats</p>
                      </div>
                      <div className="bg-[#C9A227] rounded-xl p-2.5 text-center">
                        <p className="text-[10px] font-black text-white">▶ DÉMARRER LE TIMER</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">Leaderboard</p>
                        {[['Alex M.','12 rds'],['Sara K.','11 rds'],['Tom B.','10 rds']].map(([name, score], i) => (
                          <div key={name} className="flex items-center gap-2 bg-[#111111] border border-white/8 rounded-lg px-2 py-1.5">
                            <span className="text-[9px] font-black text-[#C9A227] w-3">{i + 1}</span>
                            <span className="text-[9px] text-gray-300 flex-1">{name}</span>
                            <span className="text-[9px] font-bold text-gray-500">{score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Floating tournament card */}
                  <div className="absolute -top-3 -right-10 w-32 bg-[#111111] border-2 border-white/10 rounded-2xl p-2.5 shadow-xl rotate-6 opacity-90">
                    <div className="bg-[#0A0A0A] rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-[#D97706]/20 flex items-center justify-center">
                          <Trophy size={9} className="text-[#D97706]" />
                        </div>
                        <p className="text-[8px] text-white font-bold">Spring Open</p>
                      </div>
                      <div className="bg-[#C9A227]/15 border border-[#C9A227]/20 rounded-lg px-1.5 py-1">
                        <p className="text-[7px] text-[#C9A227] font-extrabold text-center uppercase tracking-wide">8 participants</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-28 px-6 relative overflow-hidden border-t border-white/[0.06]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#C9A22710_0%,_transparent_65%)] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black mb-5">
            Prêt à transformer<br /><span className="text-[#C9A227]">votre box ?</span>
          </h2>
          <p className="text-gray-400 text-base mb-10 max-w-md mx-auto">
            Rejoignez AthleX et donnez à votre communauté les outils qu&apos;elle mérite.
          </p>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white font-bold px-10 py-4 rounded-xl text-base transition-colors shadow-lg shadow-[#C9A227]/20">
            Créer ma box — c&apos;est gratuit <ChevronRight size={18} />
          </Link>
          <div className="flex flex-wrap justify-center gap-5 mt-8">
            {['Aucune installation', 'Données sécurisées', 'Mises à jour auto', 'Support réactif'].map(p => (
              <div key={p} className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle2 size={13} className="text-[#C9A227]" />{p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] bg-[#080808] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#C9A227]/20 flex items-center justify-center">
              <Zap size={13} className="text-[#C9A227]" />
            </div>
            <div>
              <p className="text-sm font-black">Athle<span className="text-[#C9A227]">X</span></p>
              <p className="text-[10px] text-gray-600">La plateforme des box CrossFit qui veulent aller plus loin.</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[['#pour-qui','Pour qui ?'],['#features','Fonctionnalités'],['#app','Application'],['/login','Connexion']].map(([href, label]) => (
              href.startsWith('#')
                ? <a key={href} href={href} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:text-white hover:bg-white/5 transition-all font-medium">{label}</a>
                : <Link key={href} href={href} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:text-white hover:bg-white/5 transition-all font-medium">{label}</Link>
            ))}
          </div>
          <p className="text-[11px] text-gray-700">© 2026 AthleX. Tous droits réservés.</p>
        </div>
      </footer>

    </div>
  );
}
