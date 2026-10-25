/**
 * Abstract repository — the single generic data-access layer that every
 * domain repository extends (replaces TypeORM repository + @Transactional).
 * Concrete modules implement the primitives against their Mongoose model;
 * generic helpers (createMany, exists) build on those primitives.
 */
export abstract class AbstractRepository<T extends { id: string }> {
  abstract findOneById(id: string): Promise<T | null>;
  abstract findMany(options?: Record<string, unknown>): Promise<T[]>;
  abstract create(data: Record<string, unknown>): Promise<T>;
  abstract update(id: string, data: Record<string, unknown>): Promise<T>;
  abstract delete(id: string): Promise<T>;
  abstract count(where?: Record<string, unknown>): Promise<number>;

  async createMany(items: Record<string, unknown>[]): Promise<T[]> {
    return Promise.all(items.map((item) => this.create(item)));
  }

  async exists(id: string): Promise<boolean> {
    return (await this.findOneById(id)) !== null;
  }
}
