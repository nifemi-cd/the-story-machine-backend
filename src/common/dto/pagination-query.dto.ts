import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// so nobody can ask for 10000 items at once and slow the db down
export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  // query params always come in as strings, @Type turns them into numbers
  @ApiPropertyOptional({
    description: 'Page number, starting at 1',
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = 20;
}
