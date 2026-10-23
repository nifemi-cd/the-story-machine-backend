import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  type HydratedDocument,
  type Types,
} from 'mongoose';
import { Story } from '../../story/entities/story.entity.js';
import { Script, ScriptSchema } from './script.entity.js';

@Schema({ timestamps: true })
export class Chapter {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Story.name,
    required: true,
  })
  storyId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title: string;

  // starts at 0 and should always match the chapter's spot in story.chapterOrder
  @Prop({ required: true, min: 0 })
  order: number;

  // null until a script gets saved with PUT .../script
  @Prop({ type: ScriptSchema, default: null })
  script: Script | null;

  createdAt: Date;
  updatedAt: Date;
}

export type ChapterDocument = HydratedDocument<Chapter>;
export const ChapterSchema = SchemaFactory.createForClass(Chapter);

// for loading a story's chapters in order
ChapterSchema.index({ storyId: 1, order: 1 });

ChapterSchema.set('toJSON', { versionKey: false });
