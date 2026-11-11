import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/exceptions/app.exception.js';
import { UserRole } from '../../user/enums/user-role.enum.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  // returns a fake context for a request made by a user with these roles
  function contextFor(roles?: UserRole[]) {
    const request = { user: roles ? { roles } : undefined };
    return {
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue([UserRole.Admin]);
  });

  it('lets an admin through', () => {
    expect(guard.canActivate(contextFor([UserRole.User, UserRole.Admin]))).toBe(
      true,
    );
  });

  it('reads the roles from the route first, then the controller', () => {
    guard.canActivate(contextFor([UserRole.Admin]));

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [
      'handler',
      'class',
    ]);
  });

  it.each([
    ['a user without the role', [UserRole.User]],
    ['a request with no user', undefined],
  ])('rejects %s with a 403', (_label, roles) => {
    let error: unknown;
    try {
      guard.canActivate(contextFor(roles));
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(403);
  });

  it('lets anyone through when the route has no @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextFor([UserRole.User]))).toBe(true);
  });
});
