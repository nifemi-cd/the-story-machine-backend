import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  type HydratedDocument,
  type Types,
} from 'mongoose';
import { User } from '../../user/entities/user.entity.js';
import { StoryStatus } from '../enums/story-status.enum.js';

// basically the table of contents. we copy the title in here so we can show
// the list of chapters without loading every chapter
@Schema({ _id: false })
export class ChapterRef {
  // 'Chapter' as a string because importing the class would be a circular import
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Chapter', required: true })
  chapterId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;
}

export const ChapterRefSchema = SchemaFactory.createForClass(ChapterRef);

@Schema({ _id: false })
export class Emotion {
  @Prop({ required: true, trim: true })
  emotion: string;

  // where the portrait goes on screen, not used until a later sprint
  @Prop({ type: Number, default: null })
  portrait_x: number | null;

  @Prop({ type: Number, default: null })
  portrait_y: number | null;
}

export const EmotionSchema = SchemaFactory.createForClass(Emotion);

// The contract has characters as an object keyed by name, but mongo keys
// can't have a "." in them (Dr. Smith would break), so we store a list and
// turn it into the object when sending it back.
@Schema({ _id: false })
export class Character {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  description: string | null;

  // always has "default" in it, see toCharacters in the story service
  @Prop({ type: [EmotionSchema], default: [] })
  emotions: Emotion[];
}

export const CharacterSchema = SchemaFactory.createForClass(Character);

// id: false because turning on virtuals for toJSON (below) would also add an
// "id" copy of _id to every story
@Schema({ timestamps: true, id: false })
export class Story {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ trim: true, maxlength: 2000, default: '' })
  description: string;

  @Prop({
    type: String,
    enum: StoryStatus,
    default: StoryStatus.Draft,
  })
  status: StoryStatus;

  // url of the uploaded .txt in azure, null until something is uploaded
  @Prop({ type: String, default: null })
  draftUrl: string | null;

  // set when published, goes back to null if it's moved back to draft
  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  // only the chapter routes change this, never the story PATCH
  @Prop({ type: [ChapterRefSchema], default: [] })
  chapterOrder: ChapterRef[];

  // on the story instead of each chapter so all chapters share the same cast
  @Prop({ type: [CharacterSchema], default: [] })
  characters: Character[];

  // stored as numbers so story cards don't have to count everything
  // (likes, comments and reads aren't built yet)
  @Prop({ default: 0, min: 0 })
  likeCount: number;

  @Prop({ default: 0, min: 0 })
  commentCount: number;

  @Prop({ default: 0, min: 0 })
  readCount: number;

  createdAt: Date;
  updatedAt: Date;

  // not saved, filled in by .populate('author'), see the virtual below
  author?: Pick<User, 'displayName'> & { _id: Types.ObjectId };
}

export type StoryDocument = HydratedDocument<Story>;
export const StorySchema = SchemaFactory.createForClass(Story);

// for the "my stories" page
StorySchema.index({ authorId: 1, createdAt: -1 });
// for the published feed
StorySchema.index({ status: 1, createdAt: -1 });

// the author's user, found through authorId. a virtual instead of populating
// authorId itself, so authorId stays a plain id in the response and the
// author only checks can keep comparing it to the logged in user's id
StorySchema.virtual('author', {
  ref: User.name,
  localField: 'authorId',
  foreignField: '_id',
  justOne: true,
});

// virtuals: true so a populated author is sent back with the story
StorySchema.set('toJSON', { versionKey: false, virtuals: true });
