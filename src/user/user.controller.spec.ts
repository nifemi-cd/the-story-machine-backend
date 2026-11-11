import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller.js';
import { getModelToken } from '@nestjs/mongoose';
import { UserService } from './user.service.js';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity.js';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: {} },
        // JwtAuthGuard on the list and get routes needs it
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
