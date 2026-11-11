import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsHexadecimal, Length } from 'class-validator';
import { CreateUserDto } from '../../user/dto/create-user.dto.js';

// the new password comes from CreateUserDto so it has to pass the same
// strength and 72 byte rules as when signing up
export class ResetPasswordDto extends PickType(CreateUserDto, [
  'password',
] as const) {
  // 32 random bytes as hex, see AuthService.forgotPassword
  @ApiProperty({
    description: 'The token from the password reset link',
    example: '9f2c4e7a1b3d5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8',
    minLength: 64,
    maxLength: 64,
  })
  @IsHexadecimal()
  @Length(64, 64)
  token: string;
}
