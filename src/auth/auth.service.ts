import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { AppException } from '../common/exceptions/app.exception.js';
import { User, type UserDocument } from '../user/entities/user.entity.js';
import { SALT_ROUNDS } from '../user/user.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { getJwtExpiresIn } from './jwt.config.js';
import { MailService } from '../mail/mail.service.js';

// how long a reset link works for (30 minutes)
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// where the reset link points if PASSWORD_RESET_URL isn't set
// (the frontend's reset page when running locally)
const DEFAULT_RESET_URL = 'http://localhost:4200/reset-password';

// the same message for a wrong email and a wrong password, otherwise
// anyone could check which emails have an account
const INVALID_LOGIN = 'Invalid email or password';

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserDocument;
}

// returns the sha256 of a reset token, which is what gets saved and searched for
// sha256 is fine here (unlike passwords) because the token is 32 random
// bytes, so there's nothing to guess
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly expiresIn: number;
  private readonly resetUrl: string;
  // see login(), only made the first time it's needed since hashing is slow
  private dummyHash?: Promise<string>;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    configService: ConfigService,
  ) {
    this.expiresIn = getJwtExpiresIn(configService);
    this.resetUrl =
      configService.get<string>('PASSWORD_RESET_URL') ?? DEFAULT_RESET_URL;
  }

  // checks the email and password and returns a login token plus the user
  async login({ email, password }: LoginDto): Promise<LoginResult> {
    // passwordHash is select false so it has to be asked for
    const user = await this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .exec();

    // still run bcrypt when there's no user so the response takes the same
    // time either way, otherwise a fast reply would give away that the
    // email isn't registered
    this.dummyHash ??= bcrypt.hash('not-a-real-password', SALT_ROUNDS);
    const matches = await bcrypt.compare(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !matches) {
      throw AppException.unauthorized(INVALID_LOGIN);
    }

    const payload: JwtPayload = {
      sub: user._id.toString(),
      tokenVersion: user.tokenVersion,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      user,
    };
  }

  // makes a reset token for the email and sends the link
  // does nothing when the email isn't registered, and the controller sends
  // the same reply either way so this can't be used to check emails
  async forgotPassword(email: string): Promise<void> {
    const token = randomBytes(32).toString('hex');

    // asking again replaces the old token, so only the newest link works
    const user = await this.userModel
      .findOneAndUpdate(
        { email },
        {
          passwordResetTokenHash: hashResetToken(token),
          passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      )
      .exec();

    if (user) {
      await this.mailService.send({
        to: user.email,
        subject: 'Reset your Story Machine password',
        text:
          `Use this link to choose a new password: ${this.resetUrl}?token=${token}\n\n` +
          `It stops working in 30 minutes. If you didn't ask for this, you can ignore this email.`,
      });
    }
  }

  // sets a new password if the reset token is valid and hasn't expired
  // also logs the user out everywhere, in case someone else had their password
  async resetPassword({ token, password }: ResetPasswordDto): Promise<void> {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // finding and updating in one step means the same token can't be used
    // twice, even by two requests at the same time
    const user = await this.userModel
      .findOneAndUpdate(
        {
          passwordResetTokenHash: hashResetToken(token),
          passwordResetExpiresAt: { $gt: new Date() },
        },
        {
          $set: { passwordHash },
          $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
          $inc: { tokenVersion: 1 },
        },
      )
      .exec();

    if (!user) {
      throw AppException.badRequest('Reset link is invalid or has expired');
    }
  }
}
