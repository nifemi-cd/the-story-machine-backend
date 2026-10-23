import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// trim first so a name that's only spaces fails IsNotEmpty
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// portrait_x and portrait_y aren't used yet, so they're only allowed as null
export class EmotionDto {
  @ApiProperty({ example: 'angry', maxLength: 50 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  emotion: string;

  @ApiPropertyOptional({
    description: 'Not used yet; must be null',
    type: Number,
    nullable: true,
    example: null,
  })
  // IsOptional lets null through, anything else gets caught by Equals(null)
  @IsOptional()
  @Equals(null)
  portrait_x?: null;

  @ApiPropertyOptional({
    description: 'Not used yet; must be null',
    type: Number,
    nullable: true,
    example: null,
  })
  @IsOptional()
  @Equals(null)
  portrait_y?: null;
}

export class CharacterDto {
  @ApiProperty({
    description: 'Unique within the story; dialogue lines use it as `name`',
    example: 'Dave',
    maxLength: 50,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: null,
    maxLength: 500,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Emotion names must be unique; "default" is always added',
    type: [EmotionDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique((emotion: EmotionDto) => emotion.emotion, {
    message: 'emotions must have unique names',
  })
  // without @Type the nested emotions are plain objects and their rules never run
  @ValidateNested({ each: true })
  @Type(() => EmotionDto)
  emotions?: EmotionDto[];
}
