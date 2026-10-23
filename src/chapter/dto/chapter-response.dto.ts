import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  OmitType,
} from '@nestjs/swagger';
import { CharacterResponseDto } from '../../story/dto/story-response.dto.js';
import { ScriptDto } from './script.dto.js';

// only for the swagger docs. snake_case because it follows the story JSON contract
@ApiExtraModels(CharacterResponseDto)
export class ChapterResponseDto {
  @ApiProperty({
    description: "The story's title",
    example: 'The Lion at the Door',
  })
  title: string;

  @ApiProperty({
    description: "The story author's username",
    example: 'mock-author',
  })
  author: string;

  @ApiProperty({ example: '6650f1c2a1b2c3d4e5f60718' })
  story_id: string;

  @ApiProperty({
    description: 'Use it in /story/:storyId/chapter/:id',
    example: '6650f1c2a1b2c3d4e5f60719',
  })
  chapter_id: string;

  @ApiProperty({ example: 'Chapter 1' })
  chapter_name: string;

  @ApiProperty({
    description: "The story's characters, keyed by name",
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(CharacterResponseDto) },
  })
  characters: Record<string, CharacterResponseDto>;

  @ApiProperty({
    description:
      "The chapter's script. Empty (no lines) until one has been saved.",
    type: ScriptDto,
  })
  story: ScriptDto;
}

// the list route leaves out the script and characters
export class ChapterSummaryResponseDto extends OmitType(ChapterResponseDto, [
  'characters',
  'story',
] as const) {}
