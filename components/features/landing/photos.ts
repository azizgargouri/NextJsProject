/**
 * Photography used on the public landing page. Every file is openly licensed
 * on Wikimedia Commons; attribution is rendered in the footer credits.
 * Generated from the Commons API metadata — do not edit licenses by hand.
 */
export interface LandingPhoto {
  slug: string;
  src: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

export const LANDING_PHOTOS = {
  'hero-piano': {
    slug: 'hero-piano',
    src: '/images/landing/hero-piano.jpg',
    title: 'Moving a Piano',
    author: 'HireAHelper',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Moving_a_Piano.jpg',
  },
  'service-boxes': {
    slug: 'service-boxes',
    src: '/images/landing/service-boxes.jpg',
    title: 'Verhuizing maart 2016',
    author: 'Someone Not Awful',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Verhuizing_maart_2016.jpg',
  },
  'step-open-box': {
    slug: 'step-open-box',
    src: '/images/landing/step-open-box.jpg',
    title: 'Open Cardboard Moving Box (32067347137)',
    author: 'HireAHelper',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Open_Cardboard_Moving_Box_(32067347137).jpg',
  },
  'step-sealed-box': {
    slug: 'step-sealed-box',
    src: '/images/landing/step-sealed-box.jpg',
    title: 'Large Cardboard Moving Box Taped Closed (32067345357)',
    author: 'HireAHelper',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Large_Cardboard_Moving_Box_Taped_Closed_(32067345357).jpg',
  },
  'step-dolly': {
    slug: 'step-dolly',
    src: '/images/landing/step-dolly.jpg',
    title: 'A Grey Wooden Furniture Dolly (46138039674)',
    author: 'HireAHelper',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:A_Grey_Wooden_Furniture_Dolly_(46138039674).jpg',
  },
  'step-street-truck': {
    slug: 'step-street-truck',
    src: '/images/landing/step-street-truck.jpg',
    title: 'Tunisia-2693 - Cute Truck (7845073152)',
    author: 'Dennis G. Jarvis',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Tunisia-2693_-_Cute_Truck_(7845073152).jpg',
  },
  'city-tunis': {
    slug: 'city-tunis',
    src: '/images/landing/city-tunis.jpg',
    title: '01996 Avenue Habib Bourguiba of Tunis',
    author: 'Silar',
    license: 'CC0',
    licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
    source: 'https://commons.wikimedia.org/wiki/File:01996_Avenue_Habib_Bourguiba_of_Tunis.jpg',
  },
  'city-sfax': {
    slug: 'city-sfax',
    src: '/images/landing/city-sfax.jpg',
    title: 'City walls of Sfax',
    author: 'Hamed Gamaoun',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:City_walls_of_Sfax.jpg',
  },
  'city-sousse': {
    slug: 'city-sousse',
    src: '/images/landing/city-sousse.jpg',
    title: 'Medina of Sousse, Sousse Governorate, Tunisia, January 2024 - Ribat Fortress',
    author: 'Sharon Hahn Darlin',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Medina_of_Sousse,_Sousse_Governorate,_Tunisia,_January_2024_-_Ribat_Fortress.jpg',
  },
} satisfies Record<string, LandingPhoto>;

export type LandingPhotoSlug = keyof typeof LANDING_PHOTOS;
