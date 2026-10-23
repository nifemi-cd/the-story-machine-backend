import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateChapterDto } from './create-chapter.dto.js';

// the script has its own route (PUT .../script) so it's left out here
export class UpdateChapterDto extends PartialType(
  OmitType(CreateChapterDto, ['story'] as const),
) {}
