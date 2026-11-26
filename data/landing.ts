export type Locale = "fr" | "en";

// Prix affichés (€ / mois). Les montants facturés vivent dans Stripe
// (STRIPE_PRICE_MONTHLY_ID / STRIPE_PRICE_ANNUAL_ID) : garder ces chiffres alignés.
export const plans = {
  coach: { monthly: 39, annual: 32 },
  box: { monthly: 79, annual: 62 },
};

// Pages détaillées : /athletes (lot 2). Tant que /coachs (lot 3) n'est pas en
// ligne, « Box & coachs » mène à la section « Pour qui ? » de l'accueil
// (une ancre est préfixée par /landing hors de l'accueil, voir pageHref).
export const athletesHref = "/athletes";
export const coachsHref = "#pour-qui";

// Lien interne qui garde la langue : ?lang=en sur les pages de la landing,
// et /landing devant une ancre de l'accueil quand on n'y est pas.
export function pageHref(target: string, locale: Locale, onHome: boolean) {
  const q = locale === "en" ? "?lang=en" : "";
  if (target.startsWith("#")) return onHome ? target : `/landing${q}${target}`;
  if (["/landing", "/athletes", "/coachs"].includes(target)) return target + q;
  return target;
}

// Questions affichées sur l'accueil (indices dans faq.entries) ; « Voir toutes
// les questions » déplie les autres.
export const homeFaq = [0, 1, 2, 4, 5];

