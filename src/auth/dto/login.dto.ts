import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { CreateUserDto } from '../../user/dto/create-user.dto.js';

// email comes from CreateUserDto so it gets trimmed and lowercased the same
// way it was when the user signed up
export class LoginDto extends PickType(CreateUserDto, ['email'] as const) {
  // no strength rules here, those are for picking a password not typing one.
  // telling someone their password is "too weak" would also hint it's wrong
  @ApiProperty({ example: 'Story!Time2026', format: 'password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
