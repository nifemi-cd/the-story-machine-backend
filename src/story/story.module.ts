import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoryService } from './story.service.js';
import { StoryController } from './story.controller.js';
import { Story, StorySchema } from './entities/story.entity.js';
import { User, UserSchema } from '../user/entities/user.entity.js';
import { Chapter, ChapterSchema } from '../chapter/entities/chapter.entity.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    // User is needed to check the author exists, Chapter so deleting a
    // story can delete its chapters too
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: User.name, schema: UserSchema },
      { name: Chapter.name, schema: ChapterSchema },
    ]),
    StorageModule,
  ],
  controllers: [StoryController],
  providers: [StoryService],
  // ChapterService uses it to keep chapterOrder up to date
  exports: [StoryService],
})
export class StoryModule {}
