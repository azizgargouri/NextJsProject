import { NotFoundError, ValidationError } from '../../shared/database/errors';
import {
  CONTENT_DEFAULTS,
  CONTENT_KEYS,
  CONTENT_SECTIONS,
  type LandingCopy,
  buildLandingCopy,
  type ContentSection,
} from './content.constants';
import { ContentRepository } from './content.repository';

export interface ContentEntryView {
  key: string;
  label: string;
  value: string;
  default: string;
  overridden: boolean;
  multiline: boolean;
}

export interface ContentSectionView {
  section: ContentSection;
  title: string;
  description: string;
  entries: ContentEntryView[];
}

const SECTION_COPY: Record<ContentSection, { title: string; description: string }> = {
  hero: {
    title: 'Hero',
    description: 'Headline, intro copy and call-to-action labels of the first viewport.',
  },
  steps: {
    title: 'How it works',
    description: 'The four numbered stages described on the public landing page.',
  },
  coverage: {
    title: 'Coverage',
    description: 'Intro paragraph of the coverage ledger section.',
  },
};

/** Content business logic — merged defaults, validation and audit-friendly saves. */
export class ContentService {
  private get repository(): ContentRepository {
    return new ContentRepository();
  }

  /** Public landing read — must never throw; falls back to in-code defaults. */
  async getLandingCopy(locale: string = 'en'): Promise<LandingCopy> {
    try {
      const values = await this.repository.mergedValues(locale);
      return buildLandingCopy(values);
    } catch {
      // Landing copy is not critical data: keep the designed defaults on DB failure.
      return buildLandingCopy({});
    }
  }

  async adminBundle(locale: string): Promise<ContentSectionView[]> {
    const [values, overridden] = await Promise.all([
      this.repository.mergedValues(locale),
      this.repository.overriddenKeys(locale),
    ]);

    return CONTENT_SECTIONS.map((section) => ({
      section,
      ...SECTION_COPY[section],
      entries: Object.entries(CONTENT_KEYS)
        .filter(([, meta]) => meta.section === section)
        .map(([key, meta]) => ({
          key,
          label: meta.label,
          value: values[key] ?? '',
          default: CONTENT_DEFAULTS[key] ?? '',
          overridden: overridden.has(key),
          multiline: Boolean(meta.multiline),
        })),
    }));
  }

  /** Persists a batch of entries for one locale; validates every key. */
  async saveEntries(
    actorId: string,
    locale: string,
    entries: { key: string; value: string }[],
  ): Promise<number> {
    if (entries.length === 0) return 0;
    for (const entry of entries) {
      if (!CONTENT_KEYS[entry.key]) {
        throw new NotFoundError('Content key');
      }
      if (typeof entry.value !== 'string') {
        throw new ValidationError('Content values must be strings');
      }
    }
    return this.repository.upsertMany(locale, entries, actorId);
  }

  /** Removes DB overrides so the section falls back to in-code defaults. */
  async resetEntriesActor(actorId: string, locale: string, keys: string[]): Promise<number> {
    void actorId;
    for (const key of keys) {
      if (!CONTENT_KEYS[key]) throw new NotFoundError('Content key');
    }
    return this.repository.deleteMany(locale, keys);
  }
}
