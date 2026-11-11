import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StoryStatus } from '../enums/story-status.enum.js';
import { CreateStoryDto } from './create-story.dto.js';

// same rules as create but everything is optional. there's no authorId in
// CreateStoryDto, so a story can't be moved to someone else
export class UpdateStoryDto extends PartialType(CreateStoryDto) {
  @ApiPropertyOptional({ enum: StoryStatus, enumName: 'StoryStatus' })
  @IsOptional()
  @IsEnum(StoryStatus)
  status?: StoryStatus;
}
