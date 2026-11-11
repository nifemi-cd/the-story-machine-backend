import type { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception.js';
import type { User } from '../../user/entities/user.entity.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const user = { _id: new Types.ObjectId(), tokenVersion: 2 };
  const payload = { sub: user._id.toString(), tokenVersion: 2 };
  const jwtService = { verifyAsync: vi.fn() };
  const userModel = { findById: vi.fn() };
  const guard = new JwtAuthGuard(
    jwtService as unknown as JwtService,
    userModel as unknown as Model<User>,
  );

  // returns a fake context for a request with these headers, plus the request
  function contextWith(headers: Record<string, string>) {
    const request: Record<string, unknown> = { headers };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    jwtService.verifyAsync.mockResolvedValue(payload);
    userModel.findById.mockReturnValue({ exec: () => Promise.resolve(user) });
  });

  async function expectUnauthorized(headers: Record<string, string>) {
    const { context } = contextWith(headers);
    const error = await guard.canActivate(context).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(401);
  }

  it('lets a valid token through and attaches the user', async () => {
    const { context, request } = contextWith({
      authorization: 'Bearer good-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('good-token');
    expect(request.user).toBe(user);
  });

  it.each([
    ['no header', {}],
    ['a header that is not Bearer', { authorization: 'Basic abc' }],
    ['Bearer with no token', { authorization: 'Bearer ' }],
  ])('rejects %s', async (_label, headers) => {
    await expectUnauthorized(headers);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a token that fails verification', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expectUnauthorized({ authorization: 'Bearer old-token' });
  });

  it('rejects a token for a user that no longer exists', async () => {
    userModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });

    await expectUnauthorized({ authorization: 'Bearer good-token' });
  });

  it('rejects a token whose sub is not a valid id', async () => {
    jwtService.verifyAsync.mockResolvedValue({ ...payload, sub: 'nope' });

    await expectUnauthorized({ authorization: 'Bearer good-token' });
    expect(userModel.findById).not.toHaveBeenCalled();
  });

  it('rejects a token made before the last password reset', async () => {
    jwtService.verifyAsync.mockResolvedValue({ ...payload, tokenVersion: 1 });

    await expectUnauthorized({ authorization: 'Bearer good-token' });
  });
});
