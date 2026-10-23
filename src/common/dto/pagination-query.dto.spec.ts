import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto.js';

// query values always come in as strings (?page=2 gives '2') so the tests pass strings too
async function parse(query: Record<string, string>) {
  const dto = plainToInstance(PaginationQueryDto, query);
  const errors = await validate(dto);
  return { dto, fields: errors.map((e) => e.property) };
}

describe('PaginationQueryDto', () => {
  it('defaults to page 1 with 20 per page', async () => {
    const { dto, fields } = await parse({});

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ page: 1, limit: 20 });
  });

  it('converts query strings to numbers', async () => {
    const { dto, fields } = await parse({ page: '3', limit: '50' });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ page: 3, limit: 50 });
  });

  it.each([
    ['page', { page: '0' }],
    ['page', { page: 'abc' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: '101' }],
  ])('rejects an invalid %s', async (field, query) => {
    expect((await parse(query)).fields).toContain(field);
  });
});
