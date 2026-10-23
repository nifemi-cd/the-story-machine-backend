import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

// trim first so " a@b.com " still passes
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// the @ApiProperty ones are just for swagger, the class-validator ones
// underneath are what actually validate
export class CreateUserDto {
  // lowercased so you can't sign up twice with the same email in different case
  @ApiProperty({
    description: 'Trimmed and lowercased before saving',
    example: 'ada.reader@example.com',
    format: 'email',
    maxLength: 254,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description:
      'Letters, numbers and underscores. Must be unique, ignoring letter case.',
    example: 'ada_writes',
    pattern: '^[a-zA-Z0-9_]{3,30}$',
    minLength: 3,
    maxLength: 30,
  })
  @Transform(trim)
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,30}$/, {
    message:
      'username must be 3-30 characters and contain only letters, numbers and underscores',
  })
  username: string;

  // plain password here, the service hashes it before saving
  @ApiProperty({
    description:
      'At least 8 characters (max 72 bytes) with an uppercase letter, a lowercase letter, a number and a symbol. Never returned.',
    example: 'Story!Time2026',
    format: 'password',
    minLength: 8,
  })
  @IsString()
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minLowercase: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  // bcrypt only looks at the first 72 bytes, and emojis etc take more than one byte each
  @IsByteLength(0, 72, { message: 'password must be at most 72 bytes' })
  password: string;

  // the service uses the username if this isn't sent
  @ApiPropertyOptional({
    description: 'Name shown on profiles. Defaults to the username.',
    example: 'Ada Lovelace',
    maxLength: 50,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Short "about me" text',
    example: 'I read mysteries and write branching sci-fi.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    description: "Link to the user's own site or social profile",
    example: 'https://example.com/ada',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl()
  profileUrl?: string;
}
