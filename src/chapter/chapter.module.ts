import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChapterService } from './chapter.service.js';
import { ChapterController } from './chapter.controller.js';
import { Chapter, ChapterSchema } from './entities/chapter.entity.js';
import { StoryModule } from '../story/story.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { User, UserSchema } from '../user/entities/user.entity.js';

@Module({
  imports: [
    // User is only here for JwtAuthGuard, which looks up the logged in user
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // for StoryService
    StoryModule,
    // for JwtAuthGuard, changing chapters needs a login
    AuthModule,
  ],
  controllers: [ChapterController],
  providers: [ChapterService],
})
export class ChapterModule {}
