import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/exceptions/app.exception.js';
import type { UserRole } from '../../user/enums/user-role.enum.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

// Lets a request through only if the user has one of the roles from @Roles().
// Has to come after JwtAuthGuard since it needs the user that guard attaches,
// usage @UseGuards(JwtAuthGuard, RolesGuard)
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // returns true if the user has a matching role, or throws a 403
  canActivate(context: ExecutionContext): boolean {
    // the route's @Roles() wins over the controller's if both are set
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    // no @Roles() means any logged in user is fine
    if (!roles?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user?.roles?.some((role) => roles.includes(role))) {
      throw AppException.forbidden('You do not have permission to do this');
    }
    return true;
  }
}
