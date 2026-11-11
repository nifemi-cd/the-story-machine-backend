import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/entities/user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { getJwtExpiresIn } from './jwt.config.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // getOrThrow so the server won't start without a secret instead of
        // signing tokens with undefined
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: getJwtExpiresIn(configService) },
      }),
    }),
    // sends the password reset email
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  // other modules import AuthModule to protect their routes with
  // JwtAuthGuard and RolesGuard
  exports: [JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
