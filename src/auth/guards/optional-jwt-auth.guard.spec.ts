import type { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception.js';
import type { User } from '../../user/entities/user.entity.js';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard.js';

describe('OptionalJwtAuthGuard', () => {
  const user = { _id: new Types.ObjectId(), tokenVersion: 0 };
  const payload = { sub: user._id.toString(), tokenVersion: 0 };
  const jwtService = { verifyAsync: vi.fn() };
  const userModel = { findById: vi.fn() };
  const guard = new OptionalJwtAuthGuard(
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

  it('lets a request with no token through without a user', async () => {
    const { context, request } = contextWith({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('attaches the user when a valid token is sent', async () => {
    const { context, request } = contextWith({
      authorization: 'Bearer good-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(user);
  });

  it.each([
    ['an expired or invalid token', 'Bearer old-token'],
    ['a header that is not Bearer', 'Basic abc'],
  ])('still rejects %s with a 401', async (_label, authorization) => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { context } = contextWith({ authorization });

    const error = await guard.canActivate(context).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(401);
  });
});
