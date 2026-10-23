import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CharacterDto } from './character.dto.js';

// trim first so a title that's only spaces fails IsNotEmpty
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// new stories always start as an empty draft, chapters get added separately
export class CreateStoryDto {
  // TODO take this from the logged in user once auth is done
  @ApiProperty({
    description:
      'Id of the user writing the story. Will come from the login session once auth exists.',
    example: '6ad4306d3168a59d2918aead',
  })
  @IsMongoId()
  authorId: string;

  @ApiProperty({ example: 'The Lighthouse Keeper', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({
    description: 'Blurb shown on the story card',
    example: 'A storm, a stranger, and three doors you should not open.',
    maxLength: 2000,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Everyone who speaks in the story. On PATCH the whole list is replaced.',
    type: [CharacterDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((character: CharacterDto) => character.name, {
    message: 'characters must have unique names',
  })
  // without @Type the nested characters are plain objects and their rules never run
  @ValidateNested({ each: true })
  @Type(() => CharacterDto)
  characters?: CharacterDto[];
}
