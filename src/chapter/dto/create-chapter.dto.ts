import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ScriptDto } from './script.dto.js';

// Uses the contract's field names. The rest of the contract fields don't
// come from the client, story_id is in the url and title/author come from the story.
export class CreateChapterDto {
  @ApiProperty({ example: 'Chapter 1', maxLength: 120 })
  // trim first so a name that's only spaces fails IsNotEmpty
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  chapter_name: string;

  @ApiPropertyOptional({
    description:
      "The chapter's parsed script. Checked the same way as PUT .../script; can be left out and saved later.",
    type: ScriptDto,
  })
  @IsOptional()
  // needed so the nested script actually gets validated
  @ValidateNested()
  @Type(() => ScriptDto)
  story?: ScriptDto;
}
