import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../common/decorators/response-message.decorator.js';
import {
  ApiEnvelope,
  ApiError,
} from '../common/swagger/api-response.decorators.js';
import { UserResponseDto } from '../user/dto/user-response.dto.js';
import type { UserDocument } from '../user/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // logs a user in and returns their token
  // 200 instead of nest's default 201 for POST since nothing gets created
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged in')
  @ApiOperation({
    summary: 'Log in',
    description:
      'Checks the email and password and returns a token to send as "Authorization: Bearer <accessToken>".',
  })
  @ApiEnvelope(LoginResponseDto, { description: 'Logged in' })
  @ApiError(400, 'A field failed validation, or an unknown field was sent')
  @ApiError(401, 'Invalid email or password')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // sends a reset link if the email is registered
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('If that email is registered, a reset link has been sent')
  @ApiOperation({
    summary: 'Ask for a password reset link',
    description:
      'Always gives the same reply, whether or not the email is registered. The link works for 30 minutes and asking again replaces the old one.',
  })
  @ApiEnvelope(null, {
    description: 'If that email is registered, a reset link has been sent',
  })
  @ApiError(400, 'The email is not valid')
  async forgotPassword(@Body() { email }: ForgotPasswordDto) {
    await this.authService.forgotPassword(email);
    return null;
  }

  // sets a new password using the token from the reset link
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password has been reset')
  @ApiOperation({
    summary: 'Reset a password',
    description:
      'Sets a new password using the token from the reset link. The token only works once, and every existing login token stops working.',
  })
  @ApiEnvelope(null, { description: 'Password has been reset' })
  @ApiError(
    400,
    'Reset link is invalid or has expired, or the new password is too weak',
  )
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto);
    return null;
  }

  // returns the logged in user
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('User fetched')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the logged in user' })
  @ApiEnvelope(UserResponseDto, { description: 'User fetched' })
  @ApiError(401, 'Login required')
  me(@CurrentUser() user: UserDocument) {
    return user;
  }
}
