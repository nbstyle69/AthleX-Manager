export type Locale = "fr" | "en";
export type Profile = "athlete" | "pro";
export type ZoneCopy = {
  label: string;
  title: string;
  copy: string;
  features: string[];
  action: string;
};
export const plans = [
  { name: "Coach", monthly: 39, annual: 32, popular: false },
  { name: "Box", monthly: 79, annual: 62, popular: true },
];
export const testimonials: { quote: string; name: string; role: string }[] = [
  { quote: "", name: "", role: "" },
  { quote: "", name: "", role: "" },
  { quote: "", name: "", role: "" },
];
export const translations = {
  fr: {
    meta: {
      title: "AthleX — Ta box. Ton entraînement. Une seule plateforme.",
      description:
        "La plateforme Functional, Hybrid et Musculation pour ta box : l’app pour t’entraîner, la console pour la piloter. Découvre AthleX et AthleX Manager.",
    },
    nav: {
      features: "Fonctionnalités",
      ranking: "Classement",
      pricing: "Tarifs",
      faq: "FAQ",
      find: "Trouver une box",
      login: "Connexion",
      trial: "Essai gratuit",
      menu: "Ouvrir le menu",
      close: "Fermer le menu",
      main: "Navigation principale",
      language: "Langue",
      skip: "Aller au contenu",
    },
    hero: {
      eyebrow: "FUNCTIONAL · HYBRID · MUSCULATION",
      welcome: "BIENVENUE DANS TA NOUVELLE BOX",
      title:
        "La plateforme conçue pour les athlètes, les coachs, les owners et les salles.",
      subtitle: "L’app pour t’entraîner, la console pour la piloter.",
      intro: "Une seule plateforme. Tout ton univers.",
      choice: "CHOISIS TON ENTRÉE. ON TE FAIT VISITER.",
      athlete: "Je m’entraîne",
      athleteLine: "Entraîne-toi. Compète. Progresse.",
      pro: "Je gère une box ou je coache",
      proLine: "Gère. Anime. Développe.",
      reassurance: "Sans carte bancaire · Annulable à tout moment",
      scroll: "Entre. Explore. Dépasse-toi.",
      tour: "LA VISITE COMMENCE ICI",
      scene: "Visite 3D d’une salle de sport la nuit, à hauteur d’athlète.",
      reception: "ACCUEIL",
      open: "TA BOX EST OUVERTE",
      live: "TOUT EST CONNECTÉ",
      connected: "Athlètes · Coachs · Gérants",
      preview: "APERÇU DE LA PLATEFORME",
      room: "LE TERRAIN DE TOUS TES OBJECTIFS",
    },
    common: {
      athlete: "PARCOURS ATHLÈTE",
      pro: "PARCOURS PRO",
      shared: "POUR ALLER PLUS LOIN",
      zone: "ZONE",
      discover: "Découvrir",
      signup: "Créer mon compte athlète",
      create: "Créer ma box",
      start: "Commencer",
      next: "Continuer la visite",
      soon: "Bientôt disponible",
      appStore: "App Store",
      playStore: "Google Play",
      app: "L’APP ATHLEX",
      manager: "ATHLEX MANAGER",
      demo: "Aperçu illustratif",
      screenshot: "Aperçu de l’interface AthleX",
      scene: "Station de la salle en trois dimensions",
      express: "WOD express",
      after: "Après ma classe",
      generate: "Générer",
      regenerate: "Régénérer",
      generated: "Aperçu régénéré",
      functional: "Functional",
      hybrid: "Hybrid",
      strength: "Musculation",
      week: "LA SEMAINE DE TA BOX",
      session: "Séance",
      minutes: "min",
      timer: "TON TIMER EST PRÊT",
      today: "LE WOD DU JOUR",
      score: "Enregistrer mon score",
      movements: "Mouvements",
      training: "Entraînement",
      community: "Communauté",
      profile: "Profil",
      days: ["LUN", "MAR", "MER", "JEU", "VEN", "SAM"],
      programs: "PROGRAMMATION AUTOMATIQUE",
      active: "Activé",
      schedule: "Chaque samedi",
      reveal: "Publication à l’heure de ton choix",
      log: "Historique des générations",
      success: "Semaine générée",
      badge: "Badge débloqué",
      record: "CHAQUE EFFORT COMPTE",
      booking: "Planning & réservations",
      available: "Choisis ton prochain créneau",
      members: "Membres & rôles",
      athleteRole: "Athlète",
      coachRole: "Coach",
      ownerRole: "Gérant",
      secure: "Données protégées",
      competition: "CLASSEMENT ELO",
      noResults: "Tes prochains résultats commencent ici",
      messages: "Reste connecté à ta communauté",
      explore: "Explorer les programmes",
      import: "Importer un PDF",
      publish: "Publier à mes membres",
      target: "Choisis ton objectif",
      goals: ["Prise de muscle", "Force", "Tonification"],
      equipment: ["Sans matériel", "Box", "Salle complète"],
      formats: [
        "Compétition classique",
        "Élimination simple",
        "Élimination double",
        "Ligue par divisions",
      ],
      movementsList: ["Squats", "Pompes", "Burpees"],
      reps: "répétitions",
      generatedNote:
        "Démonstration de l’interface · crée ton compte pour générer tes séances",
    },
    map: {
      title: "LE PLAN DE TA BOX",
      subtitle: "Chaque zone, une nouvelle possibilité.",
      you: "TU ES ICI",
      reception: "Accueil",
      athlete: "Athlète",
      pro: "Gérant & coach",
      shared: "La suite",
      expand: "Afficher le plan",
      collapse: "Réduire le plan",
      navigation: "Plan interactif de la salle",
      progress: "Progression de la visite",
    },
    zones: [
      {
        label: "Les vestiaires",
        title: "Ton compte. Ta box. Ton point de départ.",
        copy: "Crée ton compte sur le web. Retrouve-le ensuite dans l’app mobile, dès sa sortie. Ton entraînement commence ici.",
        features: [
          "Rejoins ta box avec son code d’invitation",
          "Trouve une box près de chez toi",
          "Entraîne-toi sans box avec AthleX Fitness",
          "Une programmation ouverte, publiée chaque semaine",
        ],
        action: "Créer mon compte athlète",
      },
      {
        label: "Le tableau du jour",
        title: "Toute ta box. Sur un seul tableau.",
        copy: "Le WOD du jour, les scores et le classement de ta box. Tu sais ce qui t’attend avant même de passer la porte.",
        features: [
          "Réserve ta classe en un geste",
          "Retrouve les scores de chacun",
          "Reçois les actualités et notifications de ta box",
        ],
        action: "Rejoindre ma box",
      },
      {
        label: "La zone Functional",
        title: "Ton prochain WOD. Pas le même qu’hier.",
        copy: "Un générateur, trois disciplines, plus de 300 mouvements. Une séance express ou le complément idéal après ta classe : à toi de choisir.",
        features: [
          "Functional, Hybrid et Musculation",
          "WOD express pour une séance complète",
          "Après ma classe pour aller plus loin",
          "Un volume et des mouvements équilibrés",
        ],
        action: "Trouver mon prochain WOD",
      },
      {
        label: "La piste Hybrid",
        title: "Cours. Enchaîne. Va au bout.",
        copy: "Passe de la piste aux stations. Le générateur Hybrid compose des séances qui préparent ton corps à tous les efforts.",
        features: [
          "Séances de course à pied",
          "Enchaînements de stations",
          "Simulations de course",
          "Un timer adapté à chaque séance",
        ],
        action: "Explorer le Hybrid",
      },
      {
        label: "Le plateau Musculation",
        title: "La bonne charge. Le bon progrès.",
        copy: "173 exercices et trois objectifs : prise de muscle, force ou tonification. Une séance ajustée à ton corps, ton matériel et ton niveau.",
        features: [
          "Cible les groupes musculaires de ton choix",
          "Sans matériel, en box ou en salle complète",
          "Charges calculées sur ton 1RM ou guidées par RPE",
          "Calculateur 1RM et pourcentages ; timer préréglé, envoi au tableau en un geste et score enregistré",
        ],
        action: "Construire ma séance",
      },
      {
        label: "Le coin chrono",
        title: "Chaque seconde. Chaque répétition.",
        copy: "Lance ton timer et concentre-toi sur l’effort. Filme ta séance avec le chrono directement incrusté dans l’image.",
        features: [
          "AMRAP, EMOM, For Time, Tabata, Split et YWYR",
          "Revois tes répétitions",
          "Corrige ta technique",
          "Partage tes records personnels",
        ],
        action: "Découvrir les timers",
      },
      {
        label: "Salle de cours",
        title: "L’effort est personnel. Le défi se partage.",
        copy: "Entre dans l’arène. Quatre formats de tournois et un classement ELO qui évolue avec chacun de tes résultats.",
        features: [
          "Compétition classique et élimination simple",
          "Élimination double et ligue par divisions",
          "Compare-toi aux athlètes de ta box",
          "Mesure-toi à toute la communauté",
        ],
        action: "Voir le classement",
      },
      {
        label: "Le mur des records",
        title: "Tes efforts méritent leur place au mur.",
        copy: "Chaque répétition, chaque mètre, chaque calorie compte. Tes records et tes badges racontent le chemin parcouru.",
        features: [
          "Records personnels par mouvement",
          "Badges débloqués grâce à tes efforts cumulés",
          "Une carte et une notification pour célébrer chaque étape",
        ],
        action: "Commencer ma collection",
      },
      {
        label: "Le lounge",
        title: "Plus qu’une salle. Ta communauté.",
        copy: "L’entraînement ne s’arrête pas à la dernière répétition. Retrouve tes amis, échange avec ton coach et découvre ton prochain programme.",
        features: [
          "Amis et communauté au même endroit",
          "Messagerie directe avec ton coach",
          "Programmes créés par des coachs sur la marketplace",
        ],
        action: "Rejoindre la communauté",
      },
      {
        label: "La salle de programmation",
        title: "La semaine se prépare. Même quand tu récupères.",
        copy: "Active les disciplines de ta box. Chaque samedi, AthleX prépare la semaine et la révèle à tes membres à l’heure que tu choisis.",
        features: [
          "Functional : 6 séances par semaine",
          "Hybrid : 6 séances et un test de 75 min toutes les 8 semaines",
          "Musculation : 5 séances, cycles de 6 semaines",
          "Générer, régénérer et consulter chaque génération",
        ],
        action: "Automatiser ma programmation",
      },
      {
        label: "Le tableau de contrôle",
        title: "Ta méthode. Ton tableau. Tes règles.",
        copy: "Programme à la main, génère une séance ou importe tes WODs depuis un PDF. Un seul tableau pour donner le rythme à toute ta box.",
        features: [
          "Création manuelle de tes entraînements",
          "Génération et import PDF",
          "Publication du WOD à tous tes membres",
        ],
        action: "Prendre les commandes",
      },
      {
        label: "Le bureau du gérant",
        title: "Moins d’administratif. Plus de terrain.",
        copy: "AthleX Manager rassemble tout ce qui fait tourner ta box. Une vision claire, des outils simples, et du temps pour ce qui compte.",
        features: [
          "Membres, rôles, statuts, historique et abonnements",
          "Actualités, annonces et messagerie intégrée",
          "Statistiques avancées et export",
          "Un onglet Aide pour te guider sur chaque écran",
        ],
        action: "Découvrir AthleX Manager",
      },
      {
        label: "L’accueil & le planning",
        title: "Les bonnes personnes. Au bon créneau.",
        copy: "Oublie les allers-retours. Tes créneaux, les capacités et les réservations se gèrent au même endroit, automatiquement.",
        features: [
          "Un planning lisible pour toute la box",
          "Capacités de chaque cours maîtrisées",
          "Réservations automatiques côté athlètes",
        ],
        action: "Simplifier mon planning",
      },
      {
        label: "Salle de cours",
        title: "Fais vibrer ta box.",
        copy: "Organise des tournois internes ou inter-box. Donne à tes membres un nouveau rendez-vous et à ta salle une nouvelle visibilité.",
        features: [
          "Quatre formats de tournois",
          "Classements ELO en direct",
          "Compétitions internes et inter-box",
          "Présence dans l’annuaire public AthleX",
        ],
        action: "Créer ma box",
      },
      {
        label: "Le coin coach",
        title: "Indépendant. Jamais seul.",
        copy: "Ton expertise mérite les bons outils. Accompagne jusqu’à 20 athlètes et développe ton activité de coaching, au même endroit.",
        features: [
          "Programmation des workouts et des séances",
          "Vente de programmes sur la marketplace",
          "Réservations et suivi des athlètes",
          "Messagerie coach ↔ athlètes",
        ],
        action: "Commencer comme coach",
      },
      {
        label: "La salle sécurisée",
        title: "Ta box. Tes revenus. Tes données.",
        copy: "Tes paiements arrivent directement sur ton compte. Les données de ta communauté restent protégées, sans compromis.",
        features: [
          "Paiements sécurisés vers ton compte",
          "Hébergement européen",
          "Isolation stricte des données par box",
          "Conformité RGPD",
        ],
        action: "Créer ma box sereinement",
      },
      {
        label: "L’échauffement",
        title: "Opérationnel en 5 minutes.",
        copy: "Pas de mise en place interminable. Ta nouvelle façon de gérer ta box commence en trois étapes.",
        features: [
          "01 · Crée ta box",
          "02 · Invite tes membres avec ton code d’invitation",
          "03 · Gère tout au même endroit",
        ],
        action: "Créer ma box",
      },
    ] satisfies ZoneCopy[],
    testimonials: {
      label: "Le panneau d’affichage",
      title: "La parole au terrain.",
    },
    pricing: {
      label: "Le bureau des abonnements",
      title: "Le bon plan. Pour ton terrain.",
      copy: "Des outils complets. Des tarifs transparents. À toi de jouer.",
      monthly: "Mensuel",
      annually: "Annuel",
      perMonth: "/ mois",
      annualNote: "Facturé annuellement",
      monthlyNote: "Facturé mensuellement",
      popular: "Populaire",
      coachDescription: "Pour les coachs indépendants.",
      boxDescription: "Pour les boxs Functional & Hybrid. Tout compris.",
      coachFeatures: [
        "Jusqu’à 20 athlètes",
        "App mobile athlètes",
        "Planning & réservations",
        "Vente de programmes en ligne",
        "Messagerie coach ↔ athlètes",
        "Statistiques de base",
      ],
      boxFeatures: [
        "Tout le plan Coach, plus :",
        "Membres illimités",
        "Multi-coachs & rôles",
        "Programmation automatique Functional, Hybrid et Musculation",
        "Abonnements de salle automatiques",
        "Tournois & classements ELO",
        "Annuaire public AthleX",
        "Statistiques avancées & export",
        "Support prioritaire",
      ],
      trial: "Essai gratuit 14 jours",
      start: "Commencer",
      annualEquivalent: "en paiement annuel",
      reassurance: "Sans carte bancaire · Annulable à tout moment",
    },
    faq: {
      label: "Le panneau d’information",
      title: "Avant de passer la porte.",
      copy: "Les réponses aux questions que tu te poses.",
      entries: [
        {
          question: "Ai-je besoin d’une carte bancaire pour commencer ?",
          answer:
            "Non. L’essai gratuit de 14 jours du plan Box ne demande aucune carte. Tu ne paies que si tu décides de continuer.",
        },
        {
          question: "Mes athlètes doivent-ils payer l’application ?",
          answer:
            "Non. L’app mobile iOS et Android est gratuite pour tes athlètes : ils créent un compte et rejoignent ta box avec ton code d’invitation. Elle sera bientôt disponible.",
        },
        {
          question: "Comment sont gérés les paiements des abonnements ?",
          answer:
            "Les paiements de tes membres arrivent directement sur ton compte connecté ; AthleX ne fait qu’orchestrer les abonnements et les accès.",
        },
        {
          question: "Puis-je gérer plusieurs boxs avec un seul compte ?",
          answer:
            "Oui. Le plan Multi permet de gérer plusieurs boxs depuis un seul compte owner, avec un tarif de base + 29 €/box supplémentaire.",
        },
        {
          question: "Puis-je changer de formule ou annuler à tout moment ?",
          answer:
            "Oui. Tu peux passer d’un plan à l’autre ou résilier quand tu veux, sans engagement de durée.",
        },
        {
          question: "Mes données sont-elles en sécurité ?",
          answer:
            "Oui. Hébergement en Europe, chiffrement en transit, isolation stricte des données de chaque box et conformité RGPD.",
        },
        {
          question: "Comment sont construits les WODs générés ?",
          answer:
            "Chaque séance suit des règles de programmation précises : volume adapté, équilibre des mouvements, pas de répétition d’une séance à l’autre. La génération n’utilise pas d’IA : le résultat est cohérent et reproductible.",
        },
      ],
    },
    exit: {
      label: "La sortie ? Plutôt le début.",
      title: "Prêt à passer au niveau supérieur ?",
      copy: "Ton prochain chapitre commence ici. Quel que soit ton terrain.",
    },
    footer: {
      description:
        "La plateforme tout-en-un pour les boxs Functional, Hybrid et Musculation.",
      privacy: "Confidentialité",
      terms: "CGU",
      legal: "Mentions légales",
      copyright: "© 2026 AthleX — NBS Innovation. Tous droits réservés.",
    },
  },
  en: {
    meta: {
      title: "AthleX — Your gym. Your training. One platform.",
      description:
        "The Functional, Hybrid and Strength platform for your gym: the app to train, the console to run it. Discover AthleX and AthleX Manager.",
    },
    nav: {
      features: "Features",
      ranking: "Leaderboard",
      pricing: "Pricing",
      faq: "FAQ",
      find: "Find a gym",
      login: "Log in",
      trial: "Free trial",
      menu: "Open menu",
      close: "Close menu",
      main: "Main navigation",
      language: "Language",
      skip: "Skip to content",
    },
    hero: {
      eyebrow: "FUNCTIONAL · HYBRID · STRENGTH",
      welcome: "WELCOME TO YOUR NEW GYM",
      title: "The platform built for athletes, coaches, owners and gyms.",
      subtitle: "The app to train. The console to run it.",
      intro: "One platform. Your entire world.",
      choice: "CHOOSE YOUR ENTRANCE. LET US SHOW YOU AROUND.",
      athlete: "I’m an athlete",
      athleteLine: "Train. Compete. Progress.",
      pro: "I run a gym or coach",
      proLine: "Manage. Connect. Grow.",
      reassurance: "No credit card · Cancel anytime",
      scroll: "Step in. Explore. Go further.",
      tour: "YOUR TOUR STARTS HERE",
      scene: "An eye-level 3D tour of a gym at night.",
      reception: "RECEPTION",
      open: "YOUR GYM IS OPEN",
      live: "EVERYTHING IS CONNECTED",
      connected: "Athletes · Coaches · Owners",
      preview: "PLATFORM PREVIEW",
      room: "A HOME FOR EVERY AMBITION",
    },
    common: {
      athlete: "ATHLETE JOURNEY",
      pro: "PRO JOURNEY",
      shared: "TAKE IT FURTHER",
      zone: "ZONE",
      discover: "Discover",
      signup: "Create my athlete account",
      create: "Create my gym",
      start: "Get started",
      next: "Continue the tour",
      soon: "Coming soon",
      appStore: "App Store",
      playStore: "Google Play",
      app: "THE ATHLEX APP",
      manager: "ATHLEX MANAGER",
      demo: "Illustrative preview",
      screenshot: "AthleX interface preview",
      scene: "Three-dimensional gym station",
      express: "Express WOD",
      after: "After my class",
      generate: "Generate",
      regenerate: "Regenerate",
      generated: "Preview regenerated",
      functional: "Functional",
      hybrid: "Hybrid",
      strength: "Strength",
      week: "YOUR GYM’S WEEK",
      session: "Session",
      minutes: "min",
      timer: "YOUR TIMER IS READY",
      today: "WORKOUT OF THE DAY",
      score: "Log my score",
      movements: "Movements",
      training: "Training",
      community: "Community",
      profile: "Profile",
      days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      programs: "AUTOMATIC PROGRAMMING",
      active: "Enabled",
      schedule: "Every Saturday",
      reveal: "Published at the time you choose",
      log: "Generation history",
      success: "Week generated",
      badge: "Badge unlocked",
      record: "EVERY EFFORT COUNTS",
      booking: "Schedule & bookings",
      available: "Choose your next class",
      members: "Members & roles",
      athleteRole: "Athlete",
      coachRole: "Coach",
      ownerRole: "Owner",
      secure: "Protected data",
      competition: "ELO LEADERBOARD",
      noResults: "Your next results start here",
      messages: "Stay connected to your community",
      explore: "Explore programs",
      import: "Import a PDF",
      publish: "Publish to my members",
      target: "Choose your goal",
      goals: ["Build muscle", "Strength", "Toning"],
      equipment: ["No equipment", "Gym box", "Full gym"],
      formats: [
        "Classic competition",
        "Single elimination",
        "Double elimination",
        "Division league",
      ],
      movementsList: ["Squats", "Push-ups", "Burpees"],
      reps: "reps",
      generatedNote:
        "Interface demo · create your account to generate workouts",
    },
    map: {
      title: "YOUR GYM FLOOR PLAN",
      subtitle: "Every zone, a new possibility.",
      you: "YOU ARE HERE",
      reception: "Reception",
      athlete: "Athlete",
      pro: "Owner & coach",
      shared: "What’s next",
      expand: "Show floor plan",
      collapse: "Collapse floor plan",
      navigation: "Interactive gym floor plan",
      progress: "Tour progress",
    },
    zones: [
      {
        label: "The locker room",
        title: "Your account. Your gym. Your starting line.",
        copy: "Create your account on the web. Use it in the mobile app when it launches. Your training starts here.",
        features: [
          "Join your gym with its invitation code",
          "Find a gym near you",
          "Train independently with AthleX Fitness",
          "Open programming, published every week",
        ],
        action: "Create my athlete account",
      },
      {
        label: "The daily whiteboard",
        title: "Your whole gym. On one board.",
        copy: "Today’s workout, everyone’s scores and your gym’s leaderboard. Know what’s waiting before you walk through the door.",
        features: [
          "Book your class in one tap",
          "See everyone’s scores",
          "Get your gym’s news and notifications",
        ],
        action: "Join my gym",
      },
      {
        label: "The Functional zone",
        title: "Your next WOD. Not yesterday’s.",
        copy: "One generator, three disciplines, over 300 movements. A quick workout or the ideal addition after class: you choose.",
        features: [
          "Functional, Hybrid and Strength",
          "Express WOD for a complete session",
          "After my class to go further",
          "Balanced movements and adapted volume",
        ],
        action: "Find my next WOD",
      },
      {
        label: "The Hybrid track",
        title: "Run. Transition. Finish strong.",
        copy: "Move from the track to the stations. The Hybrid generator creates sessions that prepare your body for every challenge.",
        features: [
          "Running sessions",
          "Station combinations",
          "Race simulations",
          "A preset timer for every session",
        ],
        action: "Explore Hybrid",
      },
      {
        label: "The Strength floor",
        title: "The right load. Real progress.",
        copy: "173 exercises and three goals: muscle gain, strength or toning. Training adapted to your body, equipment and level.",
        features: [
          "Target your preferred muscle groups",
          "No equipment, gym box or full gym",
          "Loads based on your 1RM or guided by RPE",
          "1RM calculator and percentages; preset timer, one-tap whiteboard sharing and score logging",
        ],
        action: "Build my session",
      },
      {
        label: "The timing corner",
        title: "Every second. Every repetition.",
        copy: "Start your timer and focus on the effort. Record your session with the timer burned directly into the video.",
        features: [
          "AMRAP, EMOM, For Time, Tabata, Split and YWYR",
          "Replay your repetitions",
          "Improve your technique",
          "Share your personal records",
        ],
        action: "Explore the timers",
      },
      {
        label: "Class Gym",
        title: "The effort is yours. The challenge is shared.",
        copy: "Step into the arena. Four tournament formats and an ELO rating that evolves with every result.",
        features: [
          "Classic competition and single elimination",
          "Double elimination and division league",
          "Compare yourself with your gym",
          "Challenge the entire community",
        ],
        action: "View leaderboard",
      },
      {
        label: "The records wall",
        title: "Your hard work deserves a place on the wall.",
        copy: "Every rep, every meter, every calorie counts. Your records and badges tell the story of your progress.",
        features: [
          "Personal records for each movement",
          "Badges earned through cumulative effort",
          "A card and notification to celebrate every milestone",
        ],
        action: "Start my collection",
      },
      {
        label: "The lounge",
        title: "More than a gym. Your community.",
        copy: "Training doesn’t end at the last rep. Connect with friends, message your coach and discover your next program.",
        features: [
          "Friends and community in one place",
          "Direct messaging with your coach",
          "Coach-created programs on the marketplace",
        ],
        action: "Join the community",
      },
      {
        label: "The programming room",
        title: "Next week gets ready. While you recover.",
        copy: "Enable your gym’s disciplines. Every Saturday, AthleX prepares the week and reveals it to members at your chosen time.",
        features: [
          "Functional: 6 sessions per week",
          "Hybrid: 6 sessions and a 75-minute test every 8 weeks",
          "Strength: 5 sessions in 6-week cycles",
          "Generate, regenerate and review every generation",
        ],
        action: "Automate my programming",
      },
      {
        label: "Whiteboard control",
        title: "Your method. Your board. Your rules.",
        copy: "Program by hand, generate a session or import your workouts from a PDF. One whiteboard to set the pace for your entire gym.",
        features: [
          "Create workouts manually",
          "Generation and PDF import",
          "Publish the daily workout to all members",
        ],
        action: "Take control",
      },
      {
        label: "The owner’s office",
        title: "Less admin. More time on the floor.",
        copy: "AthleX Manager brings together everything that runs your gym. A clear overview, simple tools and time for what matters.",
        features: [
          "Members, roles, statuses, history and memberships",
          "News, announcements and built-in messaging",
          "Advanced analytics and export",
          "A Help tab to guide you through every screen",
        ],
        action: "Explore AthleX Manager",
      },
      {
        label: "Reception & schedule",
        title: "The right people. The right class.",
        copy: "Forget the back-and-forth. Time slots, capacities and bookings are handled in one place, automatically.",
        features: [
          "A clear schedule for the whole gym",
          "Manage each class’s capacity",
          "Automatic athlete bookings",
        ],
        action: "Simplify my schedule",
      },
      {
        label: "Class Gym",
        title: "Bring your gym to life.",
        copy: "Organize internal and inter-gym tournaments. Give members a new challenge and your gym new visibility.",
        features: [
          "Four tournament formats",
          "Live ELO leaderboards",
          "Internal and inter-gym competitions",
          "Listing in the public AthleX directory",
        ],
        action: "Create my gym",
      },
      {
        label: "The coach’s corner",
        title: "Independent. Never alone.",
        copy: "Your expertise deserves the right tools. Support up to 20 athletes and grow your coaching business in one place.",
        features: [
          "Workout and session programming",
          "Sell programs on the marketplace",
          "Bookings and athlete follow-up",
          "Coach ↔ athlete messaging",
        ],
        action: "Start coaching",
      },
      {
        label: "The safe room",
        title: "Your gym. Your revenue. Your data.",
        copy: "Payments go directly to your account. Your community’s data stays protected, without compromise.",
        features: [
          "Secure payments to your account",
          "European hosting",
          "Strict data isolation per gym",
          "GDPR compliant",
        ],
        action: "Create my gym with confidence",
      },
      {
        label: "The warm-up area",
        title: "Up and running in 5 minutes.",
        copy: "No endless setup. Your new way of running your gym begins in three steps.",
        features: [
          "01 · Create your gym",
          "02 · Invite members with your invitation code",
          "03 · Manage everything in one place",
        ],
        action: "Create my gym",
      },
    ] satisfies ZoneCopy[],
    testimonials: {
      label: "The notice board",
      title: "Straight from the training floor.",
    },
    pricing: {
      label: "The membership desk",
      title: "The right plan. For your gym.",
      copy: "Complete tools. Transparent pricing. Your move.",
      monthly: "Monthly",
      annually: "Annual",
      perMonth: "/ month",
      annualNote: "Billed annually",
      monthlyNote: "Billed monthly",
      popular: "Popular",
      coachDescription: "For independent coaches.",
      boxDescription: "For Functional & Hybrid gyms. Everything included.",
      coachFeatures: [
        "Up to 20 athletes",
        "Athlete mobile app",
        "Schedule & bookings",
        "Online program sales",
        "Coach ↔ athlete messaging",
        "Basic statistics",
      ],
      boxFeatures: [
        "Everything in Coach, plus:",
        "Unlimited members",
        "Multiple coaches & roles",
        "Automatic Functional, Hybrid and Strength programming",
        "Automatic gym memberships",
        "Tournaments & ELO rankings",
        "Public AthleX directory",
        "Advanced analytics & export",
        "Priority support",
      ],
      trial: "14-day free trial",
      start: "Get started",
      annualEquivalent: "with annual billing",
      reassurance: "No credit card · Cancel anytime",
    },
    faq: {
      label: "The information board",
      title: "Before you step inside.",
      copy: "Answers to the questions on your mind.",
      entries: [
        {
          question: "Do I need a credit card to get started?",
          answer:
            "No. The Box plan’s 14-day free trial requires no card. You only pay if you decide to continue.",
        },
        {
          question: "Do my athletes have to pay for the app?",
          answer:
            "No. The iOS and Android app is free for your athletes: they create an account and join your gym with your invitation code. It is coming soon.",
        },
        {
          question: "How are membership payments handled?",
          answer:
            "Your members’ payments go directly to your connected account; AthleX simply manages memberships and access.",
        },
        {
          question: "Can I manage several gyms with one account?",
          answer:
            "Yes. The Multi plan lets you manage multiple gyms from one owner account, with a base price plus €29 per additional gym.",
        },
        {
          question: "Can I change plans or cancel anytime?",
          answer:
            "Yes. You can switch plans or cancel whenever you want, with no minimum commitment.",
        },
        {
          question: "Is my data safe?",
          answer:
            "Yes. European hosting, encryption in transit, strict data isolation for each gym and GDPR compliance.",
        },
        {
          question: "How are generated WODs built?",
          answer:
            "Every session follows precise programming rules: adapted volume, balanced movements and no repetition from one session to the next. Generation does not use AI: the result is consistent and reproducible.",
        },
      ],
    },
    exit: {
      label: "The exit? More like the beginning.",
      title: "Ready to reach the next level?",
      copy: "Your next chapter starts here. Whatever your training ground.",
    },
    footer: {
      description:
        "The all-in-one platform for Functional, Hybrid and Strength gyms.",
      privacy: "Privacy",
      terms: "Terms",
      legal: "Legal notice",
      copyright: "© 2026 AthleX — NBS Innovation. All rights reserved.",
    },
  },
};
export type LandingCopy = typeof translations.fr;

