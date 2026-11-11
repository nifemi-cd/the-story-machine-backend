import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Model, isValidObjectId } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception.js';
import { User, type UserDocument } from '../../user/entities/user.entity.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

// the request after the guard has run, @CurrentUser() reads user from here
export interface AuthenticatedRequest extends Request {
  user: UserDocument;
}

// Lets a request through only if it has a valid login token.
// usage @UseGuards(JwtAuthGuard) on a route or a whole controller
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  // returns true and attaches the user to the request, or throws a 401
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.tokenFrom(request);
    if (!token) {
      throw AppException.unauthorized('Login required');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      // expired, wrong signature or not a token at all, the client doesn't
      // need to know which
      throw AppException.unauthorized('Login has expired, please log in again');
    }

    const user = isValidObjectId(payload.sub)
      ? await this.userModel.findById(payload.sub).exec()
      : null;
    // a token made before the last password reset has an old tokenVersion
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw AppException.unauthorized('Login has expired, please log in again');
    }

    request.user = user;
    return true;
  }

  // returns the token from "Authorization: Bearer <token>", or undefined
  private tokenFrom(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
