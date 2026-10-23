import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../common/exceptions/app.exception.js';
import type { StoryDocument } from '../story/entities/story.entity.js';
import { StoryService } from '../story/story.service.js';
import { CreateChapterDto } from './dto/create-chapter.dto.js';
import { UpdateChapterDto } from './dto/update-chapter.dto.js';
import { ScriptDto } from './dto/script.dto.js';
import { checkScript, toStoredScript } from './check-script.js';
import { Chapter, type ChapterDocument } from './entities/chapter.entity.js';

// what the chapter routes send back, matching the story JSON contract
export interface ChapterView {
  title: string;
  author: string;
  story_id: string;
  chapter_id: string;
  chapter_name: string;
  characters: Record<string, unknown>;
  story: unknown;
}

export type ChapterSummary = Omit<ChapterView, 'characters' | 'story'>;

// In the database a chapter's name is "title" and its script is "script".
// The API uses the contract names (chapter_name and story) instead, so the
// toView/toSummary helpers at the bottom do the renaming.
@Injectable()
export class ChapterService {
  constructor(
    @InjectModel(Chapter.name) private readonly chapterModel: Model<Chapter>,
    private readonly storyService: StoryService,
  ) {}

  // adds a chapter to the end of the story and returns it
  async create(
    storyId: Types.ObjectId,
    { chapter_name, story: script }: CreateChapterDto,
  ): Promise<ChapterView> {
    const { story, author } =
      await this.storyService.findWithAuthorName(storyId);
    // the script is under "story" in the body so errors should say story.lines... etc
    if (script) this.assertValidScript(script, story, 'story.');

    // make the id ourselves so we can add it to chapterOrder before saving
    const _id = new Types.ObjectId();
    const order = await this.storyService.addChapter(
      storyId,
      _id,
      chapter_name,
    );

    try {
      const chapter = await this.chapterModel.create({
        _id,
        storyId,
        order,
        title: chapter_name,
        script: script ? toStoredScript(script) : null,
      });
      return toView(chapter, story, author);
    } catch (error) {
      // undo the chapterOrder entry so the story doesn't point at a chapter that was never saved
      await this.storyService.removeChapter(storyId, _id);
      throw error;
    }
  }

  // returns the story's chapters in reading order, without scripts
  async findAll(storyId: Types.ObjectId): Promise<ChapterSummary[]> {
    const { story, author } =
      await this.storyService.findWithAuthorName(storyId);

    // leave out the scripts since they can be big and the list doesn't need them
    const chapters = await this.chapterModel
      .find({ storyId })
      .select('-script')
      .sort({ order: 1 })
      .exec();
    return chapters.map((chapter) => toSummary(chapter, story, author));
  }

  // returns one chapter with its script, ready for the reader
  async findOne(
    storyId: Types.ObjectId,
    id: Types.ObjectId,
  ): Promise<ChapterView> {
    const [chapter, { story, author }] = await Promise.all([
      this.findChapter(storyId, id),
      this.storyService.findWithAuthorName(storyId),
    ]);
    return toView(chapter, story, author);
  }

  // updates the chapter name and returns the updated chapter
  async update(
    storyId: Types.ObjectId,
    id: Types.ObjectId,
    { chapter_name }: UpdateChapterDto,
  ): Promise<ChapterView> {
    const { story, author } =
      await this.storyService.findWithAuthorName(storyId);

    const chapter = await this.chapterModel
      .findOneAndUpdate(
        { _id: id, storyId },
        chapter_name === undefined ? {} : { title: chapter_name },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
    if (!chapter) {
      throw AppException.notfound('Chapter not found');
    }

    // the story keeps a copy of each chapter title, so update that too
    if (chapter_name) {
      await this.storyService.renameChapter(storyId, id, chapter.title);
    }
    return toView(chapter, story, author);
  }

  // deletes the chapter and fixes the order of the ones after it
  async remove(storyId: Types.ObjectId, id: Types.ObjectId): Promise<void> {
    const chapter = await this.chapterModel
      .findOneAndDelete({ _id: id, storyId })
      .exec();
    if (!chapter) {
      throw AppException.notfound('Chapter not found');
    }

    await this.storyService.removeChapter(storyId, id);
    // shift the later chapters down by one so order still matches chapterOrder
    await this.chapterModel
      .updateMany(
        { storyId, order: { $gt: chapter.order } },
        { $inc: { order: -1 } },
      )
      .exec();
  }

  // checks the script against the story, saves it and returns the updated chapter
  async saveScript(
    storyId: Types.ObjectId,
    id: Types.ObjectId,
    scriptDto: ScriptDto,
  ): Promise<ChapterView> {
    // need the story here to check dialogue against its characters
    const { story, author } =
      await this.storyService.findWithAuthorName(storyId);
    this.assertValidScript(scriptDto, story);

    const chapter = await this.chapterModel
      .findOneAndUpdate(
        { _id: id, storyId },
        { script: toStoredScript(scriptDto) },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
    if (!chapter) {
      throw AppException.notfound('Chapter not found');
    }
    return toView(chapter, story, author);
  }

  // returns the chapter or throws a 404
  // filtering by storyId too means you can't load a chapter through some other story's url
  private async findChapter(
    storyId: Types.ObjectId,
    id: Types.ObjectId,
  ): Promise<ChapterDocument> {
    const chapter = await this.chapterModel
      .findOne({ _id: id, storyId })
      .exec();
    if (!chapter) {
      throw AppException.notfound('Chapter not found');
    }
    return chapter;
  }

  // throws a 400 listing every problem if the script is invalid
  private assertValidScript(
    script: ScriptDto,
    story: StoryDocument,
    prefix = '',
  ): void {
    const errors = checkScript(script, story.characters);
    if (errors.length) {
      throw AppException.validation(
        errors.map((e) => ({ ...e, field: `${prefix}${e.field}` })),
        'Script is invalid',
      );
    }
  }
}

// returns the basic chapter fields used in the chapter list
function toSummary(
  chapter: ChapterDocument,
  story: StoryDocument,
  author: string,
): ChapterSummary {
  return {
    title: story.title,
    author,
    story_id: story._id.toString(),
    chapter_id: chapter._id.toString(),
    chapter_name: chapter.title,
  };
}

// returns the full chapter including the characters and script
function toView(
  chapter: ChapterDocument,
  story: StoryDocument,
  author: string,
): ChapterView {
  // toJSON turns the flags Map into a normal object
  const { script } = chapter.toJSON();
  return {
    ...toSummary(chapter, story, author),
    // we store characters as a list but the contract wants them keyed by name
    characters: Object.fromEntries(
      story.toJSON().characters.map((c) => [c.name, c]),
    ),
    // no script yet means an empty one, which the reader shows as the end screen
    story: script ?? { flags: {}, variables: [], lines: [] },
  };
}