export type Point3 = [number, number, number];
export type Station = {
  id: number;
  position: Point3;
  camera: Point3;
  target: Point3;
  rotation?: Point3;
  sides: Profile[];
  mockups: Partial<Record<Profile, number>>;
  featured?: boolean;
  screenshots?: Partial<Record<Profile, string>>;
};
export const tourOrder: Record<Profile, number[]> = {
  athlete: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  pro: [0, 1, 10, 2, 11, 7, 9],
};
export const entranceView = {
  camera: [0, 1.65, 22.5] as Point3,
  target: [0, 2.8, 19.4] as Point3,
};
export const insideView = {
  camera: [0, 1.65, 16] as Point3,
  target: [0, 1.8, -12] as Point3,
};
export const middleView = {
  camera: [0, 1.65, 1] as Point3,
  target: [0, 2, -14] as Point3,
};
export const gymFont = "/fonts/Oswald.ttf";
export const planRouteDetours: Partial<
  Record<Profile, Record<number, [number, number][]>>
> = {
  pro: {
    7: [
      [11.5, -10],
      [11.5, 10],
    ],
  },
};
export const roomBounds = { left: -12, right: 12, back: -19, front: 20 };
export const stationName = (locale: Locale, id: number) =>
  id < 0
    ? gymTranslations[locale].middle
    : id === 0
      ? gymTranslations[locale].entrance
      : gymTranslations[locale].names[id - 1];
