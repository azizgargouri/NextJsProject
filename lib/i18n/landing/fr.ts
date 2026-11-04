import type { LandingMessages } from './en';

/** Textes de la page publique (français). Même forme que `en.ts`. */
export const landingFr: LandingMessages = {
  meta: {
    skip: 'Aller au contenu',
  },
  nav: {
    home: 'Accueil MoveUp',
    links: {
      services: 'Services',
      how: 'Fonctionnement',
      estimate: 'Estimation',
      faq: 'Questions',
    },
    login: 'Connexion',
    request: 'Demander un devis',
    requestShort: 'Devis',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    menu: 'Menu',
    language: 'Langue',
  },
  hero: {
    cities: 'TUNIS · SFAX · SOUSSE',
    estimateFrom: 'ESTIMATIONS DÈS {min} TND',
    rule: 'RÈGLE {name} · V{version}',
    noRule: 'RÈGLE TARIFAIRE EN COURS DE MISE À JOUR',
    figure: 'FIG.01 · DEUX DÉMÉNAGEURS, UN PIANO DROIT',
    photoAlt: 'Deux déménageurs en t-shirt noir soulevant avec soin un piano droit en bois',
  },
  marquee: ['EMBALLAGE', 'CHARGEMENT', 'EN ROUTE', 'LIVRAISON', 'DÉMONTAGE', 'REMONTAGE', 'SUIVI'],
  commitments: {
    kicker: '[ CE QUE NOUS GARANTISSONS ]',
    items: [
      {
        word: 'ÉCRIT',
        body: 'Chaque devis est écrit avant que le premier carton ne bouge.',
      },
      {
        word: 'VÉRIFIÉ',
        body: "Les déménageurs présentent pièce d'identité, permis et assurance avant leur première mission.",
      },
      {
        word: 'TRACÉ',
        body: 'Chaque changement de statut, du brouillon à la livraison, garde son horodatage.',
      },
      {
        word: 'PUBLIC',
        body: 'Une seule règle tarifaire, consultable sur cette page. Aucune grille cachée.',
      },
    ],
  },
  services: {
    index: '01',
    title: 'CE QUE NOUS DÉMÉNAGEONS',
    photoAlt: 'Cartons de déménagement fermés, empilés dans une pièce vide',
    items: [
      {
        tag: 'SV-01',
        title: 'DÉMÉNAGEMENT DE LOGEMENT',
        body: "Du studio au six-pièces. Étages comptés, ascenseur déclaré, rien d'approximatif.",
      },
      {
        tag: 'SV-02',
        title: 'TRANSPORT D’UN OBJET',
        body: 'Un canapé, un réfrigérateur. Un trajet en ville sans la facture du service complet.',
      },
      {
        tag: 'SV-03',
        title: 'EMBALLAGE & FOURNITURES',
        body: "Cartons, film et couvertures matelassées, commandés avec le déménagement et posés par l'équipe.",
      },
      {
        tag: 'SV-04',
        title: 'DÉMONTAGE',
        body: "Lits, armoires, tables. Démontés, protégés, remontés à l'arrivée.",
      },
      {
        tag: 'SV-05',
        title: 'TRANSFERT DE BUREAUX',
        body: 'Les déménagements professionnels se font le week-end, pour être opérationnel le lundi.',
      },
    ],
  },
  how: {
    index: '02',
    title: 'COMMENT ÇA MARCHE',
    step: 'ÉTAPE {n}',
    of: '{n} / 04',
    next: 'SUITE >>>',
    final: 'DERNIÈRE ÉTAPE',
    progress: 'Progression dans les quatre étapes',
    statuses: ['BROUILLON → ENVOYÉE', 'DEVIS EN COURS', 'ATTRIBUÉE', 'EN ROUTE → TERMINÉE'],
    photoAlts: [
      'Un carton de déménagement ouvert et vide',
      'Un carton de déménagement fermé au ruban adhésif',
      'Un chariot à meubles en bois aux bords moquettés',
      'Un petit triporteur de livraison dans une rue de Tunisie',
    ],
  },
  manifesto: {
    kicker: '[ PRINCIPE DE FONCTIONNEMENT ]',
    text: "Nous ne vendons pas de camions. Nous tenons un registre. Chaque déménageur est vérifié, chaque devis est écrit, chaque changement de statut est consigné. Quand vos cartons arrivent, c'est le registre qui vous protège : les adresses, le prix, la signature. Déménager, c'est de la logistique. La logistique mérite une trace écrite.",
  },
  estimate: {
    index: '03',
    title: 'ESTIMEZ VOUS-MÊME',
    intro:
      'Voici la règle dont part chaque devis MoveUp, lue en direct dans notre registre tarifaire. Déplacez les curseurs et regardez le relevé.',
    distance: 'Distance',
    distanceHint: 'De porte à porte, par la route',
    volume: 'Volume',
    volumeHint: 'Tout ce qui monte dans le camion',
    express: 'Service express',
    expressHint: 'Planification prioritaire, +{pct} % sur le sous-total',
    km: 'km',
    m3: 'm³',
    receipt: 'ESTIMATION',
    ruleLine: '{name} · V{version}',
    effective: 'EN VIGUEUR DEPUIS LE {date}',
    base: 'Prise en charge',
    distanceLine: 'Distance · {km} km × {rate}',
    volumeLine: 'Volume · {m3} m³ × {rate}',
    subtotal: 'Sous-total',
    expressLine: 'Express +{pct} %',
    minimum: 'Le devis minimum s’applique',
    total: 'Total estimé',
    currency: 'TND',
    disclaimer:
      'Une estimation, pas un contrat. Le prix payé est celui du devis écrit que vous acceptez, une fois que le déménageur a vu les détails.',
    cta: 'DEMANDER CE DÉMÉNAGEMENT >>>',
    noRuleTitle: 'Les tarifs sont en cours de mise à jour',
    noRuleBody:
      "Aucune règle tarifaire n'est active pour le moment : nous n'affichons pas un montant que nous ne pouvons pas garantir. Les demandes reçoivent toujours des devis écrits.",
  },
  coverage: {
    index: '04',
    title: 'COUVERTURE',
    footnote: 'De nouvelles villes ouvrent quand des équipes vérifiées y sont prêtes, pas avant.',
    cities: [
      {
        code: 'TUN',
        name: 'TUNIS',
        note: 'VILLE DE LANCEMENT',
        alt: "L'avenue Habib-Bourguiba, au centre de Tunis",
      },
      {
        code: 'SFA',
        name: 'SFAX',
        note: 'VILLE DE LANCEMENT',
        alt: 'Les remparts en pierre de la médina de Sfax',
      },
      {
        code: 'SOU',
        name: 'SOUSSE',
        note: 'VILLE DE LANCEMENT',
        alt: 'Le ribat, forteresse de la médina de Sousse',
      },
    ],
  },
  movers: {
    kicker: '[ POUR LES DÉMÉNAGEURS ]',
    title: 'ÉQUIPES RECHERCHÉES. PAPERASSE INCLUSE.',
    body: 'Gérez votre propre équipe et laissez MoveUp vous apporter les demandes. Des missions dans votre ville, une rémunération affichée par mission, des documents vérifiés avant votre premier déménagement.',
    cta: 'POSTULER COMME DÉMÉNAGEUR >>>',
    cells: [
      {
        code: 'CR-01',
        title: 'MISSIONS RÉGULIÈRES',
        body: 'Des demandes adaptées à votre ville et à votre agenda.',
      },
      {
        code: 'CR-02',
        title: 'COMMISSION CLAIRE',
        body: 'Rémunération affichée par mission, commission visible.',
      },
      {
        code: 'CR-03',
        title: 'VÉRIFIÉ EN 48 H',
        body: "Pièce d'identité, permis et assurance vérifiés en deux jours ouvrés.",
      },
    ],
  },
  faq: {
    index: '05',
    title: 'QUESTIONS',
    items: [
      {
        q: 'Comment le prix est-il calculé ?',
        a: "À partir d'une seule règle publiée : une prise en charge, un tarif au kilomètre et un tarif au mètre cube, avec un supplément express facultatif et un devis minimum. L'estimateur ci-dessus utilise la règle en vigueur.",
      },
      {
        q: "L'estimation est-elle le prix final ?",
        a: "Non. Elle montre l'application de la règle à vos données. Le prix qui vous engage est le devis écrit que vous acceptez, après examen de votre demande par un déménageur.",
      },
      {
        q: 'Qui sont les déménageurs ?',
        a: "Des équipes indépendantes qui postulent auprès de MoveUp. Avant leur première mission, elles présentent pièce d'identité, permis de conduire et assurance, et la vérification est inscrite sur leur profil.",
      },
      {
        q: 'Puis-je modifier ma demande ?',
        a: "Oui. Une demande reste un brouillon jusqu'à son envoi et vous pouvez la modifier librement jusque-là. Après l'envoi, écrivez à hello@moveup.tn : une personne vous répondra.",
      },
      {
        q: 'Quelles villes desservez-vous ?',
        a: "Tunis, Sfax et Sousse au lancement. Une nouvelle ville n'ouvre que lorsque des équipes vérifiées y sont en place.",
      },
    ],
  },
  close: {
    kicker: '[ À VOUS DE JOUER ]',
    title: 'PRÊTS QUAND VOUS L’ÊTES.',
    body: 'Créez un compte, décrivez votre déménagement en moins de cinq minutes et recevez des devis écrits de déménageurs vérifiés. Chaque étape reste consignée.',
    cta: 'COMMENCER MA DEMANDE >>>',
    contact: 'Vous préférez parler à quelqu’un ? Écrivez à',
  },
  footer: {
    tagline:
      'Une demande, des déménageurs vérifiés, un déménagement que vous suivez. Tunis, Sfax et Sousse.',
    service: 'SERVICE',
    help: 'AIDE',
    contact: 'CONTACT',
    links: {
      request: 'Demander un devis',
      movers: 'Devenir déménageur',
      coverage: 'Couverture',
      estimate: 'Estimation du prix',
      faq: 'Questions',
      login: 'Connexion',
    },
    city: 'Tunis, Tunisie',
    rights: '© {year} MOVEUP · TUNIS / SFAX / SOUSSE',
    ruleStatus: 'PRIX EN TND · RÈGLE ACTIVE V{version}',
    credits: 'CRÉDITS PHOTO',
    creditsNote: 'Photographies sous licence libre, issues de Wikimedia Commons.',
  },
};
