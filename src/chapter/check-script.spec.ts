import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { model, Types } from 'mongoose';
import {
  belugaCharacters,
  belugaScript,
  lionCharacters,
  lionScript,
} from '../../test/fixtures/story-json.js';
import { toFieldErrors } from '../common/pipes/validation.pipe.js';
import { checkScript, toStoredScript } from './check-script.js';
import { ScriptDto } from './dto/script.dto.js';
import { Chapter, ChapterSchema } from './entities/chapter.entity.js';

// does the same thing the ValidationPipe does and returns which fields failed
async function parse(input: object) {
  const dto = plainToInstance(ScriptDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: toFieldErrors(errors).map((e) => e.field) };
}

// copy so changing it in one test doesn't affect the others
const copy = (value: object) => structuredClone(value) as ScriptDto;

async function problems(input: object, characters = lionCharacters) {
  const { dto, fields } = await parse(input);
  expect(fields).toEqual([]);
  return checkScript(dto, characters).map((e) => e.field);
}

describe('ScriptDto and checkScript', () => {
  it.each([
    ['The Lion at the Door', lionScript, lionCharacters],
    ['the sprint-1 Team Beluga example', belugaScript, belugaCharacters],
  ])('accept %s', async (_, script, characters) => {
    expect(await problems(script, characters)).toEqual([]);
  });

  it.each([
    [
      'a word that is not a string',
      ['lines', 1, 'prose', 'text'],
      { words: [1] },
      'lines.1.prose.text.words',
    ],
    [
      'a text_color',
      ['lines', 1, 'prose'],
      { text: { words: ['Hi'] }, text_color: '#fff' },
      'lines.1.prose.text_color',
    ],
    [
      'an empty choice',
      ['lines', 7],
      { line_id: 7, choice: [] },
      'lines.7.choice',
    ],
    [
      'end set to false',
      ['lines', 17],
      { line_id: 17, end: false },
      'lines.17.end',
    ],
    [
      'an unknown field on a line',
      ['lines', 0],
      { line_id: 0, background: 'a.jpg', sound: 'x' },
      'lines.0.sound',
    ],
    ['variables', ['variables'], [{ name: 'cat_dead' }], 'variables'],
  ])('reject %s in the shape check', async (_, path, value, field) => {
    const script = structuredClone(lionScript) as Record<string, unknown>;
    const parent = path
      .slice(0, -1)
      .reduce<Record<string | number, unknown>>(
        (node, key) => node[key] as Record<string | number, unknown>,
        script,
      );
    parent[path.at(-1)!] = value;

    expect((await parse(script)).fields).toContain(field);
  });

  it('rejects a line with no kind or with two', async () => {
    const script = copy(lionScript);
    script.lines[0] = { line_id: 0 };
    script.lines[1].background = 'a.jpg';

    expect(await problems(script)).toEqual(['lines.0', 'lines.1']);
  });

  it('rejects a line_id that does not match its position', async () => {
    const script = copy(lionScript);
    script.lines[3].line_id = 4;

    expect(await problems(script)).toEqual(['lines.3.line_id']);
  });

  it('rejects jumps and flags that point past the last line', async () => {
    const script = copy(lionScript);
    script.lines[11].goto_line = 18;
    script.lines[7].choice![1].goto_line = 99;
    script.flags!.Morning.line_id = 18;

    expect(await problems(script)).toEqual([
      'lines.7.choice.1.goto_line',
      'lines.11.goto_line',
      'flags.Morning.line_id',
    ]);
  });

  it('rejects a goto_line that points to its own line', async () => {
    const script = copy(lionScript);
    script.lines[11].goto_line = 11;

    expect(await problems(script)).toEqual(['lines.11.goto_line']);
  });

  it('rejects unknown characters and emotions', async () => {
    const script = copy(lionScript);
    script.lines[2].dialogue!.name = 'Bob';
    script.lines[5].dialogue!.portrait = 'furious';

    expect(await problems(script)).toEqual([
      'lines.2.dialogue.name',
      'lines.5.dialogue.portrait',
    ]);
  });

  it('rejects badly formed flags', async () => {
    const script = copy(lionScript) as { flags: Record<string, unknown> };
    script.flags = {
      'Dr. Who': { line_id: 1 },
      Extra: { line_id: 1, colour: 'red' },
      NotAnObject: 3,
    };

    expect(await problems(script)).toEqual([
      'flags.Dr. Who',
      'flags.Extra',
      'flags.NotAnObject',
    ]);
  });
});

describe('toStoredScript', () => {
  it('fills in the placeholders the sprint-1 example leaves out', async () => {
    const { dto } = await parse(belugaScript);
    const stored = toStoredScript(dto);

    expect(stored.lines[0]).toEqual({
      line_id: 0,
      dialogue: {
        name: 'Arthur',
        portrait: 'default',
        text: { words: belugaScript.lines[0].dialogue!.text.words },
        text_color: null,
      },
    });
    expect(stored.lines[2].prose).toMatchObject({ text_color: null });
  });

  it('is stored and returned exactly as the contract describes', async () => {
    const { dto } = await parse(lionScript);
    const ChapterModel = model(Chapter.name, ChapterSchema);
    const chapter = new ChapterModel({
      storyId: new Types.ObjectId(),
      title: 'Chapter 1',
      order: 0,
      script: toStoredScript(dto),
    });

    await expect(chapter.validate()).resolves.toBeUndefined();
    // toStrictEqual so it fails if mongoose sneaks in an empty choice array or an _id
    expect(JSON.parse(JSON.stringify(chapter)).script).toStrictEqual(
      lionScript,
    );
  });
});
