import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// These only check the shape of the script the frontend parser sends.
// Anything that needs the whole script or the story (like a goto_line
// pointing at a real line) is checked in check-script.ts instead.

export class ScriptTextDto {
  @ApiProperty({ type: [String], example: ['We', 'made', 'it.'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  words: string[];
}

export class DialogueLineDto {
  @ApiProperty({ description: 'One of the story characters', example: 'Dave' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'One of that character\'s emotions; "default" if left out',
    example: 'happy',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  portrait?: string;

  @ApiProperty({ type: ScriptTextDto })
  @ValidateNested()
  @Type(() => ScriptTextDto)
  text: ScriptTextDto;

  @ApiPropertyOptional({
    description: 'Not used yet; must be null',
    type: String,
    nullable: true,
    example: null,
  })
  // IsOptional lets null through, anything else gets caught by Equals(null)
  @IsOptional()
  @Equals(null)
  text_color?: null;
}

export class ProseLineDto {
  @ApiProperty({ type: ScriptTextDto })
  @ValidateNested()
  @Type(() => ScriptTextDto)
  text: ScriptTextDto;

  @ApiPropertyOptional({
    description: 'Not used yet; must be null',
    type: String,
    nullable: true,
    example: null,
  })
  @IsOptional()
  @Equals(null)
  text_color?: null;
}

export class ChoiceOptionDto {
  @ApiProperty({ description: 'line_id to jump to', example: 8 })
  @IsInt()
  @Min(0)
  goto_line: number;

  @ApiProperty({ example: 'Open the door', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  option_body: string;

  @ApiPropertyOptional({
    description: 'Not used yet; must be null',
    // swagger can't work out a type from null so we have to give it one
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: null,
  })
  @IsOptional()
  @Equals(null)
  condition?: null;
}

// each line should only have one of these set, check-script.ts enforces that
export class ScriptLineDto {
  @ApiProperty({ description: 'Position in lines, from 0', example: 0 })
  @IsInt()
  @Min(0)
  line_id: number;

  @ApiPropertyOptional({ type: DialogueLineDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DialogueLineDto)
  dialogue?: DialogueLineDto;

  @ApiPropertyOptional({ type: ProseLineDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProseLineDto)
  prose?: ProseLineDto;

  @ApiPropertyOptional({ type: [ChoiceOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChoiceOptionDto)
  choice?: ChoiceOptionDto[];

  @ApiPropertyOptional({
    description: 'Image to switch the background to',
    example: 'cabin-door.jpg',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  background?: string;

  @ApiPropertyOptional({ description: 'line_id to jump to', example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goto_line?: number;

  @ApiPropertyOptional({ description: 'Always true when set', example: true })
  @IsOptional()
  @Equals(true)
  end?: true;
}

// the "story" object from the story JSON contract
export class ScriptDto {
  @ApiPropertyOptional({
    description: 'Bookmarks: flag name to the line it marks',
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: { line_id: { type: 'integer', example: 15 } },
      required: ['line_id'],
    },
    example: { Morning: { line_id: 15 } },
  })
  // flag names can be anything so the decorators can't check them, check-script.ts does
  @IsOptional()
  @IsObject()
  flags?: Record<string, { line_id: number }>;

  @ApiPropertyOptional({
    description: 'Not used yet; must be empty',
    type: 'array',
    items: {},
    example: [],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(0)
  variables?: [];

  @ApiProperty({ type: [ScriptLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => ScriptLineDto)
  lines: ScriptLineDto[];
}
