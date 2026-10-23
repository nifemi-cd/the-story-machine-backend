import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { belugaScript } from '../../../test/fixtures/story-json.js';
import { toFieldErrors } from '../../common/pipes/validation.pipe.js';
import { CreateChapterDto } from './create-chapter.dto.js';
import { UpdateChapterDto } from './update-chapter.dto.js';

// does the same thing the ValidationPipe does and returns which fields failed
async function errorsFor<T extends object>(cls: new () => T, input: object) {
  const dto = plainToInstance(cls, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: toFieldErrors(errors).map((e) => e.field) };
}

describe('CreateChapterDto', () => {
  it('accepts a chapter_name alone, trimmed', async () => {
    const { dto, fields } = await errorsFor(CreateChapterDto, {
      chapter_name: '  Chapter 1 ',
    });

    expect(fields).toEqual([]);
    expect(dto.chapter_name).toBe('Chapter 1');
  });

  it('accepts the sprint-1 example as story', async () => {
    const { fields } = await errorsFor(CreateChapterDto, {
      chapter_name: 'Chapter 1',
      story: belugaScript,
    });

    expect(fields).toEqual([]);
  });

  it('reports problems inside story with story. paths', async () => {
    const story = structuredClone(belugaScript) as {
      lines: Record<string, unknown>[];
    };
    story.lines[4] = { line_id: 4, choice: [] };

    const { fields } = await errorsFor(CreateChapterDto, {
      chapter_name: 'Chapter 1',
      story,
    });

    expect(fields).toEqual(['story.lines.4.choice']);
  });

  it.each([
    ['chapter_name', {}],
    ['chapter_name', { chapter_name: '   ' }],
    ['chapter_name', { chapter_name: 'x'.repeat(121) }],
  ])('rejects an invalid %s', async (field, input) => {
    expect((await errorsFor(CreateChapterDto, input)).fields).toContain(field);
  });

  // these come from the server so the client shouldn't be able to send them
  it.each(['title', 'author', 'story_id', 'chapter_id'])(
    'does not let clients set %s',
    async (field) => {
      expect(
        (
          await errorsFor(CreateChapterDto, {
            chapter_name: 'Chapter 1',
            [field]: 'x',
          })
        ).fields,
      ).toContain(field);
    },
  );
});

describe('UpdateChapterDto', () => {
  it('accepts a new chapter_name but not a story', async () => {
    const { fields } = await errorsFor(UpdateChapterDto, {
      chapter_name: 'Renamed',
      story: belugaScript,
    });

    expect(fields).toEqual(['story']);
  });
});
