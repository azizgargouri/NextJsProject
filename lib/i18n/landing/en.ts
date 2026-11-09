/**
 * Public landing copy (English). Plain strings only: the dictionary crosses the
 * server → client boundary. `{token}` placeholders are filled with `fill()`.
 * Hero, step and coverage-intro copy is managed in the admin Content module.
 */
export const landingEn = {
  meta: {
    skip: 'Skip to content',
  },
  nav: {
    home: 'MoveUp home',
    links: {
      services: 'Services',
      how: 'How it works',
      estimate: 'Estimate',
      faq: 'Questions',
    },
    login: 'Log in',
    request: 'Request a move',
    requestShort: 'Request',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menu: 'Menu',
    language: 'Language',
  },
  hero: {
    cities: 'TUNIS · SFAX · SOUSSE',
    estimateFrom: 'ESTIMATES FROM {min} TND',
    rule: 'RULE {name} · V{version}',
    noRule: 'PRICING RULE BEING UPDATED',
    figure: 'FIG.01 · TWO MOVERS, ONE UPRIGHT PIANO',
    photoAlt: 'Two movers in black shirts carefully lifting a wooden upright piano',
  },
  marquee: ['PACKING', 'LOADING', 'IN TRANSIT', 'DELIVERY', 'DISASSEMBLY', 'REASSEMBLY', 'TRACKED'],
  commitments: {
    kicker: '[ WHAT YOU CAN HOLD US TO ]',
    items: [
      {
        word: 'WRITTEN',
        body: 'Every quote is in writing before anyone lifts a box.',
      },
      {
        word: 'CHECKED',
        body: 'Movers show ID, licence and insurance before their first job.',
      },
      {
        word: 'LOGGED',
        body: 'Every status change, from draft to delivered, keeps its timestamp.',
      },
      {
        word: 'PUBLISHED',
        body: 'One pricing rule, open on this page. No hidden rate card.',
      },
    ],
  },
  services: {
    index: '01',
    title: 'WHAT WE MOVE',
    photoAlt: 'Packed cardboard moving boxes stacked in an empty room',
    items: [
      {
        tag: 'SV-01',
        title: 'HOUSE MOVES',
        body: 'Studio to six-room homes. Floors counted, elevators declared, nothing vague.',
      },
      {
        tag: 'SV-02',
        title: 'SINGLE-ITEM HAULS',
        body: 'One sofa, one fridge. City trips without the full-service invoice.',
      },
      {
        tag: 'SV-03',
        title: 'PACKING & MATERIALS',
        body: 'Boxes, film and padded blankets, ordered with the move and packed by the crew.',
      },
      {
        tag: 'SV-04',
        title: 'DISASSEMBLY',
        body: 'Beds, wardrobes, tables. Taken down, wrapped, rebuilt at destination.',
      },
      {
        tag: 'SV-05',
        title: 'OFFICE RELOCATIONS',
        body: 'Business moves run over a weekend, back at the desk before Monday.',
      },
    ],
  },
  how: {
    index: '02',
    title: 'HOW IT WORKS',
    step: 'STEP {n}',
    of: '{n} / 04',
    next: 'NEXT >>>',
    final: 'FINAL STAGE',
    progress: 'Progress through the four steps',
    statuses: ['DRAFT → SUBMITTED', 'QUOTING', 'ASSIGNED', 'EN ROUTE → COMPLETED'],
    photoAlts: [
      'An open, empty cardboard moving box',
      'A cardboard moving box sealed with tape',
      'A wooden furniture dolly with carpeted rails',
      'A small three-wheeled delivery truck on a street in Tunisia',
    ],
  },
  manifesto: {
    kicker: '[ OPERATING PRINCIPLE ]',
    text: 'We do not sell trucks. We run a registry. Every mover is verified, every quote is written, every status change is logged. When your boxes arrive, the record is what protects you: the addresses, the price, the signature. Moving is logistics. Logistics deserves a paper trail.',
  },
  estimate: {
    index: '03',
    title: 'PRICE IT YOURSELF',
    intro:
      'This is the rule every MoveUp quote starts from, read live from our pricing registry. Move the sliders and watch the ledger.',
    distance: 'Distance',
    distanceHint: 'Door to door, by road',
    volume: 'Volume',
    volumeHint: 'Everything that goes in the truck',
    express: 'Express service',
    expressHint: 'Priority scheduling, +{pct}% on the subtotal',
    km: 'km',
    m3: 'm³',
    receipt: 'ESTIMATE',
    ruleLine: '{name} · V{version}',
    effective: 'EFFECTIVE {date}',
    base: 'Base fare',
    distanceLine: 'Distance · {km} km × {rate}',
    volumeLine: 'Volume · {m3} m³ × {rate}',
    subtotal: 'Subtotal',
    expressLine: 'Express +{pct}%',
    minimum: 'Minimum quote applies',
    total: 'Estimated total',
    currency: 'TND',
    disclaimer:
      'An estimate, not a contract. The price you pay is the written quote you accept, after a mover has seen the details.',
    cta: 'REQUEST THIS MOVE >>>',
    noRuleTitle: 'Pricing is being updated',
    noRuleBody:
      'There is no live pricing rule at the moment, so we will not show a number we cannot stand behind. Requests still receive written quotes.',
    ai: {
      kicker: 'NOT SURE OF YOUR VOLUME?',
      title: 'List it for me',
      badge: 'LOCAL AI',
      intro:
        'Describe your home in your own words, or add up to three photos. A model running on our own server lists the items. Every volume comes from our reference table, never from the model.',
      descriptionLabel: 'Your home, in your words',
      placeholder:
        'Two-bedroom flat: a double bed, a cot, two wardrobes, a corner sofa, a fridge, a washing machine and about twenty boxes.',
      photos: 'Photos',
      addPhotos: 'ADD PHOTOS',
      addShort: 'ADD',
      photoHint: 'Up to 3 · PNG, JPEG or WebP',
      removePhoto: 'Remove photo {n}',
      submit: 'LIST MY INVENTORY >>>',
      working: 'READING YOUR HOME',
      workingHint: 'The model runs locally, so this can take up to a minute.',
      elapsed: '{s} S',
      cancel: 'CANCEL',
      resultTitle: 'INVENTORY',
      count: '{n} LINES',
      assumed: 'ASSUMED',
      estimated: 'EST.',
      legend:
        'ASSUMED: inferred from the size of your home. EST.: not in our reference table, volume guessed. Check both before you rely on the total.',
      increase: 'One more: {item}',
      decrease: 'One fewer: {item}',
      remove: 'Remove {item}',
      total: 'Total volume',
      apply: 'USE {m3} m³ IN THE ESTIMATE',
      applied: 'Volume set to {m3} m³ in the estimate.',
      restart: 'START OVER',
      empty: 'No items found. Add more detail or a clearer photo.',
      model: 'MODEL {name} · RUNS ON OUR SERVER',
      errors: {
        offline: 'The AI assistant is offline right now. Set the volume with the slider instead.',
        busy: 'Too many requests. Try again in {s} seconds.',
        invalid: 'Describe your home or add at least one photo.',
        tooLarge: 'Those photos are too large. Each one must be under 4 MB.',
        photoType: 'Photos must be PNG, JPEG or WebP images.',
        generic: 'The assistant could not read that. Try rephrasing it.',
      },
    },
  },
  coverage: {
    index: '04',
    title: 'COVERAGE',
    footnote: 'More cities open when vetted crews are in place, not before.',
    cities: [
      {
        code: 'TUN',
        name: 'TUNIS',
        note: 'LAUNCH CITY',
        alt: 'Avenue Habib Bourguiba in central Tunis',
      },
      {
        code: 'SFA',
        name: 'SFAX',
        note: 'LAUNCH CITY',
        alt: 'The stone ramparts of the Sfax medina',
      },
      {
        code: 'SOU',
        name: 'SOUSSE',
        note: 'LAUNCH CITY',
        alt: 'The Ribat fortress in the medina of Sousse',
      },
    ],
  },
  movers: {
    kicker: '[ FOR MOVERS ]',
    title: 'CREWS WANTED. PAPERWORK INCLUDED.',
    body: 'Run your own crew and let MoveUp bring the requests. Work matched to your city, earnings listed per job, documents reviewed before your first move.',
    cta: 'APPLY AS A MOVER >>>',
    cells: [
      {
        code: 'CR-01',
        title: 'STEADY JOBS',
        body: 'Requests matched to your city and your calendar.',
      },
      {
        code: 'CR-02',
        title: 'CLEAR COMMISSION',
        body: 'Earnings listed per job, commission shown in the open.',
      },
      {
        code: 'CR-03',
        title: 'VERIFIED IN 48H',
        body: 'ID, licence and insurance reviewed within two working days.',
      },
    ],
  },
  faq: {
    index: '05',
    title: 'QUESTIONS',
    items: [
      {
        q: 'How is the price calculated?',
        a: 'From one published rule: a base fare, plus a rate per kilometre, plus a rate per cubic metre, with an optional express surcharge and a minimum quote. The estimator above uses the live rule.',
      },
      {
        q: 'Is the estimate the final price?',
        a: 'No. It shows how the rule works for your inputs. The binding price is the written quote you accept after a mover has reviewed the details of your request.',
      },
      {
        q: 'Who are the movers?',
        a: 'Independent crews who apply to MoveUp. Before a first job, each one shows ID, a driving licence and insurance, and the review is recorded on their profile.',
      },
      {
        q: 'Can I change my request?',
        a: 'Yes. A request stays a draft until you submit it, and you can edit it freely until then. After submission, write to hello@moveup.tn and a person will answer.',
      },
      {
        q: 'Which cities do you serve?',
        a: 'Tunis, Sfax and Sousse at launch. New cities open only once vetted crews are in place there.',
      },
    ],
  },
  close: {
    kicker: '[ ACTION REQUIRED ]',
    title: 'READY WHEN YOU ARE.',
    body: 'Create an account, describe your move in under five minutes, and receive written quotes from vetted movers. Every step stays on the record.',
    cta: 'START MY REQUEST >>>',
    contact: 'Prefer a human? Write to',
  },
  footer: {
    tagline: 'One request, vetted movers, a move you can follow. Tunis, Sfax and Sousse.',
    service: 'SERVICE',
    help: 'HELP',
    contact: 'CONTACT',
    links: {
      request: 'Request a move',
      movers: 'Become a mover',
      coverage: 'Coverage',
      estimate: 'Price estimate',
      faq: 'Questions',
      login: 'Log in',
    },
    city: 'Tunis, Tunisia',
    rights: '© {year} MOVEUP · TUNIS / SFAX / SOUSSE',
    ruleStatus: 'PRICES IN TND · ACTIVE RULE V{version}',
    credits: 'PHOTO CREDITS',
    creditsNote: 'Openly licensed photographs from Wikimedia Commons.',
  },
};

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : { [K in keyof T]: Widen<T[K]> };

export type LandingMessages = Widen<typeof landingEn>;

/** Replaces `{token}` placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