export const gymTimerDisplay = "20:00";
export const gymPalette = {
  background: "#101214",
  surface: "#1c2023",
  metal: "#989fa3",
  light: "#f2f4f4",
  neon: "#9ae6d2",
};
export const stations: Station[] = [
  {
    id: 0,
    position: [0, 0, 19.5],
    ...entranceView,
    sides: ["athlete", "pro"],
    mockups: {},
  },
  {
    id: 1,
    position: [-8, 0, 12],
    camera: [-3, 1.65, 15],
    target: [-8, 1.3, 12],
    sides: ["athlete", "pro"],
    mockups: { athlete: 1, pro: 13 },
  },
  {
    id: 2,
    position: [-11.3, 0, 5],
    rotation: [0, Math.PI / 2, 0],
    camera: [-4, 1.65, 5],
    target: [-11.3, 1.8, 5],
    sides: ["athlete", "pro"],
    mockups: { athlete: 2, pro: 10 },
    featured: true,
  },
  {
    id: 3,
    position: [-8, 0, -2],
    camera: [-3, 1.65, 1],
    target: [-8, 1.6, -2],
    sides: ["athlete"],
    mockups: { athlete: 3 },
    featured: true,
  },
  {
    id: 4,
    position: [-8, 0, -8],
    camera: [-3, 1.65, -5],
    target: [-8, 1, -8],
    sides: ["athlete"],
    mockups: { athlete: 4 },
  },
  {
    id: 5,
    position: [-8, 0, -14],
    camera: [-3, 1.65, -11],
    target: [-8, 1.2, -14],
    sides: ["athlete"],
    mockups: { athlete: 5 },
  },
  {
    id: 6,
    position: [-3, 0, -18.7],
    camera: [-3, 1.65, -13],
    target: [-3, 2.4, -18.7],
    sides: ["athlete"],
    mockups: { athlete: 6 },
  },
  {
    id: 7,
    position: [6, 0, -10],
    camera: [1, 1.65, -7],
    target: [6, 1.3, -10],
    sides: ["athlete", "pro"],
    mockups: { athlete: 7, pro: 14 },
  },
  {
    id: 8,
    position: [7, 0, -18.6],
    camera: [7, 1.65, -13],
    target: [7, 2, -18.6],
    sides: ["athlete"],
    mockups: { athlete: 8 },
  },
  {
    id: 9,
    position: [10, 0, 10],
    rotation: [0, -Math.PI / 2, 0],
    camera: [4, 1.65, 10],
    target: [10, 1.1, 10],
    sides: ["athlete", "pro"],
    mockups: { athlete: 9, pro: 15 },
  },
  {
    id: 10,
    position: [9, 0, 16.7],
    rotation: [0, Math.PI, 0],
    camera: [5, 1.65, 12],
    target: [9, 1.5, 16.7],
    sides: ["pro"],
    mockups: { pro: 12 },
  },
  {
    id: 11,
    position: [9, 0, 4],
    rotation: [0, -Math.PI / 2, 0],
    camera: [4, 1.65, 4],
    target: [9, 1.2, 4],
    sides: ["pro"],
    mockups: { pro: 16 },
  },
];
export const gymTranslations = {
  fr: {
    title: "Entre dans la salle.",
    eyebrow: "LA VISITE ATHLEX",
    entrance: "Entrée",
    start: "Commencer la visite",
    guided: "Visite guidée",
    free: "Visiter librement",
    pause: "Pause",
    resume: "Reprendre",
    complete: "Tu as fait le tour.",
    pricing: "Voir les tarifs",
    restart: "Refaire la visite",
    welcome: "Bienvenue chez AthleX",
    middle: "Au cœur de la salle",
    profile: "Ton profil",
    stepwise: "À ton rythme : passe à la station suivante quand tu es prêt.",
    showApp: "Voir l’app",
    hideApp: "Masquer l’app",
    instruction:
      "Glisse pour regarder autour de toi. Clique sur un espace pour t’en approcher.",
    canvas:
      "Intérieur 3D d’une salle de sport la nuit. Explore les stations avec le plan ou les flèches du clavier.",
    loading: "Les portes de la salle s’ouvrent…",
    fallback: "La salle, en un coup d’œil.",
    fallbackCopy:
      "Sélectionne un espace sur le plan pour découvrir AthleX, à ton rythme.",
    previous: "Station précédente",
    next: "Station suivante",
    close: "Fermer le panneau",
    moving: "En route…",
    athlete: "Athlète",
    pro: "Box & coach",
    featured: "À découvrir",
    map: "Plan de la salle",
    route: "Ton parcours",
    you: "Tu es ici",
    tabs: "Découvrir ce côté de la station",
    showPanel: "Découvrir cette station",
    planMode: "Vue plan",
    sceneMode: "Vue 3D",
    stripe: "Paiements sécurisés par Stripe.",
    end: "Découvrir les offres",
    names: [
      "Accueil",
      "Tableau du jour",
      "Rig Functional",
      "Piste & stations",
      "Plateau Musculation",
      "Chrono & caméra",
      "Salle de cours",
      "Mur des trophées",
      "Lounge",
      "Bureau vitré",
      "Caisse",
    ],
    receptionCopy:
      "Crée ton compte sur le web : le même compte fonctionne dans l’app mobile. Rejoins ta box ou entraîne-toi à ton rythme.",
    receptionFeatures: [
      "Rejoins ta box avec son code d’invitation",
      "Trouve ta box dans l’annuaire",
      "Sans box ? AthleX Fitness est ta box démo",
      "Une programmation publiée chaque semaine",
    ],
    proReceptionCopy:
      "Crée ta box, invite tes membres avec un code et gère tout au même endroit. Les créneaux, capacités et réservations sont gérés automatiquement.",
    proReceptionFeatures: [
      "Crée ta box en quelques étapes",
      "Invite tes membres avec un code",
      "Créneaux et capacités centralisés",
      "Réservations automatiques",
    ],
    programmingCopy:
      "Trois disciplines à activer par box. Générées chaque samedi, révélées à l’heure de ton choix : ou programme à la main et importe tes WODs depuis un PDF.",
    programmingFeatures: [
      "Functional : 6 séances par semaine",
      "Hybrid : 6 séances — course, stations, simulations ; test de 75 min toutes les 8 semaines",
      "Musculation : 5 séances, cycles de 6 semaines",
      "Générer / Régénérer, historique et import PDF",
    ],
    generatorFeatures: [
      "Functional, Hybrid et Musculation · 300+ mouvements",
      "WOD express ou Après ma classe",
      "Timer préréglé et envoi au tableau en un geste",
      "Enregistre ton score après chaque séance",
    ],
    strengthFeature: "Calculateur 1RM intégré et pourcentages de travail",
    loungeFeature:
      "Achète les programmes des coachs en toute sécurité avec Stripe",
    coachFeature: "Vends tes programmes avec les paiements Stripe",
    cashCopy:
      "Abonnements de salle facturés automatiquement et ventes de programmes via Stripe. Les paiements arrivent directement sur ton propre compte.",
    cashFeatures: [
      "Abonnements et programmes payés via Stripe",
      "Hébergement européen",
      "Isolation stricte par box",
      "Conformité RGPD",
    ],
  },
  en: {
    title: "Step onto the floor.",
    eyebrow: "THE ATHLEX TOUR",
    entrance: "Entrance",
    start: "Start the tour",
    guided: "Guided tour",
    free: "Explore freely",
    pause: "Pause",
    resume: "Resume",
    complete: "You’ve seen it all.",
    pricing: "See pricing",
    restart: "Restart the tour",
    welcome: "Welcome to AthleX",
    middle: "The heart of the gym",
    profile: "Your profile",
    stepwise: "At your pace: choose the next station when you’re ready.",
    showApp: "See the app",
    hideApp: "Hide the app",
    instruction: "Drag to look around. Click a space to walk closer.",
    canvas:
      "First-person 3D gym interior at night. Explore stations using the floor plan or keyboard arrows.",
    loading: "Opening the gym doors…",
    fallback: "Your gym at a glance.",
    fallbackCopy:
      "Choose a space on the plan to discover AthleX at your own pace.",
    previous: "Previous station",
    next: "Next station",
    close: "Close panel",
    moving: "On the way…",
    athlete: "Athlete",
    pro: "Gym & coach",
    featured: "Featured",
    map: "Gym floor plan",
    route: "Your tour",
    you: "You are here",
    tabs: "Explore this side of the station",
    showPanel: "Explore this station",
    planMode: "Floor plan",
    sceneMode: "3D view",
    stripe: "Secure payments by Stripe.",
    end: "Explore the plans",
    names: [
      "Front desk",
      "Whiteboard",
      "Functional rig",
      "Track & stations",
      "Strength floor",
      "Clock & camera",
      "Class Gym",
      "Trophy wall",
      "Lounge",
      "Glass office",
      "Cash desk",
    ],
    receptionCopy:
      "Create your account on the web: the same account works in the mobile app. Join your gym or train on your own terms.",
    receptionFeatures: [
      "Join your gym with its invitation code",
      "Find your gym in the directory",
      "No gym? AthleX Fitness is your demo gym",
      "Fresh programming published every week",
    ],
    proReceptionCopy:
      "Create your gym, invite members with a code and manage everything in one place. Time slots, capacities and bookings are handled automatically.",
    proReceptionFeatures: [
      "Create your gym in a few steps",
      "Invite members with a code",
      "Time slots and capacities in one place",
      "Automatic class bookings",
    ],
    programmingCopy:
      "Switch on three tracks per gym. Generated every Saturday, revealed when you choose — or program manually and import workouts from a PDF.",
    programmingFeatures: [
      "Functional: 6 sessions per week",
      "Hybrid: 6 sessions — running, stations, simulations; a 75-minute test every 8 weeks",
      "Strength: 5 sessions on 6-week cycles",
      "Generate / Regenerate, generation log and PDF import",
    ],
    generatorFeatures: [
      "Functional, Hybrid and Strength · 300+ movements",
      "Express WOD or After my class",
      "Preset timer and one tap to send to the whiteboard",
      "Log your score after every session",
    ],
    strengthFeature: "Built-in 1RM calculator and working percentages",
    loungeFeature: "Buy coaches’ programs securely with Stripe",
    coachFeature: "Sell your programs with Stripe payments",
    cashCopy:
      "Automatic gym membership billing and program sales through Stripe. Payments go directly into your own account.",
    cashFeatures: [
      "Memberships and programs paid through Stripe",
      "European hosting",
      "Strict isolation per gym",
      "GDPR compliant",
    ],
  },
};
const panelDescriptions: Record<
  Locale,
  Record<number, Partial<Record<Profile, string>>>
