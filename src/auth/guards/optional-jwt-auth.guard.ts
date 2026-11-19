import { Injectable, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// For routes anyone can use but that show more to logged in users.
// No Authorization header means the request goes through with no user.
// If a header is sent it has to be valid though, otherwise someone whose
// login expired would quietly get the logged out version and not know why.
// usage @UseGuards(OptionalJwtAuthGuard), then @CurrentUser() user?: UserDocument
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  // returns true, attaching the user if a token was sent, or throws a 401
  // if the token is bad
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.headers.authorization) {
      return true;
    }
    return super.canActivate(context);
  }
}