export const translations = {
  fr: {
    meta: {
      title: "AthleX — Ta box. Ton entraînement. Une seule plateforme.",
      description:
        "La plateforme Functional, Hybrid et Musculation pour ta box : l’app pour t’entraîner, la console pour la piloter. Découvre AthleX et AthleX Manager.",
    },
    nav: {
      athletes: "Athlètes",
      coachs: "Box & coachs",
      pricing: "Tarifs",
      faq: "FAQ",
      find: "Trouver une box",
      ranking: "Classement",
      login: "Connexion",
      trial: "Essai gratuit",
      menu: "Ouvrir le menu",
      close: "Fermer le menu",
      main: "Navigation principale",
      language: "Langue",
      skip: "Aller au contenu",
    },
    common: {
      create: "Créer ma box",
      signup: "Créer mon compte athlète",
      trial: "Essai gratuit 14 jours",
      download: "Télécharger sur",
      available: "Disponible sur",
      appStore: "App Store",
      playStore: "Google Play",
    },
    hero: {
      eyebrow: "FUNCTIONAL · HYBRID · MUSCULATION",
      title: "Une plateforme unique conçue pour tous.",
      subtitle:
        "L’app pour t’entraîner, la console pour la piloter. Programmation, tournois, réservations et abonnements au même endroit.",
      create: "Créer ma box — essai 14 jours",
      athlete: "Je suis athlète",
      reassurance: [
        "Sans carte bancaire",
        "Annulable à tout moment",
        "Données protégées",
      ],
    },
    audience: {
      label: "Pour qui ?",
      title: "Un espace pour chacun.",
      copy: "Tu t’entraînes ou tu fais tourner une salle : chacun a son espace, connecté à l’autre.",
      athlete: {
        title: "Je m’entraîne",
        tagline: "Entraîne-toi. Compète. Progresse.",
        features: [
          "WOD et séances générés : Functional, Hybrid, Musculation",
          "Minuteur, scores, records et 1RM suivis",
          "Tournois de box et classement ELO",
          "Badges et défis entre amis",
        ],
        more: "Tout sur l’espace Athlètes",
      },
      pro: {
        title: "Je gère une box ou je coache",
        tagline: "Gère. Anime. Développe.",
        features: [
          "Programmation automatique et whiteboard",
          "Planning, créneaux et réservations",
          "Abonnements de salle encaissés par Stripe ou au comptoir",
          "Tournois, annonces et notifications à tes membres",
        ],
        more: "Tout sur l’espace Box & coachs",
      },
    },
    steps: {
      label: "Pour les box",
      title: "Ta box en ligne en 3 étapes.",
      items: [
        {
          title: "Crée ta box",
          copy: "Nom, logo, horaires et formules. L’essai de 14 jours démarre sans carte.",
        },
        {
          title: "Invite tes membres",
          copy: "Code à 6 caractères, lien, QR code ou import CSV.",
        },
        {
          title: "Programme et anime",
          copy: "WOD générés, whiteboard, tournois et classements, annonces.",
        },
      ],
    },
    pricing: {
      label: "Tarifs",
      title: "Le bon plan. Pour ton terrain.",
      copy: "Des tarifs transparents. Change de formule ou annule quand tu veux.",
      billing: "Période de facturation",
      monthly: "Mensuel",
      annually: "Annuel",
      discount: "jusqu’à −21 %",
      perMonth: "/ mois",
      annualNote: "Facturé annuellement",
      popular: "Populaire",
      coachDescription: "Pour les coachs indépendants.",
      boxDescription: "Pour les box Functional et Hybrid. Tout compris.",
      coachFeatures: [
        "Jusqu’à 20 athlètes",
        "App mobile pour tes athlètes",
        "Planning et réservations",
        "Vente de programmes en ligne",
      ],
      boxFeatures: [
        "Membres illimités",
        "Multi-coachs et rôles",
        "Programmation automatique",
        "Abonnements de salle automatiques",
      ],
      start: "Commencer",
      reassurance:
        "Paiements sécurisés par Stripe · Sans carte bancaire · Annulable à tout moment",
      compare: "Comparer toutes les fonctionnalités",
    },
    faq: {
      label: "FAQ",
      title: "Avant de passer la porte.",
      more: "Voir toutes les questions",
      entries: [
        {
          question: "Ai-je besoin d’une carte bancaire pour commencer ?",
          answer:
            "Non. L’essai gratuit de 14 jours du plan Box ne demande aucune carte. Tu ne paies que si tu décides de continuer.",
        },
        {
          question: "Mes athlètes doivent-ils payer l’application ?",
          answer:
            "Non. L’application est gratuite pour tes athlètes, sur l’App Store et Google Play.",
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
      title: "Prêt à passer au niveau supérieur ?",
      copy: "Ton prochain chapitre commence ici. Quel que soit ton terrain.",
    },
    athletes: {
      meta: {
        title: "AthleX pour les athlètes — Entraîne-toi. Compète. Progresse.",
        description:
          "Séances Functional, Hybrid et Musculation générées pour toi, minuteur, records, tournois, classement ELO et badges : l’app AthleX pour les athlètes, sur iOS et Android.",
      },
      breadcrumb: { home: "Accueil", current: "Athlètes", label: "Fil d’Ariane" },
      eyebrow: "Pour les athlètes",
      title: "Entraîne-toi. Compète. Progresse.",
      subtitle:
        "Ta séance du jour, ton minuteur, tes records et tes tournois dans une seule app. Seul ou avec ta box.",
      find: "Trouver une box",
      reassurance: ["iOS et Android", "Functional · Hybrid · Musculation"],
      stats: [
        { value: "3", label: "disciplines : Functional, Hybrid et Musculation" },
        { value: "187", label: "badges à débloquer" },
        {
          value: "4",
          label: "formats de tournoi : classique, bracket, double élimination, divisions",
        },
      ],
      features: [
        {
          label: "01 · Séances",
          title: "Ta séance du jour, générée pour toi.",
          copy: "Choisis ta discipline, ton temps et ton matériel : AthleX compose un WOD ou une séance de musculation.",
          points: [
            "Functional, Hybrid et Musculation",
            "WOD express quand tu es pressé",
            "« Après ma classe » pour compléter ta séance de box",
          ],
        },
        {
          label: "02 · Minuteur et records",
          title: "Chronomètre. Saisis. Progresse.",
          copy: "Le minuteur suit le format de ta séance. Ton score rejoint ton historique et tes records se mettent à jour.",
          points: [
            "For Time, AMRAP, EMOM, Tabata",
            "Séries de musculation et 1RM recalculé",
            "Records de gymnastique en répétitions",
          ],
        },
        {
          label: "03 · Tournois et ELO",
          title: "Affronte ta box. Grimpe au classement.",
          copy: "Inscris-toi aux tournois de ta box, enchaîne les WOD et fais monter ton ELO.",
          points: [
            "Classique, bracket, double élimination, divisions",
            "Classement ELO de ta box et global",
            "Résultats validés par ton coach",
          ],
        },
        {
          label: "04 · Badges et amis",
          title: "Chaque répétition compte.",
          copy: "Tes répétitions débloquent des badges de mouvement. Ajoute tes amis et compare vos progrès.",
          points: [
            "187 badges à débloquer",
            "Amis et profils",
            "« Partager ma performance » en image",
          ],
        },
        {
          label: "05 · Ta box",
          title: "Ta box dans ta poche.",
          copy: "Réserve ton créneau, consulte le whiteboard du jour, lis les annonces et suis ton abonnement.",
          points: [
            "Réservation des cours",
            "Whiteboard et classement de la séance",
            "Annonces et notifications de ta box",
          ],
        },
      ],
      exit: {
        title: "Prêt à t’entraîner ?",
        copy: "Crée ton compte, puis rejoins ta box avec son code.",
        coachs: "Tu gères une box ou tu coaches ? Découvre l’espace Box & coachs",
      },
    },
    footer: {
      description:
        "La plateforme tout-en-un pour les box Functional, Hybrid et Musculation.",
      product: "Produit",
      discover: "Découvrir",
      legalTitle: "Légal",
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
      athletes: "Athletes",
      coachs: "Gyms & coaches",
      pricing: "Pricing",
      faq: "FAQ",
      find: "Find a gym",
      ranking: "Leaderboard",
      login: "Log in",
      trial: "Free trial",
      menu: "Open menu",
      close: "Close menu",
      main: "Main navigation",
      language: "Language",
      skip: "Skip to content",
    },
    common: {
      create: "Create my gym",
      signup: "Create my athlete account",
      trial: "14-day free trial",
      download: "Download on the",
      available: "Get it on",
      appStore: "App Store",
      playStore: "Google Play",
    },
    hero: {
      eyebrow: "FUNCTIONAL · HYBRID · STRENGTH",
      title: "One platform built for everyone.",
      subtitle:
        "The app to train, the console to run it. Programming, tournaments, bookings and memberships in one place.",
      create: "Create my gym — 14-day trial",
      athlete: "I’m an athlete",
      reassurance: ["No credit card", "Cancel anytime", "Protected data"],
    },
    audience: {
      label: "Who is it for?",
      title: "A space for everyone.",
      copy: "Whether you train or run a gym, each side has its own space, connected to the other.",
      athlete: {
        title: "I train",
        tagline: "Train. Compete. Progress.",
        features: [
          "Generated WODs and sessions: Functional, Hybrid, Strength",
          "Timer, scores, records and 1RM tracking",
          "Gym tournaments and ELO leaderboard",
          "Badges and challenges with friends",
        ],
        more: "All about the Athletes space",
      },
      pro: {
        title: "I run a gym or coach",
        tagline: "Manage. Connect. Grow.",
        features: [
          "Automatic programming and whiteboard",
          "Schedule, time slots and bookings",
          "Gym memberships collected through Stripe or at the front desk",
          "Tournaments, announcements and notifications for your members",
        ],
        more: "All about the Gyms & coaches space",
      },
    },
    steps: {
      label: "For gyms",
      title: "Your gym online in 3 steps.",
      items: [
        {
          title: "Create your gym",
          copy: "Name, logo, opening hours and plans. The 14-day trial starts with no card.",
        },
        {
          title: "Invite your members",
          copy: "6-character code, link, QR code or CSV import.",
        },
        {
          title: "Program and engage",
          copy: "Generated WODs, whiteboard, tournaments and leaderboards, announcements.",
        },
      ],
    },
    pricing: {
      label: "Pricing",
      title: "The right plan. For your gym.",
      copy: "Transparent pricing. Switch plans or cancel whenever you want.",
      billing: "Billing period",
      monthly: "Monthly",
      annually: "Annual",
      discount: "up to −21%",
      perMonth: "/ month",
      annualNote: "Billed annually",
      popular: "Popular",
      coachDescription: "For independent coaches.",
      boxDescription: "For Functional and Hybrid gyms. Everything included.",
      coachFeatures: [
        "Up to 20 athletes",
        "Mobile app for your athletes",
        "Schedule and bookings",
        "Online program sales",
      ],
      boxFeatures: [
        "Unlimited members",
        "Multiple coaches and roles",
        "Automatic programming",
        "Automatic gym memberships",
      ],
      start: "Get started",
      reassurance: "Secure payments by Stripe · No credit card · Cancel anytime",
      compare: "Compare all features",
    },
    faq: {
      label: "FAQ",
      title: "Before you step inside.",
      more: "See all questions",
      entries: [
        {
          question: "Do I need a credit card to get started?",
          answer:
            "No. The Box plan’s 14-day free trial requires no card. You only pay if you decide to continue.",
        },
        {
          question: "Do my athletes have to pay for the app?",
          answer:
            "No. The app is free for your athletes, on the App Store and Google Play.",
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
      title: "Ready to reach the next level?",
      copy: "Your next chapter starts here. Whatever your training ground.",
    },
    athletes: {
      meta: {
        title: "AthleX for athletes — Train. Compete. Progress.",
        description:
          "Functional, Hybrid and Strength sessions generated for you, timer, records, tournaments, ELO leaderboard and badges: the AthleX app for athletes, on iOS and Android.",
      },
      breadcrumb: { home: "Home", current: "Athletes", label: "Breadcrumb" },
      eyebrow: "For athletes",
      title: "Train. Compete. Progress.",
      subtitle:
        "Your workout of the day, your timer, your records and your tournaments in one app. On your own or with your gym.",
      find: "Find a gym",
      reassurance: ["iOS and Android", "Functional · Hybrid · Strength"],
      stats: [
        { value: "3", label: "disciplines: Functional, Hybrid and Strength" },
        { value: "187", label: "badges to unlock" },
        {
          value: "4",
          label: "tournament formats: classic, bracket, double elimination, divisions",
        },
      ],
      features: [
        {
          label: "01 · Workouts",
          title: "Your workout of the day, built for you.",
          copy: "Pick your discipline, your time and your equipment: AthleX builds a WOD or a strength session.",
          points: [
            "Functional, Hybrid and Strength",
            "Express WOD when you’re short on time",
            "“After my class” to round off your gym session",
          ],
        },
        {
          label: "02 · Timer and records",
          title: "Time it. Log it. Progress.",
          copy: "The timer follows your session’s format. Your score joins your history and your records update.",
          points: [
            "For Time, AMRAP, EMOM, Tabata",
            "Strength sets and recalculated 1RM",
            "Gymnastics records in reps",
          ],
        },
        {
          label: "03 · Tournaments and ELO",
          title: "Take on your gym. Climb the leaderboard.",
          copy: "Sign up for your gym’s tournaments, chain the WODs and push your ELO up.",
          points: [
            "Classic, bracket, double elimination, divisions",
            "ELO leaderboard for your gym and worldwide",
            "Results validated by your coach",
          ],
        },
        {
          label: "04 · Badges and friends",
          title: "Every rep counts.",
          copy: "Your reps unlock movement badges. Add your friends and compare your progress.",
          points: [
            "187 badges to unlock",
            "Friends and profiles",
            "“Share my performance” as an image",
          ],
        },
        {
          label: "05 · Your gym",
          title: "Your gym in your pocket.",
          copy: "Book your class, check today’s whiteboard, read the announcements and follow your membership.",
          points: [
            "Class booking",
            "Whiteboard and session leaderboard",
            "Announcements and notifications from your gym",
          ],
        },
      ],
      exit: {
        title: "Ready to train?",
        copy: "Create your account, then join your gym with its code.",
        coachs: "Run a gym or coach? Discover the Gyms & coaches space",
      },
    },
    footer: {
      description:
        "The all-in-one platform for Functional, Hybrid and Strength gyms.",
      product: "Product",
      discover: "Discover",
      legalTitle: "Legal",
      privacy: "Privacy",
      terms: "Terms",
      legal: "Legal notice",
      copyright: "© 2026 AthleX — NBS Innovation. All rights reserved.",
    },
  },
};
export type LandingCopy = typeof translations.fr;
