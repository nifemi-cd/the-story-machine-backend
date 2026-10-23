import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { StoryStatus } from '../enums/story-status.enum.js';

// ?status=published for the reader feed, ?authorId=... for one author's stories
export class ListStoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Only this user's stories",
    example: '6ad4306d3168a59d2918aead',
  })
  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @ApiPropertyOptional({ enum: StoryStatus, enumName: 'StoryStatus' })
  @IsOptional()
  @IsEnum(StoryStatus)
  status?: StoryStatus;
}
