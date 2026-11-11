import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { UserDocument } from '../user/entities/user.entity.js';

// chapters are always reached through their story, hence the nested url
// anyone can read chapters, but only the story's author can change them
@ApiTags('Chapters')
@ApiObjectIdParam('Story', 'storyId')
@Controller({ path: 'story/:storyId/chapter', version: '1' })
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  // adds a chapter to the story and returns it, author only
  @Post()
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Chapter created')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add a chapter',
    description:
      "Adds the chapter to the end of the story's chapterOrder. Send its script as story now, or later through PUT .../script; it is checked the same way. Only the story's author can do this.",
  })
  @ApiEnvelope(ChapterResponseDto, {
    status: 201,
    description: 'Chapter created',
  })
  @ApiError(
    400,
    'Invalid storyId, a field failed validation, or the script is invalid',
  )
  @ApiError(401, 'Login required')
  @ApiError(403, 'Only the author can change this story')
  @ApiError(404, 'Story not found')
  create(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @CurrentUser() user: UserDocument,
    @Body() createChapterDto: CreateChapterDto,
  ) {
    return this.chapterService.create(storyId, user, createChapterDto);
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

  // renames a chapter and returns the updated chapter, author only
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Chapter updated')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a chapter',
    description:
      "Send only the fields to change. Only the story's author can do this.",
  })
  @ApiObjectIdParam('Chapter')
  @ApiEnvelope(ChapterResponseDto, { description: 'Chapter updated' })
  @ApiError(400, 'Invalid storyId or id, or a field failed validation')
  @ApiError(401, 'Login required')
  @ApiError(403, 'Only the author can change this story')
  @ApiError(404, 'Story not found, or chapter not found in this story')
  update(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: UserDocument,
    @Body() updateChapterDto: UpdateChapterDto,
  ) {
    return this.chapterService.update(storyId, id, user, updateChapterDto);
  }

  // deletes a chapter, returns nothing. author only
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Chapter deleted')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a chapter',
    description:
      "Permanently deletes the chapter and removes it from the story's chapterOrder; later chapters move up one place. This cannot be undone. Only the story's author can do this.",
  })
  @ApiObjectIdParam('Chapter')
  @ApiEnvelope(null, { description: 'Chapter deleted' })
  @ApiError(400, 'Invalid storyId or id')
  @ApiError(401, 'Login required')
  @ApiError(403, 'Only the author can change this story')
  @ApiError(404, 'Story not found, or chapter not found in this story')
  remove(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: UserDocument,
  ) {
    return this.chapterService.remove(storyId, id, user);
  }

  // saves the chapter's script and returns the updated chapter, author only
  @Put(':id/script')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Script saved')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Save a chapter's script",
    description:
      'Replaces the whole script with the JSON the frontend parser produced. ' +
      "Besides its shape, the script is checked against the story: line ids match positions, every goto_line and flag points to a real line, and dialogue uses the story's characters and their emotions. Only the story's author can do this.",
  })
  @ApiObjectIdParam('Chapter')
  @ApiEnvelope(ChapterResponseDto, { description: 'Script saved' })
  @ApiError(400, 'Invalid storyId or id, or the script is invalid')
  @ApiError(401, 'Login required')
  @ApiError(403, 'Only the author can change this story')
  @ApiError(404, 'Story not found, or chapter not found in this story')
  saveScript(
    @Param('storyId', ParseObjectIdPipe) storyId: Types.ObjectId,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: UserDocument,
    @Body() scriptDto: ScriptDto,
  ) {
    return this.chapterService.saveScript(storyId, id, user, scriptDto);
  }
}
