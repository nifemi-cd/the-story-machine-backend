import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from '../../user/dto/create-user.dto.js';

// just the email, with the same trim and lowercase as sign up
export class ForgotPasswordDto extends PickType(CreateUserDto, [
  'email',
] as const) {}
