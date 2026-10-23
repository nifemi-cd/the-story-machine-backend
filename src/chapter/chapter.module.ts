import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChapterService } from './chapter.service.js';
import { ChapterController } from './chapter.controller.js';
import { Chapter, ChapterSchema } from './entities/chapter.entity.js';
import { StoryModule } from '../story/story.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Chapter.name, schema: ChapterSchema }]),
    // for StoryService
    StoryModule,
  ],
  controllers: [ChapterController],
  providers: [ChapterService],
})
export class ChapterModule {}