> = {
  fr: {
    1: {
      athlete:
        "Ton compte web et mobile. Rejoins une box ou entraîne-toi à ton rythme.",
      pro: "Crée ta box et invite tes membres. Les réservations se gèrent automatiquement.",
    },
    2: {
      athlete:
        "Le programme du jour, tes mouvements et ton score. Tout est au même endroit.",
      pro: "Trois disciplines. Génère ta semaine, programme à la main ou importe un PDF.",
    },
    3: {
      athlete:
        "Ta séance Functional, selon ton temps et ton niveau. Génère, puis entraîne-toi.",
    },
    4: {
      athlete:
        "Course, stations et simulations. Prépare ton prochain défi Hybrid.",
    },
    5: {
      athlete:
        "Des cycles structurés et les bonnes charges. Construis ta force, séance après séance.",
    },
    6: {
      athlete:
        "Lance ton chrono, filme ta séance et garde une trace de chaque effort.",
    },
    7: {
      athlete:
        "Des formats pour te mesurer aux autres. Ton prochain défi commence ici.",
      pro: "Anime ta communauté avec des compétitions et des classements partagés.",
    },
    8: {
      athlete:
        "Tes records, tes badges, ta progression. Chaque effort laisse sa marque.",
    },
    9: {
      athlete:
        "Échange avec ta communauté et découvre les programmes des coachs.",
      pro: "Reste proche de tes athlètes et partage tes programmes avec ta communauté.",
    },
    10: {
      pro: "Membres, rôles et équipe. Pilote ta box depuis un seul espace.",
    },
    11: {
      pro: "Abonnements et programmes via Stripe. Les paiements arrivent sur ton compte.",
    },
  },
  en: {
    1: {
      athlete:
        "One account for web and mobile. Join a gym or train on your own terms.",
      pro: "Create your gym and invite members. Class bookings take care of themselves.",
    },
    2: {
      athlete:
        "Today’s workout, your movements and your score. Everything in one place.",
      pro: "Three tracks. Generate your week, program by hand or import a PDF.",
    },
    3: {
      athlete:
        "Functional training for your time and level. Generate a workout and get moving.",
    },
    4: {
      athlete:
        "Running, stations and simulations. Get ready for your next Hybrid challenge.",
    },
    5: {
      athlete:
        "Structured cycles and the right loads. Build strength, session by session.",
    },
    6: {
      athlete:
        "Start your timer, record your session and keep track of every effort.",
    },
    7: {
      athlete:
        "Find your format and compete with others. Your next challenge starts here.",
      pro: "Bring your community together with competitions and shared rankings.",
    },
    8: {
      athlete:
        "Your records, badges and progress. Every effort leaves its mark.",
    },
    9: {
      athlete:
        "Connect with your community and discover programs from coaches.",
      pro: "Stay close to your athletes and share programs with your community.",
    },
    10: {
      pro: "Members, roles and your team. Manage your gym from one place.",
    },
    11: {
      pro: "Memberships and programs through Stripe. Payments go straight to your account.",
    },
  },
};

