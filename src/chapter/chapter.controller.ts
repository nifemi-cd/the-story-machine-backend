import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ChapterService } from './chapter.service.js';
import { CreateChapterDto } from './dto/create-chapter.dto.js';
import { UpdateChapterDto } from './dto/update-chapter.dto.js';
import {
  ChapterResponseDto,
  ChapterSummaryResponseDto,
} from './dto/chapter-response.dto.js';
import { ScriptDto } from './dto/script.dto.js';
import { ResponseMessage } from '../common/decorators/response-message.decorator.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import {
  ApiEnvelope,
  ApiError,
} from '../common/swagger/api-response.decorators.js';
import { ApiObjectIdParam } from '../common/swagger/api-param.decorators.js';

// chapters are always reached through their story, hence the nested url
@ApiTags('Chapters')
@ApiObjectIdParam('Story', 'storyId')
@Controller({ path: 'story/:storyId/chapter', version: '1' })
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  // adds a chapter to the story and returns it
  @Post()
  @ResponseMessage('Chapter created')
  @ApiOperation({
    summary: 'Add a chapter',
    description:
      "Adds the chapter to the end of the story's chapterOrder. Send its script as story now, or later through PUT .../script; it is checked the same way.",
  })
  @ApiEnvelope(ChapterResponseDto, {
    status: 201,
    description: 'Chapter created',
  })
  @ApiError(
    400,
    'Invalid storyId, a field failed validation, or the script is invalid',
  )
  @ApiError(404, 'Story not found')
  create(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @Body() createChapterDto: CreateChapterDto,
  ) {
    return this.chapterService.create(storyId, createChapterDto);
  }

  // returns all of the story's chapters in order
  @Get()
  @ResponseMessage('Chapters fetched')
  @ApiOperation({
    summary: "List a story's chapters",
    description:
      "In reading order. Each chapter's story and the characters are left out; get a single chapter for those.",
  })
  @ApiEnvelope(ChapterSummaryResponseDto, {
    description: 'Chapters fetched',
    isArray: true,
  })
  @ApiError(400, 'Invalid storyId')
  @ApiError(404, 'Story not found')
  findAll(@Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId) {
    return this.chapterService.findAll(storyId);
  }

  // returns one chapter with its script and characters
  @Get(':id')
  @ResponseMessage('Chapter fetched')
  @ApiOperation({
    summary: 'Get a chapter by id',
    description:
      "The story JSON contract: the story's title, author and characters around this chapter's script.",
  })
  @ApiObjectIdParam('Chapter')
  @ApiEnvelope(ChapterResponseDto, { description: 'Chapter fetched' })
  @ApiError(400, 'Invalid storyId or id')
  @ApiError(404, 'Chapter not found in this story')
  findOne(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ) {
    return this.chapterService.findOne(storyId, id);
  }

  // renames a chapter and returns the updated chapter
  @Patch(':id')
  @ResponseMessage('Chapter updated')
  @ApiOperation({
    summary: 'Update a chapter',
    description: 'Send only the fields to change.',
  })
  @ApiObjectIdParam('Chapter')
  @ApiEnvelope(ChapterResponseDto, { description: 'Chapter updated' })
  @ApiError(400, 'Invalid storyId or id, or a field failed validation')
  @ApiError(404, 'Chapter not found in this story')
  update(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateChapterDto: UpdateChapterDto,
  ) {
    return this.chapterService.update(storyId, id, updateChapterDto);
  }

  // deletes a chapter, returns nothing
  @Delete(':id')
  @ResponseMessage('Chapter deleted')
  @ApiOperation({
    summary: 'Delete a chapter',
    description:
      "Permanently deletes the chapter and removes it from the story's chapterOrder; later chapters move up one place. This cannot be undone.",
  })
  @ApiObjectIdParam('Chapter')
  @ApiEnvelope(null, { description: 'Chapter deleted' })
  @ApiError(400, 'Invalid storyId or id')
  @ApiError(404, 'Chapter not found in this story')
  remove(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ) {
    return this.chapterService.remove(storyId, id);
  }

  // saves the chapter's script and returns the updated chapter
  @Put(':id/script')
  @ResponseMessage('Script saved')
  @ApiOperation({
    summary: "Save a chapter's script",
    description:
      'Replaces the whole script with the JSON the frontend parser produced. ' +
      "Besides its shape, the script is checked against the story: line ids match positions, every goto_line and flag points to a real line, and dialogue uses the story's characters and their emotions.",
  })
  @ApiObjectIdParam('Chapter')
  @ApiEnvelope(ChapterResponseDto, { description: 'Script saved' })
  @ApiError(400, 'Invalid storyId or id, or the script is invalid')
  @ApiError(404, 'Story not found, or chapter not found in this story')
  saveScript(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() scriptDto: ScriptDto,
  ) {
    return this.chapterService.saveScript(storyId, id, scriptDto);
  }
}
