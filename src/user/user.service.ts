import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { AppException } from '../common/exceptions/app.exception.js';
import type { PaginatedResult } from '../common/interfaces/api-response.interface.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  User,
  USERNAME_COLLATION,
  type UserDocument,
} from './entities/user.entity.js';

// higher = slower to hash, which makes brute forcing passwords harder
const SALT_ROUNDS = 12;

// error code mongo gives when a unique index is broken
const DUPLICATE_KEY = 11000;

// returns true if mongo rejected the write because of a unique index
function isDuplicateKeyError(
  error: unknown,
): error is { code: number; keyPattern?: Record<string, unknown> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  // signs up a new user and returns them, the password gets hashed first
  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    // the DTO already trimmed these and lowercased the email
    const { password, ...profile } = createUserDto;

    await this.userNameOrEmailExist(profile.email, profile.username);

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      return await this.userModel.create({
        ...profile,
        displayName: profile.displayName ?? profile.username,
        passwordHash,
      });
    } catch (error) {
      // two sign ups at the same time can both pass the check above,
      // so the unique index is the real safety net
      if (isDuplicateKeyError(error)) {
        throw AppException.conflict(
          'Oppsss!! Email or Username has been taken',
        );
      }
      throw error;
    }
  }

  // returns one page of users, newest first, plus the pagination info
  async findAll({
    page,
    limit,
  }: PaginationQueryDto): Promise<PaginatedResult<UserDocument>> {
    const [items, total] = await Promise.all([
      this.userModel
        .find()
        // sorting by _id too so users with the same createdAt don't jump between pages
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments().exec(),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // returns one user or throws a 404
  async findOne(id: Types.ObjectId) {
    return await this.findUserById(id);
  }

  // updates the fields that were sent and returns the updated user
  // email and password aren't in UpdateUserDto so they can't be changed here
  async update(
    id: Types.ObjectId,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    if (updateUserDto.username) {
      await this.userNameExist(updateUserDto.username, id);
    }

    try {
      const user = await this.userModel
        .findByIdAndUpdate(id, updateUserDto, {
          returnDocument: 'after',
          // schema rules like maxlength don't run on updates unless we ask
          runValidators: true,
        })
        .exec();
      if (!user) {
        throw AppException.notfound('User not found');
      }
      return user;
    } catch (error) {
      // same race as in create
      if (isDuplicateKeyError(error)) {
        throw AppException.conflict('Username has been taken');
      }
      throw error;
    }
  }

  // returns the user or throws a 404
  private async findUserById(id: Types.ObjectId) {
    const user: User | null = await this.userModel.findById(id);
    if (!user) {
      throw AppException.notfound('User not found');
    }
    return user;
  }

  // throws a 409 if another user already has this username
  // skips the user's own record so they can change the case of their own
  // username, like reader_1 to Reader_1
  private async userNameExist(username: string, id: Types.ObjectId) {
    const taken = await this.userModel
      .exists({ username, _id: { $ne: id } })
      .collation(USERNAME_COLLATION);
    if (taken) {
      throw AppException.conflict('Username has been taken');
    }
  }

  // throws a 409 if the email or username is already taken
  private async userNameOrEmailExist(email: string, username: string) {
    // collation makes the username check ignore upper/lower case
    const [emailTaken, usernameTaken] = await Promise.all([
      this.userModel.exists({ email }),
      this.userModel.exists({ username }).collation(USERNAME_COLLATION),
    ]);

    if (emailTaken || usernameTaken) {
      throw AppException.conflict('Oppsss!! Email or Username has been taken');
    }
  }
}
