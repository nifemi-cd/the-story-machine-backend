import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StoryController } from './story.controller.js';
import { StoryService } from './story.service.js';
import { Story } from './entities/story.entity.js';
import { User } from '../user/entities/user.entity.js';
import { Chapter } from '../chapter/entities/chapter.entity.js';
import { StorageService } from '../storage/storage.service.js';

describe('StoryController', () => {
  let controller: StoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoryController],
      providers: [
        StoryService,
        { provide: getModelToken(Story.name), useValue: {} },
        { provide: getModelToken(User.name), useValue: {} },
        { provide: getModelToken(Chapter.name), useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    controller = module.get<StoryController>(StoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
