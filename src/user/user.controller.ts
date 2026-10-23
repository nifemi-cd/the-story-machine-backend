import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { ResponseMessage } from '../common/decorators/response-message.decorator.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import {
  ApiEnvelope,
  ApiError,
} from '../common/swagger/api-response.decorators.js';
import { ApiObjectIdParam } from '../common/swagger/api-param.decorators.js';

@ApiTags('Users')
@Controller({ path: 'user', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  // signs up a new user and returns them
  @Post()
  @ResponseMessage('User created')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates an account with the "user" role. The password is hashed and never returned.',
  })
  @ApiEnvelope(UserResponseDto, { status: 201, description: 'User created' })
  @ApiError(400, 'A field failed validation, or an unknown field was sent')
  @ApiError(409, 'Email or username already taken')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  // returns one page of users
  @Get()
  @ResponseMessage('Users fetched')
  @ApiOperation({ summary: 'List users', description: 'Newest users first.' })
  @ApiEnvelope(UserResponseDto, {
    description: 'Users fetched',
    paginated: true,
  })
  @ApiError(400, 'page or limit is not a whole number in range')
  findAll(@Query() query: PaginationQueryDto) {
    return this.userService.findAll(query);
  }

  // returns one user
  @Get(':id')
  @ResponseMessage('User fetched')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiObjectIdParam('User')
  @ApiEnvelope(UserResponseDto, { description: 'User fetched' })
  @ApiError(400, 'The id is not a valid 24-character hex string')
  @ApiError(404, 'User not found')
  findOne(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.userService.findOne(id);
  }

  // updates a user's profile and returns the updated user
  @Patch(':id')
  @ResponseMessage('User updated')
  @ApiOperation({
    summary: "Update a user's profile",
    description:
      'Send only the fields to change. Email and password cannot be changed here.',
  })
  @ApiObjectIdParam('User')
  @ApiEnvelope(UserResponseDto, { description: 'User updated' })
  @ApiError(
    400,
    'Invalid id, a field failed validation, or email/password was sent',
  )
  @ApiError(404, 'User not found')
  @ApiError(409, 'Username already taken by another user')
  update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }
}