export function getStationCopy(
  locale: Locale,
  id: number,
  side: Profile,
): ZoneCopy {
  const t = translations[locale],
    g = gymTranslations[locale];
  const original =
    side === "pro"
      ? (
          { 1: 16, 2: 9, 7: 13, 9: 14, 10: 11, 11: 15 } as Record<
            number,
            number
          >
        )[id]
      : id - 1;
  const base = t.zones[original ?? 0];
  const result: ZoneCopy = {
    ...base,
    label: g.names[id - 1],
    features: [...base.features],
  };
  if (id === 1) {
    result.copy = side === "pro" ? g.proReceptionCopy : g.receptionCopy;
    result.features =
      side === "pro" ? g.proReceptionFeatures : g.receptionFeatures;
  }
  if (id === 2 && side === "pro") {
    result.copy = g.programmingCopy;
    result.features = g.programmingFeatures;
  }
  if (id === 3) result.features = g.generatorFeatures;
  if (id === 5)
    result.features = [...result.features.slice(0, 3), g.strengthFeature];
  if (id === 9)
    result.features =
      side === "pro"
        ? [result.features[0], g.coachFeature, ...result.features.slice(2)]
        : [...result.features, g.loungeFeature];
  if (id === 11) {
    result.copy = g.cashCopy;
    result.features = g.cashFeatures;
  }
  result.copy = panelDescriptions[locale][id]?.[side] ?? result.copy;
  return result;
}
