import { connectMongo } from '../../shared/database/mongoose';
import {
  ContentEntryModel,
  type ContentEntryDoc,
} from '../../shared/database/models/content-entry.model';
import { contentDefaults } from './content.constants';

/** Content data access — the only place that knows about the `contententries` collection. */
export class ContentRepository {
  private async model() {
    await connectMongo();
    return ContentEntryModel;
  }

  /** Merged view: DB override wins, defaults fill the rest. */
  async mergedValues(locale: string): Promise<Record<string, string>> {
    const docs = await (await this.model()).find({ locale }).lean<ContentEntryDoc[]>();

    const values: Record<string, string> = { ...contentDefaults(locale) };
    for (const doc of docs) values[doc.key] = doc.value;
    return values;
  }

  /** Overridden keys for a locale (keys stored in DB). */
  async overriddenKeys(locale: string): Promise<Set<string>> {
    const docs = await (
      await this.model()
    )
      .find({ locale })
      .select('key value')
      .lean<ContentEntryDoc[]>();
    return new Set(docs.map((doc) => doc.key));
  }

  async upsertMany(
    locale: string,
    entries: { key: string; value: string }[],
    updatedBy?: string,
  ): Promise<number> {
    const M = await this.model();
    let saved = 0;
    for (const entry of entries) {
      await M.findOneAndUpdate(
        { key: entry.key, locale },
        { $set: { value: entry.value, updatedBy }, $setOnInsert: { key: entry.key, locale } },
        { upsert: true, returnDocument: 'after' },
      );
      saved += 1;
    }
    return saved;
  }

  /** Restores an entry to its in-code default by removing the DB override. */
  async deleteMany(locale: string, keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const result = await (await this.model()).deleteMany({ locale, key: { $in: keys } });
    return result.deletedCount ?? 0;
  }
}
