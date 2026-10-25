/** Pagination contract replicating `instanct-api`'s PageDto / PageMetaDto. */
export interface PageMetaDto {
  page: number;
  take: number;
  itemCount: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PageDto<T> {
  data: T[];
  meta: PageMetaDto;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_TAKE = 10;
export const MAX_TAKE = 50;

export function createPageMeta(page: number, take: number, itemCount: number): PageMetaDto {
  const pageCount = take > 0 ? Math.ceil(itemCount / take) : 0;
  return {
    page,
    take,
    itemCount,
    pageCount,
    hasPreviousPage: page > 1,
    hasNextPage: page < pageCount,
  };
}

export function createPageDto<T>(
  data: T[],
  page: number,
  take: number,
  itemCount: number,
): PageDto<T> {
  return {
    data,
    meta: createPageMeta(page, take, itemCount),
  };
}
