import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { AppException } from '../common/exceptions/app.exception.js';
import { UserService } from './user.service.js';
import { User, USERNAME_COLLATION } from './entities/user.entity.js';
import type { CreateUserDto } from './dto/create-user.dto.js';

const dto = {
  email: 'reader@example.com',
  username: 'Reader_1',
  password: 'Str0ng!Pass',
} satisfies CreateUserDto;

describe('UserService', () => {
  let service: UserService;
  let emailExists: boolean;
  let usernameExists: boolean;
  const collation = vi.fn();
  // find() is chained (sort, skip, limit) so each step returns the same mock
  const query = {
    sort: vi.fn(() => query),
    skip: vi.fn(() => query),
    limit: vi.fn(() => query),
    exec: vi.fn(),
  };
  const userModel = {
    exists: vi.fn(),
    create: vi.fn(),
    find: vi.fn(() => query),
    countDocuments: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  };

  beforeEach(async () => {
    emailExists = false;
    usernameExists = false;
    collation.mockReset();
    userModel.create.mockReset();
    userModel.create.mockImplementation((doc: object) =>
      Promise.resolve({ _id: 'new-id', ...doc }),
    );
    userModel.exists.mockReset();
    userModel.exists.mockImplementation((filter: Record<string, string>) => {
      if ('email' in filter) {
        return Promise.resolve(emailExists ? { _id: 'a' } : null);
      }
      // the username check calls .collation() after exists()
      return {
        collation: collation.mockImplementation(() =>
          Promise.resolve(usernameExists ? { _id: 'b' } : null),
        ),
      };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('creates a user with a hashed password and no plain password', async () => {
    await service.create({ ...dto });

    const saved = userModel.create.mock.calls[0][0] as Record<string, unknown>;
    expect(saved).not.toHaveProperty('password');
    expect(saved).toMatchObject({
      email: dto.email,
      username: dto.username,
      displayName: dto.username,
    });
    await expect(
      bcrypt.compare(dto.password, saved.passwordHash as string),
    ).resolves.toBe(true);
  });

  it('keeps a provided display name', async () => {
    await service.create({ ...dto, displayName: 'The Reader' });

    expect(userModel.create.mock.calls[0][0]).toMatchObject({
      displayName: 'The Reader',
    });
  });

  it('checks usernames case-insensitively', async () => {
    await service.create({ ...dto });

    expect(collation).toHaveBeenCalledWith(USERNAME_COLLATION);
  });

  async function expectTakenConflict() {
    const error = await service.create({ ...dto }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(409);
    expect((error as AppException).message).toBe(
      'Oppsss!! Email or Username has been taken',
    );
  }

  it.each([
    ['email', true, false],
    ['username', false, true],
    ['email and username', true, true],
  ])(
    'rejects a taken %s with a 409 before saving',
    async (_label, email, username) => {
      emailExists = email;
      usernameExists = username;

      await expectTakenConflict();
      expect(userModel.create).not.toHaveBeenCalled();
    },
  );

  it('turns a duplicate key race into the same 409', async () => {
    userModel.create.mockRejectedValue({
      code: 11000,
      keyPattern: { username: 1 },
    });

    await expectTakenConflict();
  });

  it('rethrows other database errors', async () => {
    const dbError = new Error('connection lost');
    userModel.create.mockRejectedValue(dbError);

    await expect(service.create({ ...dto })).rejects.toBe(dbError);
  });

  describe('findAll', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      query.exec.mockResolvedValue([{ username: 'a' }, { username: 'b' }]);
      userModel.countDocuments.mockReturnValue({
        exec: () => Promise.resolve(45),
      });
    });

    it('returns the page of users with pagination meta', async () => {
      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result).toEqual({
        items: [{ username: 'a' }, { username: 'b' }],
        meta: { page: 2, limit: 20, total: 45, totalPages: 3 },
      });
    });

    it('skips earlier pages and sorts newest first', async () => {
      await service.findAll({ page: 3, limit: 10 });

      expect(query.skip).toHaveBeenCalledWith(20);
      expect(query.limit).toHaveBeenCalledWith(10);
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    });

    it('reports zero pages when there are no users', async () => {
      query.exec.mockResolvedValue([]);
      userModel.countDocuments.mockReturnValue({
        exec: () => Promise.resolve(0),
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('findOne', () => {
    const id = new Types.ObjectId();

    it('returns the user', async () => {
      const user = { _id: id, username: 'Reader_1' };
      userModel.findById.mockResolvedValue(user);

      await expect(service.findOne(id)).resolves.toBe(user);
      expect(userModel.findById).toHaveBeenCalledWith(id);
    });

    it('throws a 404 when the user does not exist', async () => {
      userModel.findById.mockResolvedValue(null);

      const error = await service.findOne(id).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(404);
    });
  });

  describe('update', () => {
    const id = new Types.ObjectId();
    const updated = { _id: id, username: 'New_Name', bio: 'Hi' };

    beforeEach(() => {
      userModel.findByIdAndUpdate.mockReset();
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(updated),
      });
    });

    it('applies only the sent fields and returns the updated user', async () => {
      await expect(service.update(id, { bio: 'Hi' })).resolves.toBe(updated);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { bio: 'Hi' },
        { returnDocument: 'after', runValidators: true },
      );
    });

    it('does not check the username when it is not being changed', async () => {
      await service.update(id, { bio: 'Hi' });

      expect(userModel.exists).not.toHaveBeenCalled();
    });

    it('checks a new username against other users only', async () => {
      await service.update(id, { username: 'New_Name' });

      expect(userModel.exists).toHaveBeenCalledWith({
        username: 'New_Name',
        _id: { $ne: id },
      });
      expect(collation).toHaveBeenCalledWith(USERNAME_COLLATION);
    });

    it('rejects a username another user has with a 409', async () => {
      usernameExists = true;

      const error = await service
        .update(id, { username: 'Taken' })
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(409);
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('turns a duplicate key race into a 409', async () => {
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: () => Promise.reject({ code: 11000 }),
      });

      const error = await service
        .update(id, { username: 'Taken' })
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(409);
    });

    it('throws a 404 when the user does not exist', async () => {
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(null),
      });

      const error = await service
        .update(id, { bio: 'Hi' })
        .catch((e: unknown) => e);

      expect((error as AppException).getStatus()).toBe(404);
    });
  });
});
