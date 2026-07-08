export type Lang = 'fr' | 'en';

export const translations = {
  fr: {
    nav: {
      features: 'Fonctionnalités',
      app: "L'app",
      pricing: 'Tarifs',
      login: 'Connexion',
      cta: 'Essai gratuit',
    },
    hero: {
      badge: 'CROSSFIT · HYROX · FUNCTIONAL TRAINING',
      title1: 'Gère.',
      title2: 'Anime.',
      title3: 'Développe.',
      subtitle:
        'La plateforme tout-en-un pour piloter ta box : membres, réservations, WODs, tournois et communauté. Web pour toi, app mobile pour tes athlètes.',
      ctaPrimary: 'Commencer gratuitement',
      ctaSecondary: 'Voir la démo',
      note: 'Sans carte bancaire · Annulable à tout moment',
    },
    stats: [
      { value: '3', label: 'Profils dédiés' },
      { value: 'iOS & Android', label: 'App mobile incluse' },
      { value: 'Temps réel', label: 'Synchronisation' },
      { value: '5 min', label: 'Mise en route' },
    ],
    features: {
      tag: 'Fonctionnalités',
      title: 'Tout ce dont ta box a besoin. Rien de superflu.',
      subtitle: 'Un back office complet, pensé pour les gérants et les coachs.',
      items: [
        { title: 'Gestion des membres', desc: 'Adhérents, rôles, statuts et historique en un coup d’œil.' },
        { title: 'Actualités & annonces', desc: 'Diffuse tes infos à toute la communauté instantanément.' },
        { title: 'Horaires & réservations', desc: 'Créneaux, capacités et réservations gérés automatiquement.' },
        { title: 'Whiteboard & WODs', desc: 'Programme tes séances et publie les WODs du jour.' },
        { title: 'Tournois & classements', desc: 'Compétitions internes, ELO et leaderboards en direct.' },
        { title: 'Messagerie intégrée', desc: 'Échange avec tes membres sans quitter la plateforme.' },
      ],
    },
    experiences: {
      title: 'Une plateforme, trois expériences',
      subtitle: 'Chaque rôle a son interface, parfaitement adaptée.',
      items: [
        {
          role: 'Athlète',
          desc: 'L’app mobile pour s’entraîner, réserver et progresser.',
          benefits: ['Réservation des créneaux', 'WODs & scores personnels', 'Classements & tournois', 'Communauté de la box'],
        },
        {
          role: 'Coach',
          desc: 'Les outils pour animer les séances et suivre les athlètes.',
          benefits: ['Programmation des WODs', 'Validation des scores', 'Suivi des membres', 'Gestion du planning'],
        },
        {
          role: 'Gérant',
          desc: 'Le back office pour piloter toute l’activité de la box.',
          benefits: ['Vue d’ensemble & stats', 'Gestion des abonnements', 'Membres & coachs', 'Communication globale'],
        },
      ],
    },
    steps: {
      title: 'Opérationnel en 5 minutes',
      subtitle: 'Aucune installation, aucune complexité.',
      items: [
        { n: '01', title: 'Crée ta box', desc: 'Inscris-toi et configure ta box en quelques champs.' },
        { n: '02', title: 'Invite tes membres', desc: 'Partage ton code d’invitation, ils rejoignent l’app.' },
        { n: '03', title: 'Gère tout au même endroit', desc: 'Planning, WODs, tournois et communauté, réunis.' },
      ],
    },
    app: {
      title: 'Tes athlètes ont leur app. iOS & Android',
      subtitle: 'Une expérience mobile pensée pour la performance.',
      benefits: ['Réservation en un tap', 'Scores & records personnels', 'Notifications de la box', 'Classements en temps réel'],
      mockupTitle: 'WOD du jour',
      book: 'Réserver',
    },
    pricing: {
      tag: 'Tarifs',
      title: 'Un tarif simple, sans surprise',
      subtitle: 'Commence gratuitement, passe à la vitesse supérieure quand tu veux.',
      popular: 'Populaire',
      perMonth: '/mois',
      plans: [
        {
          name: 'Starter',
          price: '0€',
          desc: 'Pour découvrir la plateforme.',
          features: ['Jusqu’à 30 membres', 'Réservations & planning', 'WODs & whiteboard', 'App mobile athlète'],
          cta: 'Commencer',
        },
        {
          name: 'Box',
          price: '79€',
          desc: 'Pour les box en croissance.',
          features: ['Membres illimités', 'Tournois & classements', 'Messagerie intégrée', 'Statistiques avancées', 'Support prioritaire'],
          cta: 'Essai gratuit 14 jours',
        },
        {
          name: 'Complet',
          price: 'Sur mesure',
          desc: 'Pour les réseaux de box.',
          features: ['Tout le plan Box', 'Multi-box', 'Marque personnalisée', 'Accompagnement dédié'],
          cta: 'Nous contacter',
        },
      ],
    },
    finalCta: {
      title: 'Prêt à passer au niveau supérieur ?',
      subtitle: 'Rejoins les box qui pilotent tout depuis AthleX.',
      cta: 'Créer ma box',
    },
    footer: {
      tagline: 'La plateforme tout-en-un pour les box de functional training.',
      product: 'Produit',
      resources: 'Ressources',
      legal: 'Légal',
      links: {
        product: ['Fonctionnalités', 'App mobile', 'Tarifs'],
        resources: ['Guide de démarrage', 'Support', 'Contact'],
        legal: ['Confidentialité', 'CGU', 'Mentions légales'],
      },
      rights: 'Tous droits réservés.',
    },
  },
  en: {
    nav: {
      features: 'Features',
      app: 'The app',
      pricing: 'Pricing',
      login: 'Log in',
      cta: 'Free trial',
    },
    hero: {
      badge: 'CROSSFIT · HYROX · FUNCTIONAL TRAINING',
      title1: 'Manage.',
      title2: 'Engage.',
      title3: 'Grow.',
      subtitle:
        'The all-in-one platform to run your box: members, bookings, WODs, tournaments and community. Web for you, mobile app for your athletes.',
      ctaPrimary: 'Get started free',
      ctaSecondary: 'Watch the demo',
      note: 'No credit card · Cancel anytime',
    },
    stats: [
      { value: '3', label: 'Dedicated profiles' },
      { value: 'iOS & Android', label: 'Mobile app included' },
      { value: 'Real time', label: 'Synchronization' },
      { value: '5 min', label: 'Setup time' },
    ],
    features: {
      tag: 'Features',
      title: 'Everything your box needs. Nothing you don’t.',
      subtitle: 'A complete back office, built for owners and coaches.',
      items: [
        { title: 'Member management', desc: 'Members, roles, statuses and history at a glance.' },
        { title: 'News & announcements', desc: 'Broadcast updates to your whole community instantly.' },
        { title: 'Schedules & bookings', desc: 'Slots, capacities and bookings handled automatically.' },
        { title: 'Whiteboard & WODs', desc: 'Program your sessions and publish the daily WODs.' },
        { title: 'Tournaments & rankings', desc: 'Internal competitions, ELO and live leaderboards.' },
        { title: 'Built-in messaging', desc: 'Chat with your members without leaving the platform.' },
      ],
    },
    experiences: {
      title: 'One platform, three experiences',
      subtitle: 'Every role gets its own perfectly tailored interface.',
      items: [
        {
          role: 'Athlete',
          desc: 'The mobile app to train, book and progress.',
          benefits: ['Class booking', 'WODs & personal scores', 'Rankings & tournaments', 'Box community'],
        },
        {
          role: 'Coach',
          desc: 'The tools to run sessions and track athletes.',
          benefits: ['WOD programming', 'Score validation', 'Member tracking', 'Schedule management'],
        },
        {
          role: 'Owner',
          desc: 'The back office to run your entire box.',
          benefits: ['Overview & stats', 'Subscription management', 'Members & coaches', 'Global communication'],
        },
      ],
    },
    steps: {
      title: 'Up and running in 5 minutes',
      subtitle: 'No installation, no complexity.',
      items: [
        { n: '01', title: 'Create your box', desc: 'Sign up and set up your box in a few fields.' },
        { n: '02', title: 'Invite your members', desc: 'Share your invite code, they join the app.' },
        { n: '03', title: 'Manage it all in one place', desc: 'Schedule, WODs, tournaments and community, together.' },
      ],
    },
    app: {
      title: 'Your athletes get their app. iOS & Android',
      subtitle: 'A mobile experience built for performance.',
      benefits: ['One-tap booking', 'Scores & personal records', 'Box notifications', 'Real-time rankings'],
      mockupTitle: "Today's WOD",
      book: 'Book',
    },
    pricing: {
      tag: 'Pricing',
      title: 'Simple pricing, no surprises',
      subtitle: 'Start free, level up whenever you want.',
      popular: 'Popular',
      perMonth: '/mo',
      plans: [
        {
          name: 'Starter',
          price: '$0',
          desc: 'To discover the platform.',
          features: ['Up to 30 members', 'Bookings & schedule', 'WODs & whiteboard', 'Athlete mobile app'],
          cta: 'Get started',
        },
        {
          name: 'Box',
          price: '$79',
          desc: 'For growing boxes.',
          features: ['Unlimited members', 'Tournaments & rankings', 'Built-in messaging', 'Advanced stats', 'Priority support'],
          cta: '14-day free trial',
        },
        {
          name: 'Complete',
          price: 'Custom',
          desc: 'For box networks.',
          features: ['Everything in Box', 'Multi-box', 'Custom branding', 'Dedicated support'],
          cta: 'Contact us',
        },
      ],
    },
    finalCta: {
      title: 'Ready to level up?',
      subtitle: 'Join the boxes running everything on AthleX.',
      cta: 'Create my box',
    },
    footer: {
      tagline: 'The all-in-one platform for functional training boxes.',
      product: 'Product',
      resources: 'Resources',
      legal: 'Legal',
      links: {
        product: ['Features', 'Mobile app', 'Pricing'],
        resources: ['Getting started', 'Support', 'Contact'],
        legal: ['Privacy', 'Terms', 'Legal notice'],
      },
      rights: 'All rights reserved.',
    },
  },
} as const;

export type Translation = (typeof translations)[Lang];
