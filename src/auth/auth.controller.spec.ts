import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../user/entities/user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        // JwtAuthGuard on /me needs these
        { provide: JwtService, useValue: {} },
        { provide: getModelToken(User.name), useValue: {} },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // the message says what happened, data is always null
  it('returns null from forgot-password and reset-password', async () => {
    await expect(
      controller.forgotPassword({ email: 'reader@example.com' }),
    ).resolves.toBeNull();
    await expect(
      controller.resetPassword({ token: 'a'.repeat(64), password: 'x' }),
    ).resolves.toBeNull();
  });

  it('returns the user the guard attached', () => {
    const user = { username: 'Reader_1' };

    expect(controller.me(user as never)).toBe(user);
  });
});
