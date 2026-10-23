import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { model, Types } from 'mongoose';
import { lionCharacters, lionScript } from '../../test/fixtures/story-json.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { Story, StorySchema } from '../story/entities/story.entity.js';
import { StoryService } from '../story/story.service.js';
import { ChapterService } from './chapter.service.js';
import type { ScriptDto } from './dto/script.dto.js';
import { Chapter, ChapterSchema } from './entities/chapter.entity.js';

// mongoose queries are awaited through .exec() so the mocks need it too
const execResolving = (value: unknown) => ({
  exec: () => Promise.resolve(value),
});

// real documents so toJSON works like it does with the actual database
const StoryModel = model(Story.name, StorySchema);
const ChapterModel = model(Chapter.name, ChapterSchema);

// plain objects are fine here instead of real ScriptDto instances
const script = lionScript as unknown as ScriptDto;

describe('ChapterService', () => {
  let service: ChapterService;
  const storyId = new Types.ObjectId();
  const id = new Types.ObjectId();
  const story = new StoryModel({
    _id: storyId,
    authorId: new Types.ObjectId(),
    title: 'The Lion at the Door',
    characters: lionCharacters,
  });

  const chapterDoc = (fields: object = {}) =>
    new ChapterModel({
      _id: id,
      storyId,
      title: 'Chapter 1',
      order: 0,
      ...fields,
    });

  const summary = {
    title: 'The Lion at the Door',
    author: 'mock-author',
    story_id: storyId.toString(),
    chapter_id: id.toString(),
    chapter_name: 'Chapter 1',
  };
  const characters = { Dave: lionCharacters[0], Cindy: lionCharacters[1] };
  const emptyScript = { flags: {}, variables: [], lines: [] };

  // find() is chained (sort, skip, limit) so each step returns the same mock
  const query = {
    select: vi.fn(() => query),
    sort: vi.fn(() => query),
    exec: vi.fn(),
  };
  const chapterModel = {
    create: vi.fn(),
    find: vi.fn(() => query),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
    updateMany: vi.fn(),
  };
  const storyService = {
    addChapter: vi.fn(),
    removeChapter: vi.fn(),
    renameChapter: vi.fn(),
    findWithAuthorName: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    storyService.findWithAuthorName.mockResolvedValue({
      story,
      author: 'mock-author',
    });
    storyService.addChapter.mockResolvedValue(2);
    chapterModel.create.mockImplementation((doc: object) =>
      Promise.resolve(new ChapterModel(doc)),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChapterService,
        { provide: getModelToken(Chapter.name), useValue: chapterModel },
        { provide: StoryService, useValue: storyService },
      ],
    }).compile();

    service = module.get<ChapterService>(ChapterService);
  });

  // what the client would actually get after JSON.stringify
  const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

  describe('create', () => {
    it('adds the chapter to the story and saves it at that position', async () => {
      await service.create(storyId, { chapter_name: 'Chapter 1' });

      const [sentStoryId, chapterId, title] = storyService.addChapter.mock
        .calls[0] as [Types.ObjectId, Types.ObjectId, string];
      expect(sentStoryId).toBe(storyId);
      expect(title).toBe('Chapter 1');
      // should be saved with the same id that got added to chapterOrder
      expect(chapterModel.create).toHaveBeenCalledWith({
        _id: chapterId,
        storyId,
        order: 2,
        title: 'Chapter 1',
        script: null,
      });
    });

    it('returns the contract shape with an empty story when none is sent', async () => {
      const result = await service.create(storyId, {
        chapter_name: 'Chapter 1',
      });

      expect(asJson(result)).toStrictEqual({
        ...summary,
        chapter_id: expect.any(String),
        characters,
        story: emptyScript,
      });
    });

    it('saves a sent story and returns it', async () => {
      const result = await service.create(storyId, {
        chapter_name: 'Chapter 1',
        story: script,
      });

      expect(chapterModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ script: lionScript }),
      );
      expect(asJson(result)).toMatchObject({ story: lionScript });
    });

    it('rejects an invalid story with errors under story.', async () => {
      const broken = structuredClone(script);
      broken.lines[2].dialogue!.name = 'Bob';

      const error = await service
        .create(storyId, { chapter_name: 'Chapter 1', story: broken })
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(400);
      expect(error).toMatchObject({
        message: 'Script is invalid',
        errors: [{ field: 'story.lines.2.dialogue.name' }],
      });
      expect(storyService.addChapter).not.toHaveBeenCalled();
    });

    it('does not save the chapter when the story does not exist', async () => {
      storyService.findWithAuthorName.mockRejectedValue(
        AppException.notfound('Story not found'),
      );

      const error = await service
        .create(storyId, { chapter_name: 'Chapter 1' })
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
      expect(storyService.addChapter).not.toHaveBeenCalled();
      expect(chapterModel.create).not.toHaveBeenCalled();
    });

    it('takes the chapter back out of the story if saving fails', async () => {
      const dbError = new Error('connection lost');
      chapterModel.create.mockRejectedValue(dbError);

      await expect(
        service.create(storyId, { chapter_name: 'Chapter 1' }),
      ).rejects.toBe(dbError);

      const chapterId = storyService.addChapter.mock.calls[0][1] as unknown;
      expect(storyService.removeChapter).toHaveBeenCalledWith(
        storyId,
        chapterId,
      );
    });
  });

  describe('findAll', () => {
    it("returns the story's chapters in order, without story or characters", async () => {
      query.exec.mockResolvedValue([chapterDoc()]);

      await expect(service.findAll(storyId)).resolves.toStrictEqual([summary]);
      expect(chapterModel.find).toHaveBeenCalledWith({ storyId });
      expect(query.select).toHaveBeenCalledWith('-script');
      expect(query.sort).toHaveBeenCalledWith({ order: 1 });
    });

    it('throws a 404 when the story does not exist', async () => {
      storyService.findWithAuthorName.mockRejectedValue(
        AppException.notfound('Story not found'),
      );

      const error = await service.findAll(storyId).catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
      expect(chapterModel.find).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the chapter in the story JSON contract shape', async () => {
      chapterModel.findOne.mockReturnValue(
        execResolving(chapterDoc({ script: lionScript })),
      );

      const result = await service.findOne(storyId, id);

      expect(chapterModel.findOne).toHaveBeenCalledWith({ _id: id, storyId });
      expect(asJson(result)).toStrictEqual({
        ...summary,
        characters,
        story: lionScript,
      });
    });

    it('gives a chapter without a script an empty one', async () => {
      chapterModel.findOne.mockReturnValue(execResolving(chapterDoc()));

      const result = await service.findOne(storyId, id);

      expect(result.story).toEqual(emptyScript);
    });

    it('throws a 404 when the story has no such chapter', async () => {
      chapterModel.findOne.mockReturnValue(execResolving(null));

      const error = await service.findOne(storyId, id).catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
    });
  });

  describe('update', () => {
    it('renames the chapter and copies the new name into the story', async () => {
      chapterModel.findOneAndUpdate.mockReturnValue(
        execResolving(chapterDoc({ title: 'Renamed' })),
      );

      const result = await service.update(storyId, id, {
        chapter_name: 'Renamed',
      });

      expect(chapterModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id, storyId },
        { title: 'Renamed' },
        { returnDocument: 'after', runValidators: true },
      );
      expect(storyService.renameChapter).toHaveBeenCalledWith(
        storyId,
        id,
        'Renamed',
      );
      expect(result).toMatchObject({ chapter_name: 'Renamed' });
    });

    it('leaves the story alone when chapter_name is not sent', async () => {
      chapterModel.findOneAndUpdate.mockReturnValue(
        execResolving(chapterDoc()),
      );

      await service.update(storyId, id, {});

      expect(chapterModel.findOneAndUpdate.mock.calls[0][1]).toEqual({});
      expect(storyService.renameChapter).not.toHaveBeenCalled();
    });

    it('throws a 404 when the story has no such chapter', async () => {
      chapterModel.findOneAndUpdate.mockReturnValue(execResolving(null));

      const error = await service
        .update(storyId, id, { chapter_name: 'Renamed' })
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
      expect(storyService.renameChapter).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      chapterModel.updateMany.mockReturnValue(execResolving({}));
    });

    it('deletes the chapter, takes it out of the story and moves later chapters up', async () => {
      chapterModel.findOneAndDelete.mockReturnValue(
        execResolving({ _id: id, order: 1 }),
      );

      await expect(service.remove(storyId, id)).resolves.toBeUndefined();
      expect(chapterModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: id,
        storyId,
      });
      expect(storyService.removeChapter).toHaveBeenCalledWith(storyId, id);
      expect(chapterModel.updateMany).toHaveBeenCalledWith(
        { storyId, order: { $gt: 1 } },
        { $inc: { order: -1 } },
      );
    });

    it('throws a 404 and changes nothing else when the story has no such chapter', async () => {
      chapterModel.findOneAndDelete.mockReturnValue(execResolving(null));

      const error = await service.remove(storyId, id).catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
      expect(storyService.removeChapter).not.toHaveBeenCalled();
      expect(chapterModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('saveScript', () => {
    it('checks the script against the story, saves it and returns the chapter', async () => {
      chapterModel.findOneAndUpdate.mockReturnValue(
        execResolving(chapterDoc({ script: lionScript })),
      );

      const result = await service.saveScript(storyId, id, script);

      expect(chapterModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id, storyId },
        { script: lionScript },
        { returnDocument: 'after', runValidators: true },
      );
      expect(asJson(result)).toStrictEqual({
        ...summary,
        characters,
        story: lionScript,
      });
    });

    it('rejects a script that uses a character the story does not have', async () => {
      storyService.findWithAuthorName.mockResolvedValue({
        story: new StoryModel({
          _id: storyId,
          authorId: story.authorId,
          title: story.title,
        }),
        author: 'mock-author',
      });

      const error = await service
        .saveScript(storyId, id, script)
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(400);
      expect(error).toMatchObject({
        message: 'Script is invalid',
        // here the body is the script itself so there's no "story." in front
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'lines.2.dialogue.name' }),
        ]),
      });
      expect(chapterModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('throws a 404 when the story has no such chapter', async () => {
      chapterModel.findOneAndUpdate.mockReturnValue(execResolving(null));

      const error = await service
        .saveScript(storyId, id, script)
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
    });
  });
});
