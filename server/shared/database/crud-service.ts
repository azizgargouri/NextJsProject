import { AbstractRepository } from './repository';
import { createPageDto, type PageDto } from './pagination';

/**
 * Abstract CRUD service — generic orchestration shared by every feature
 * module (replaces instanct-api's AbstractCrudService). Domain services
 * extend it and add only domain-specific methods.
 */
export abstract class AbstractCrudService<T extends { id: string }> {
  protected abstract get repository(): AbstractRepository<T>;

  async findOneById(id: string): Promise<T | null> {
    return this.repository.findOneById(id);
  }

  async findAllPaginated(options: {
    where?: unknown;
    orderBy?: unknown;
    page?: number;
    take?: number;
  }): Promise<PageDto<T>> {
    const page = options.page ?? 1;
    const take = Math.min(options.take ?? 10, 50);

    const [data, itemCount] = await Promise.all([
      this.repository.findMany({
        where: options.where as Record<string, unknown> | undefined,
        orderBy: options.orderBy as Record<string, 'asc' | 'desc'> | undefined,
      }),
      this.repository.count(options.where as Record<string, unknown> | undefined),
    ]);

    // Repository honors its own defaults defensively; slice for pagination.
    return createPageDto(data.slice(0, take), page, take, itemCount);
  }

  async save(data: unknown): Promise<T> {
    return this.repository.create(data as Record<string, unknown>);
  }

  async saveMany(items: unknown[]): Promise<T[]> {
    return Promise.all(items.map((item) => this.repository.create(item as Record<string, unknown>)));
  }

  async update(id: string, data: unknown): Promise<T | null> {
    return this.repository.update(id, data as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.repository.exists(id);
  }
}
