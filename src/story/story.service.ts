import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type QueryFilter } from 'mongoose';
import { AppException } from '../common/exceptions/app.exception.js';
import type { PaginatedResult } from '../common/interfaces/api-response.interface.js';
import { User } from '../user/entities/user.entity.js';
import { Chapter } from '../chapter/entities/chapter.entity.js';
import { StorageService } from '../storage/storage.service.js';
import type { CharacterDto } from './dto/character.dto.js';
import { CreateStoryDto } from './dto/create-story.dto.js';
import { ListStoriesQueryDto } from './dto/list-stories-query.dto.js';
import { UpdateStoryDto } from './dto/update-story.dto.js';
import {
  Story,
  type Character,
  type StoryDocument,
} from './entities/story.entity.js';
import { StoryStatus } from './enums/story-status.enum.js';

@Injectable()
export class StoryService {
  constructor(
    @InjectModel(Story.name) private readonly storyModel: Model<Story>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Chapter.name) private readonly chapterModel: Model<Chapter>,
    private readonly storage: StorageService,
  ) {}

  // creates a draft story and returns it
  async create(createStoryDto: CreateStoryDto): Promise<StoryDocument> {
    // mongo won't stop us saving a fake authorId, so check it here
    await this.authorExist(createStoryDto.authorId);

    const { characters, ...fields } = createStoryDto;
    return await this.storyModel.create({
      ...fields,
      ...(characters && { characters: toCharacters(characters) }),
    });
  }

  // returns one page of stories, newest first, plus the pagination info
  async findAll({
    page,
    limit,
    authorId,
    status,
  }: ListStoriesQueryDto): Promise<PaginatedResult<StoryDocument>> {
    const filter: QueryFilter<Story> = {};
    if (authorId) filter.authorId = new Types.ObjectId(authorId);
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      this.storyModel
        .find(filter)
        // sorting by _id too so stories with the same createdAt don't jump between pages
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.storyModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // returns one story or throws a 404
  async findOne(id: Types.ObjectId) {
    return await this.findStoryById(id);
  }

  // returns the story and its author's username
  // the chapter routes show the author's username instead of their id
  async findWithAuthorName(
    id: Types.ObjectId,
  ): Promise<{ story: StoryDocument; author: string }> {
    const story = await this.findStoryById(id);
    const user = await this.userModel
      .findById(story.authorId)
      .select('username')
      .exec();
    // users can't be deleted yet so this should always find someone
    return { story, author: user?.username ?? '' };
  }

  // updates the fields that were sent and returns the updated story
  async update(
    id: Types.ObjectId,
    updateStoryDto: UpdateStoryDto,
  ): Promise<StoryDocument> {
    const { characters, status, ...fields } = updateStoryDto;
    const changes: Record<string, unknown> = withoutUndefined(fields);
    if (characters) changes.characters = toCharacters(characters);

    // only reset publishedAt if the status is actually different, otherwise
    // re-sending "published" would bump the date every time
    if (status) {
      const story = await this.findStoryById(id);
      if (story.status !== status) {
        changes.status = status;
        changes.publishedAt =
          status === StoryStatus.Published ? new Date() : null;
      }
    }

    const story = await this.storyModel
      .findByIdAndUpdate(id, changes, {
        returnDocument: 'after',
        // schema rules like maxlength don't run on updates unless we ask
        runValidators: true,
      })
      .exec();
    if (!story) {
      throw AppException.notfound('Story not found');
    }
    return story;
  }

  // deletes the story along with its chapters and file, returns nothing
  // deletes the story first, so if cleaning up chapters or the file fails
  // we're left with leftovers nobody can see instead of a broken story
  async remove(id: Types.ObjectId): Promise<void> {
    const story = await this.storyModel.findByIdAndDelete(id).exec();
    if (!story) {
      throw AppException.notfound('Story not found');
    }
    await this.chapterModel.deleteMany({ storyId: id }).exec();
    await this.storage.delete(draftFileName(id));
  }

  // saves the txt file to storage and returns the story with draftUrl set
  async uploadFile(
    id: Types.ObjectId,
    file?: Express.Multer.File,
  ): Promise<StoryDocument> {
    if (!file || file.mimetype !== 'text/plain') {
      throw AppException.badRequest('A .txt file is required', [
        {
          field: 'file',
          message: 'file must be a plain text (.txt) file',
          success: false,
        },
      ]);
    }
    // check before uploading so we don't store files for stories that don't exist
    await this.findStoryById(id);

    const url = await this.storage.upload(
      draftFileName(id),
      file.buffer,
      'text/plain; charset=utf-8',
    );
    const story = await this.storyModel
      .findByIdAndUpdate(id, { draftUrl: url }, { returnDocument: 'after' })
      .exec();
    // could happen if the story got deleted while the upload was running
    if (!story) {
      throw AppException.notfound('Story not found');
    }
    return story;
  }

  // returns the contents of the story's file
  async getFile(id: Types.ObjectId): Promise<Buffer> {
    const story = await this.findStoryById(id);
    if (!story.draftUrl) {
      throw AppException.notfound('This story has no file yet');
    }
    return await this.storage.download(draftFileName(id));
  }

  // throws a 404 if the story doesn't exist, returns nothing
  async ensureExists(id: Types.ObjectId): Promise<void> {
    if (!(await this.storyModel.exists({ _id: id }))) {
      throw AppException.notfound('Story not found');
    }
  }

  // returns the new chapter's position. $push does it in one step so two
  // chapters added at the same time can't end up with the same position
  async addChapter(
    storyId: Types.ObjectId,
    chapterId: Types.ObjectId,
    title: string,
  ): Promise<number> {
    const story = await this.storyModel
      .findByIdAndUpdate(
        storyId,
        { $push: { chapterOrder: { chapterId, title } } },
        { returnDocument: 'after', projection: { chapterOrder: 1 } },
      )
      .exec();
    if (!story) {
      throw AppException.notfound('Story not found');
    }
    return story.chapterOrder.findIndex((ref) =>
      ref.chapterId.equals(chapterId),
    );
  }

  // updates the chapter's title in chapterOrder
  async renameChapter(
    storyId: Types.ObjectId,
    chapterId: Types.ObjectId,
    title: string,
  ): Promise<void> {
    await this.storyModel
      .updateOne(
        { _id: storyId, 'chapterOrder.chapterId': chapterId },
        // the $ means "whichever chapterOrder entry matched the filter"
        { $set: { 'chapterOrder.$.title': title } },
      )
      .exec();
  }

  // removes the chapter from chapterOrder
  async removeChapter(
    storyId: Types.ObjectId,
    chapterId: Types.ObjectId,
  ): Promise<void> {
    await this.storyModel
      .updateOne({ _id: storyId }, { $pull: { chapterOrder: { chapterId } } })
      .exec();
  }

  // returns the story or throws a 404
  private async findStoryById(id: Types.ObjectId): Promise<StoryDocument> {
    const story = await this.storyModel.findById(id).exec();
    if (!story) {
      throw AppException.notfound('Story not found');
    }
    return story;
  }

  // throws a 400 if the author doesn't exist
  private async authorExist(authorId: string) {
    if (!(await this.userModel.exists({ _id: authorId }))) {
      throw AppException.badRequest('Author not found', [
        {
          field: 'authorId',
          message: 'authorId must belong to an existing user',
          success: false,
        },
      ]);
    }
  }
}

// returns the characters in the shape we save
// every character gets a "default" emotion so dialogue lines without a
// portrait still have something to show
function toCharacters(characters: CharacterDto[]): Character[] {
  return characters.map(({ name, description, emotions = [] }) => {
    const names = emotions.map((e) => e.emotion);
    if (!names.includes('default')) names.unshift('default');
    return {
      name,
      description: description ?? null,
      emotions: names.map((emotion) => ({
        emotion,
        portrait_x: null,
        portrait_y: null,
      })),
    };
  });
}

// returns where the story's file is kept in storage
function draftFileName(id: Types.ObjectId): string {
  return `drafts/${id.toString()}.txt`;
}

// returns the object without the undefined fields
// so a PATCH doesn't overwrite fields the client didn't send
function withoutUndefined(object: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}
