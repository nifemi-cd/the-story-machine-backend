import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ChapterController } from './chapter.controller.js';
import { ChapterService } from './chapter.service.js';
import { Chapter } from './entities/chapter.entity.js';
import { StoryService } from '../story/story.service.js';

describe('ChapterController', () => {
  let controller: ChapterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChapterController],
      providers: [
        ChapterService,
        { provide: getModelToken(Chapter.name), useValue: {} },
        { provide: StoryService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ChapterController>(ChapterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
