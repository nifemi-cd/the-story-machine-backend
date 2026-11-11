import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { AppException } from '../common/exceptions/app.exception.js';
import { User } from '../user/entities/user.entity.js';
import {
  AuthService,
  hashResetToken,
  RESET_TOKEN_TTL_MS,
} from './auth.service.js';
import { MailService, type MailMessage } from '../mail/mail.service.js';

const password = 'Str0ng!Pass';
// low salt rounds so the tests stay fast, compare() works the same
const passwordHash = bcrypt.hashSync(password, 4);

describe('AuthService', () => {
  let service: AuthService;
  const user = {
    _id: new Types.ObjectId(),
    email: 'reader@example.com',
    passwordHash,
    tokenVersion: 3,
  };
  // findOne().select().exec() is chained so each step returns the same mock
  const findQuery = { select: vi.fn(() => findQuery), exec: vi.fn() };
  const userModel = {
    findOne: vi.fn(() => findQuery),
    findOneAndUpdate: vi.fn(),
  };
  const jwtService = { signAsync: vi.fn() };
  const mailService = { send: vi.fn() };
  const config = new Map<string, string>();

  // returns the email that was sent and the token from its link
  function sentEmail() {
    const message = mailService.send.mock.calls[0][0] as MailMessage;
    const token = /\?token=([0-9a-f]+)/.exec(message.text)?.[1];
    return { message, token };
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    config.clear();
    config.set('PASSWORD_RESET_URL', 'https://app.test/reset');
    findQuery.exec.mockResolvedValue(user);
    jwtService.signAsync.mockResolvedValue('signed-token');
    userModel.findOneAndUpdate.mockReturnValue({
      exec: () => Promise.resolve(user),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => config.get(k) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('returns a token with the user id and token version', async () => {
      const result = await service.login({ email: user.email, password });

      expect(result).toEqual({
        accessToken: 'signed-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user,
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user._id.toString(),
        tokenVersion: 3,
      });
    });

    it('asks for the password hash since it is not selected by default', async () => {
      await service.login({ email: user.email, password });

      expect(userModel.findOne).toHaveBeenCalledWith({ email: user.email });
      expect(findQuery.select).toHaveBeenCalledWith('+passwordHash');
    });

    async function expectInvalidLogin(promise: Promise<unknown>) {
      const error = await promise.catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(401);
      expect((error as AppException).message).toBe('Invalid email or password');
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    }

    it('rejects a wrong password with a 401', async () => {
      await expectInvalidLogin(
        service.login({ email: user.email, password: 'Wr0ng!Pass' }),
      );
    });

    it('rejects an unknown email with the same 401', async () => {
      findQuery.exec.mockResolvedValue(null);

      await expectInvalidLogin(
        service.login({ email: 'nobody@example.com', password }),
      );
    });
  });

  describe('forgotPassword', () => {
    it('saves only the hash of the token, with an expiry', async () => {
      const before = Date.now();
      await service.forgotPassword(user.email);

      const [filter, update] = userModel.findOneAndUpdate.mock.calls[0] as [
        object,
        { passwordResetTokenHash: string; passwordResetExpiresAt: Date },
      ];
      const { token } = sentEmail();

      expect(filter).toEqual({ email: user.email });
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(update.passwordResetTokenHash).toBe(hashResetToken(token!));
      expect(update.passwordResetTokenHash).not.toBe(token);
      expect(update.passwordResetExpiresAt.getTime()).toBeGreaterThanOrEqual(
        before + RESET_TOKEN_TTL_MS,
      );
    });

    it('emails the user a link to the reset page', async () => {
      await service.forgotPassword(user.email);

      const { message, token } = sentEmail();
      expect(message.to).toBe(user.email);
      expect(message.subject).toBe('Reset your Story Machine password');
      expect(message.text).toContain(`https://app.test/reset?token=${token}`);
    });

    it('does nothing and does not throw for an unknown email', async () => {
      userModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(null),
      });

      await expect(
        service.forgotPassword('nobody@example.com'),
      ).resolves.toBeUndefined();
      expect(mailService.send).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const token = 'a'.repeat(64);
    const newPassword = 'N3w!Password';

    it('saves a hashed password, clears the token and logs out everywhere', async () => {
      await service.resetPassword({ token, password: newPassword });

      const [filter, update] = userModel.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        {
          $set: { passwordHash: string };
          $unset: object;
          $inc: object;
        },
      ];
      expect(filter).toEqual({
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: { $gt: expect.any(Date) },
      });
      expect(update.$unset).toEqual({
        passwordResetTokenHash: 1,
        passwordResetExpiresAt: 1,
      });
      expect(update.$inc).toEqual({ tokenVersion: 1 });
      await expect(
        bcrypt.compare(newPassword, update.$set.passwordHash),
      ).resolves.toBe(true);
    });

    it('rejects a token that is wrong, used or expired with a 400', async () => {
      userModel.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(null),
      });

      const error = await service
        .resetPassword({ token, password: newPassword })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(400);
      expect((error as AppException).message).toBe(
        'Reset link is invalid or has expired',
      );
    });
  });
});
