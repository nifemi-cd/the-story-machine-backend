import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/jwt-auth.guard.js';

// returns the logged in user that JwtAuthGuard attached to the request
// only works on routes that use JwtAuthGuard
// usage me(@CurrentUser() user: UserDocument)
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
