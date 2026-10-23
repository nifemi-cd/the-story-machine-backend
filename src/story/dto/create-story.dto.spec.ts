import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStoryDto } from './create-story.dto.js';
import { UpdateStoryDto } from './update-story.dto.js';
import { ListStoriesQueryDto } from './list-stories-query.dto.js';

const valid = {
  authorId: '6ad4306d3168a59d2918aead',
  title: 'The Lighthouse Keeper',
};

// does the same thing the ValidationPipe does and returns which fields failed
async function errorsFor<T extends object>(cls: new () => T, input: object) {
  const dto = plainToInstance(cls, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('CreateStoryDto', () => {
  it('accepts a valid story', async () => {
    expect((await errorsFor(CreateStoryDto, valid)).fields).toEqual([]);
  });

  it('trims the title and description', async () => {
    const { dto, fields } = await errorsFor(CreateStoryDto, {
      ...valid,
      title: '  The Keeper ',
      description: ' A storm. ',
    });

    expect(fields).toEqual([]);
    expect(dto.title).toBe('The Keeper');
    expect(dto.description).toBe('A storm.');
  });

  it('accepts characters in the contract shape', async () => {
    const { dto, fields } = await errorsFor(CreateStoryDto, {
      ...valid,
      characters: [
        {
          name: ' Dave ',
          description: null,
          emotions: [
            { emotion: 'default', portrait_x: null, portrait_y: null },
            { emotion: 'angry' },
          ],
        },
        { name: 'Cindy' },
      ],
    });

    expect(fields).toEqual([]);
    expect(dto.characters?.[0].name).toBe('Dave');
  });

  it.each([
    ['authorId', { authorId: 'not-an-id' }],
    ['title', { title: '   ' }],
    ['title', { title: 'x'.repeat(121) }],
    ['characters', { characters: [{ name: 'Dave' }, { name: 'Dave' }] }],
    [
      'characters',
      {
        characters: [
          { name: 'Dave', emotions: [{ emotion: 'sad' }, { emotion: 'sad' }] },
        ],
      },
    ],
    [
      'characters',
      {
        characters: [
          { name: 'Dave', emotions: [{ emotion: 'sad', portrait_x: 3 }] },
        ],
      },
    ],
  ])('rejects an invalid %s', async (field, override) => {
    expect(
      (await errorsFor(CreateStoryDto, { ...valid, ...override })).fields,
    ).toContain(field);
  });

  it.each(['status', 'chapterOrder', 'likeCount', 'draftUrl'])(
    'does not let clients set %s',
    async (field) => {
      expect(
        (await errorsFor(CreateStoryDto, { ...valid, [field]: 'x' })).fields,
      ).toContain(field);
    },
  );
});

describe('UpdateStoryDto', () => {
  it('accepts a status but not a new author', async () => {
    const { fields } = await errorsFor(UpdateStoryDto, {
      status: 'published',
      authorId: valid.authorId,
    });

    expect(fields).toEqual(['authorId']);
  });

  it('rejects an unknown status', async () => {
    expect(
      (await errorsFor(UpdateStoryDto, { status: 'archived' })).fields,
    ).toEqual(['status']);
  });
});

describe('ListStoriesQueryDto', () => {
  it('keeps the pagination defaults and accepts filters', async () => {
    const { dto, fields } = await errorsFor(ListStoriesQueryDto, {
      status: 'published',
      authorId: valid.authorId,
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ page: 1, limit: 20 });
  });
});
