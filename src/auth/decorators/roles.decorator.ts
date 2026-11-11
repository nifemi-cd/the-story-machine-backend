import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../user/enums/user-role.enum.js';

export const ROLES_KEY = 'roles';

// sets which roles can use a route, RolesGuard reads it
// the user needs at least one of them
// usage @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.Admin)
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
