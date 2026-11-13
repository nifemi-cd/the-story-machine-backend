import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AppException } from '../common/exceptions/app.exception.js';
import { User } from '../user/entities/user.entity.js';
import { Chapter } from '../chapter/entities/chapter.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { StoryService } from './story.service.js';
import { Story } from './entities/story.entity.js';
import { StoryStatus } from './enums/story-status.enum.js';

// mongoose queries are awaited through .exec() so the mocks need it too
const execResolving = (value: unknown) => ({
  exec: () => Promise.resolve(value),
});

describe('StoryService', () => {
  let service: StoryService;
  const authorId = new Types.ObjectId().toString();
  // the logged in user, who wrote the stories below unless a test says otherwise
  const userId = new Types.ObjectId(authorId);
  const someoneElse = new Types.ObjectId();
  // find() is chained (sort, skip, limit, populate) so each step returns the same mock
  const query = {
    sort: vi.fn(() => query),
    skip: vi.fn(() => query),
    limit: vi.fn(() => query),
    populate: vi.fn(() => query),
    exec: vi.fn(),
  };
  // what the GET routes ask mongoose to fill in for each story
  const authorFields = { path: 'author', select: 'displayName -_id' };
  const storyModel = {
    create: vi.fn(),
    find: vi.fn(() => query),
    countDocuments: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    exists: vi.fn(),
    updateOne: vi.fn(),
  };
  const userModel = { exists: vi.fn(), findById: vi.fn() };
  const chapterModel = { deleteMany: vi.fn() };
  // fake storage so unit tests never upload anything to azure
  const storage = { upload: vi.fn(), download: vi.fn(), delete: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    storyModel.create.mockImplementation((doc: object) =>
      Promise.resolve({ _id: 'new-id', ...doc }),
    );
    storyModel.updateOne.mockReturnValue(execResolving({}));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryService,
        { provide: getModelToken(Story.name), useValue: storyModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Chapter.name), useValue: chapterModel },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<StoryService>(StoryService);
  });

  // returns a findById mock result for a story with these fields
  // written by the logged in user unless authorId is overridden
  const storyFound = (fields: object = {}) =>
    execResolving({ authorId: userId, ...fields });

  // returns the error a promise rejects with
  const errorFrom = (promise: Promise<unknown>) =>
    promise.catch((e: unknown) => e) as Promise<AppException>;

  describe('create', () => {
    const dto = { title: 'The Lighthouse Keeper' };

    it('saves the story with the logged in user as the author', async () => {
      await service.create(userId, { ...dto });

      expect(storyModel.create).toHaveBeenCalledWith({
        ...dto,
        authorId: userId,
      });
    });

    it('keeps a sent default emotion where it is instead of adding another', async () => {
      await service.create(userId, {
        ...dto,
        characters: [
          {
            name: 'Cindy',
            description: 'A light sleeper',
            emotions: [{ emotion: 'worried' }, { emotion: 'default' }],
          },
        ],
      });

      expect(storyModel.create).toHaveBeenCalledWith({
        ...dto,
        authorId: userId,
        characters: [
          {
            name: 'Cindy',
            description: 'A light sleeper',
            emotions: [
              { emotion: 'worried', portrait_x: null, portrait_y: null },
              { emotion: 'default', portrait_x: null, portrait_y: null },
            ],
          },
        ],
      });
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      query.exec.mockResolvedValue([{ title: 'a' }]);
      storyModel.countDocuments.mockReturnValue(execResolving(21));
    });

    it('returns the page of stories with pagination meta', async () => {
      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result).toEqual({
        items: [{ title: 'a' }],
        meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
      });
      expect(query.skip).toHaveBeenCalledWith(20);
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    });

    it('lists every story when no filters are given', async () => {
      await service.findAll({ page: 1, limit: 20 });

      expect(storyModel.find).toHaveBeenCalledWith({});
      expect(storyModel.countDocuments).toHaveBeenCalledWith({});
    });

    it('filters by author and status, counting with the same filter', async () => {
      await service.findAll({
        page: 1,
        limit: 20,
        authorId,
        status: StoryStatus.Published,
      });

      const filter = {
        authorId: new Types.ObjectId(authorId),
        status: StoryStatus.Published,
      };
      expect(storyModel.find).toHaveBeenCalledWith(filter);
      expect(storyModel.countDocuments).toHaveBeenCalledWith(filter);
    });

    it("fills in each story's author with only their display name", async () => {
      await service.findAll({ page: 1, limit: 20 });

      expect(query.populate).toHaveBeenCalledWith(authorFields);
    });
  });

  describe('findOne', () => {
    const id = new Types.ObjectId();

    // findById(...).populate(...).exec()
    const storyPopulated = (value: unknown) => {
      const populate = vi.fn(() => execResolving(value));
      storyModel.findById.mockReturnValue({ populate });
      return populate;
    };

    it("returns the story with its author's display name filled in", async () => {
      const story = {
        _id: id,
        title: 'a',
        author: { _id: userId, displayName: 'Ada Writes' },
      };
      const populate = storyPopulated(story);

      await expect(service.findOne(id)).resolves.toBe(story);
      expect(storyModel.findById).toHaveBeenCalledWith(id);
      expect(populate).toHaveBeenCalledWith(authorFields);
    });

    it('throws a 404 when the story does not exist', async () => {
      storyPopulated(null);

      const error = await service.findOne(id).catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
    });
  });

  describe('findWithAuthorName', () => {
    const id = new Types.ObjectId();

    it("returns the story with its author's username", async () => {
      const story = { _id: id, authorId };
      storyModel.findById.mockReturnValue(execResolving(story));
      const select = vi.fn(() => execResolving({ username: 'mock-author' }));
      userModel.findById.mockReturnValue({ select });

      await expect(service.findWithAuthorName(id)).resolves.toEqual({
        story,
        author: 'mock-author',
      });
      expect(userModel.findById).toHaveBeenCalledWith(authorId);
      expect(select).toHaveBeenCalledWith('username');
    });

    it('throws a 404 when the story does not exist', async () => {
      storyModel.findById.mockReturnValue(execResolving(null));

      const error = await service
        .findWithAuthorName(id)
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
      expect(userModel.findById).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const id = new Types.ObjectId();
    const updated = { _id: id, title: 'New' };

    beforeEach(() => {
      storyModel.findById.mockReturnValue(
        storyFound({ status: StoryStatus.Draft }),
      );
      storyModel.findByIdAndUpdate.mockReturnValue(execResolving(updated));
    });

    const sentChanges = () =>
      storyModel.findByIdAndUpdate.mock.calls[0][1] as Record<string, unknown>;

    it('applies only the sent fields and returns the updated story', async () => {
      await expect(
        service.update(id, userId, { title: 'New', description: undefined }),
      ).resolves.toBe(updated);

      expect(storyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { title: 'New' },
        { returnDocument: 'after', runValidators: true },
      );
    });

    it('rejects a story someone else wrote with a 403 and changes nothing', async () => {
      storyModel.findById.mockReturnValue(
        storyFound({ authorId: someoneElse }),
      );

      const error = await errorFrom(service.update(id, userId, { title: 'X' }));

      expect(error).toBeInstanceOf(AppException);
      expect(error.getStatus()).toBe(403);
      expect(storyModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('replaces the characters, adding the default emotion', async () => {
      await service.update(id, userId, {
        characters: [{ name: 'Dave', emotions: [{ emotion: 'angry' }] }],
      });

      expect(sentChanges()).toEqual({
        characters: [
          {
            name: 'Dave',
            description: null,
            emotions: [
              { emotion: 'default', portrait_x: null, portrait_y: null },
              { emotion: 'angry', portrait_x: null, portrait_y: null },
            ],
          },
        ],
      });
    });

    it('sets publishedAt when a draft is published', async () => {
      await service.update(id, userId, { status: StoryStatus.Published });

      expect(sentChanges()).toEqual({
        status: StoryStatus.Published,
        publishedAt: expect.any(Date),
      });
    });

    it('clears publishedAt when a story goes back to draft', async () => {
      storyModel.findById.mockReturnValue(
        storyFound({ status: StoryStatus.Published }),
      );

      await service.update(id, userId, { status: StoryStatus.Draft });

      expect(sentChanges()).toEqual({
        status: StoryStatus.Draft,
        publishedAt: null,
      });
    });

    it('keeps the original publishedAt when re-sending the same status', async () => {
      storyModel.findById.mockReturnValue(
        storyFound({ status: StoryStatus.Published }),
      );

      await service.update(id, userId, { status: StoryStatus.Published });

      expect(sentChanges()).toEqual({});
    });

    it('throws a 404 when the story does not exist', async () => {
      storyModel.findById.mockReturnValue(execResolving(null));

      const error = await errorFrom(service.update(id, userId, { title: 'X' }));

      expect(error.getStatus()).toBe(404);
      expect(storyModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('throws a 404 when the story is deleted while updating', async () => {
      storyModel.findByIdAndUpdate.mockReturnValue(execResolving(null));

      const error = await errorFrom(service.update(id, userId, { title: 'X' }));

      expect(error.getStatus()).toBe(404);
    });
  });

  describe('remove', () => {
    const id = new Types.ObjectId();

    beforeEach(() => {
      storyModel.findById.mockReturnValue(storyFound({ _id: id }));
      storyModel.findByIdAndDelete.mockReturnValue(execResolving({ _id: id }));
      chapterModel.deleteMany.mockReturnValue(execResolving({}));
    });

    it('deletes the story, then its chapters and draft file', async () => {
      await expect(service.remove(id, userId)).resolves.toBeUndefined();
      expect(storyModel.findByIdAndDelete).toHaveBeenCalledWith(id);
      expect(chapterModel.deleteMany).toHaveBeenCalledWith({ storyId: id });
      expect(storage.delete).toHaveBeenCalledWith(
        `drafts/${id.toString()}.txt`,
      );
    });

    it.each([
      ['a 404 when the story does not exist', null, 404],
      [
        'a 403 when someone else wrote the story',
        { authorId: someoneElse },
        403,
      ],
    ])('throws %s and deletes nothing', async (_label, found, status) => {
      storyModel.findById.mockReturnValue(execResolving(found));

      const error = await errorFrom(service.remove(id, userId));

      expect(error.getStatus()).toBe(status);
      expect(storyModel.findByIdAndDelete).not.toHaveBeenCalled();
      expect(chapterModel.deleteMany).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('uploadFile', () => {
    const id = new Types.ObjectId();
    const textFile = {
      mimetype: 'text/plain',
      buffer: Buffer.from('Once upon a time...'),
    } as Express.Multer.File;
    const url = `https://example.blob.core.windows.net/stories/drafts/${id.toString()}.txt`;

    beforeEach(() => {
      storyModel.findById.mockReturnValue(storyFound({ _id: id }));
      storage.upload.mockResolvedValue(url);
      storyModel.findByIdAndUpdate.mockReturnValue(
        execResolving({ _id: id, draftUrl: url }),
      );
    });

    it('uploads the file and saves its URL as draftUrl', async () => {
      const story = await service.uploadFile(id, userId, textFile);

      expect(storage.upload).toHaveBeenCalledWith(
        `drafts/${id.toString()}.txt`,
        textFile.buffer,
        'text/plain; charset=utf-8',
      );
      expect(storyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { draftUrl: url },
        { returnDocument: 'after' },
      );
      expect(story.draftUrl).toBe(url);
    });

    it.each([
      ['no file is sent', undefined],
      [
        'the file is not plain text',
        { ...textFile, mimetype: 'image/png' } as Express.Multer.File,
      ],
    ])('throws a 400 naming the file field when %s', async (_, file) => {
      const error = await service
        .uploadFile(id, userId, file)
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(400);
      expect((error as AppException).errors?.[0].field).toBe('file');
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it.each([
      ['a 404 when the story does not exist', null, 404],
      [
        'a 403 when someone else wrote the story',
        { authorId: someoneElse },
        403,
      ],
    ])('throws %s and uploads nothing', async (_label, found, status) => {
      storyModel.findById.mockReturnValue(execResolving(found));

      const error = await errorFrom(service.uploadFile(id, userId, textFile));

      expect(error.getStatus()).toBe(status);
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    const id = new Types.ObjectId();

    it('returns the draft file contents', async () => {
      const content = Buffer.from('Once upon a time...');
      storyModel.findById.mockReturnValue(
        execResolving({ _id: id, draftUrl: 'https://example/draft.txt' }),
      );
      storage.download.mockResolvedValue(content);

      await expect(service.getFile(id)).resolves.toBe(content);
      expect(storage.download).toHaveBeenCalledWith(
        `drafts/${id.toString()}.txt`,
      );
    });

    it('throws a 404 when the story has no file yet', async () => {
      storyModel.findById.mockReturnValue(
        execResolving({ _id: id, draftUrl: null }),
      );

      const error = await service.getFile(id).catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
      expect(storage.download).not.toHaveBeenCalled();
    });
  });

  describe('chapterOrder helpers', () => {
    const storyId = new Types.ObjectId();
    const chapterId = new Types.ObjectId();

    it('appends a chapter and returns its position', async () => {
      storyModel.findByIdAndUpdate.mockReturnValue(
        execResolving({
          chapterOrder: [
            { chapterId: new Types.ObjectId(), title: 'One' },
            { chapterId, title: 'Two' },
          ],
        }),
      );

      await expect(service.addChapter(storyId, chapterId, 'Two')).resolves.toBe(
        1,
      );
      expect(storyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        storyId,
        { $push: { chapterOrder: { chapterId, title: 'Two' } } },
        { returnDocument: 'after', projection: { chapterOrder: 1 } },
      );
    });

    it('throws a 404 when adding to a missing story', async () => {
      storyModel.findByIdAndUpdate.mockReturnValue(execResolving(null));

      const error = await service
        .addChapter(storyId, chapterId, 'Two')
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
    });

    it('renames the matching chapterOrder entry', async () => {
      await service.renameChapter(storyId, chapterId, 'Renamed');

      expect(storyModel.updateOne).toHaveBeenCalledWith(
        { _id: storyId, 'chapterOrder.chapterId': chapterId },
        { $set: { 'chapterOrder.$.title': 'Renamed' } },
      );
    });

    it('removes a chapter from chapterOrder', async () => {
      await service.removeChapter(storyId, chapterId);

      expect(storyModel.updateOne).toHaveBeenCalledWith(
        { _id: storyId },
        { $pull: { chapterOrder: { chapterId } } },
      );
    });

    it('ensureExists throws a 404 for a missing story', async () => {
      storyModel.exists.mockResolvedValue(null);

      const error = await service
        .ensureExists(storyId)
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
    });
  });
});
