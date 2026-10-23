import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';

// email and password are left out on purpose, changing those should be its
// own flow later (verifying the new email, hashing the password etc)
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password'] as const),
) {}
