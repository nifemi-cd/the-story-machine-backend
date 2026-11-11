import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { User } from '../src/user/entities/user.entity.js';
import { UserRole } from '../src/user/enums/user-role.enum.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Users (e2e)', () => {
  let testApp: TestApp;
  const api = () => request(testApp.app.getHttpServer());
  const missingId = new Types.ObjectId().toString();
  const ada = {
    email: 'ada@example.com',
    username: 'ada_writes',
    password: 'Story!Time2026',
  };

  async function createUser(fields: Partial<typeof ada> = {}) {
    const res = await api()
      .post('/api/v1/user')
      .send({ ...ada, ...fields })
      .expect(201);
    return res.body.data._id as string;
  }

  // logs in and returns the "Bearer <token>" header for this user
  // get the header before starting the request it's for, awaiting it inside
  // a supertest chain makes supertest lose its server
  async function authHeader(email = ada.email, password = ada.password) {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return `Bearer ${res.body.data.accessToken as string}`;
  }

  // makes an admin and returns their auth header
  // the API never lets anyone become admin, so this sets the role in the db
  async function adminHeader() {
    const email = 'admin@example.com';
    await createUser({ email, username: 'the_admin' });
    await testApp.app
      .get<Model<User>>(getModelToken(User.name))
      .updateOne({ email }, { roles: [UserRole.User, UserRole.Admin] });
    return authHeader(email);
  }

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.clearDatabase();
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('POST /api/v1/user', () => {
    it('registers a user without ever returning the password', async () => {
      const res = await api()
        .post('/api/v1/user')
        .send({ ...ada, email: '  Ada@Example.COM ' })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'User created',
        data: {
          email: 'ada@example.com',
          username: 'ada_writes',
          displayName: 'ada_writes',
        },
      });
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('rejects a weak password with a field error', async () => {
      const res = await api()
        .post('/api/v1/user')
        .send({ ...ada, password: 'password' })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'password' }),
      );
    });

    it('rejects fields that are not in the DTO, such as roles', async () => {
      const res = await api()
        .post('/api/v1/user')
        .send({ ...ada, roles: ['admin'] })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'roles' }),
      );
    });

    it('rejects an email that is already registered', async () => {
      await createUser();

      const res = await api()
        .post('/api/v1/user')
        .send({ ...ada, username: 'someone_else' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('rejects a username that is taken, ignoring letter case', async () => {
      await createUser();

      await api()
        .post('/api/v1/user')
        .send({ ...ada, email: 'other@example.com', username: 'ADA_WRITES' })
        .expect(409);
    });
  });

  describe('GET /api/v1/user', () => {
    it('lists users newest first with pagination meta', async () => {
      // the admin is made first so they're the oldest user
      const admin = await adminHeader();
      await createUser();
      await createUser({ email: 'grace@example.com', username: 'grace' });

      const res = await api()
        .get('/api/v1/user?limit=1')
        .set('Authorization', admin)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].username).toBe('grace');
      expect(res.body.data[0]).not.toHaveProperty('passwordHash');
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 3,
        totalPages: 3,
      });
    });

    it('rejects a page size over the maximum', async () => {
      const admin = await adminHeader();

      const res = await api()
        .get('/api/v1/user?limit=101')
        .set('Authorization', admin)
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'limit' }),
      );
    });

    it('rejects a request that is not logged in with a 401', async () => {
      await api().get('/api/v1/user').expect(401);
    });

    it('rejects a user who is not an admin with a 403', async () => {
      await createUser();
      const reader = await authHeader();

      const res = await api()
        .get('/api/v1/user')
        .set('Authorization', reader)
        .expect(403);

      expect(res.body).toEqual({
        success: false,
        message: 'You do not have permission to do this',
      });
    });
  });

  describe('GET /api/v1/user/:id', () => {
    it('returns the user', async () => {
      const admin = await adminHeader();
      const id = await createUser();

      const res = await api()
        .get(`/api/v1/user/${id}`)
        .set('Authorization', admin)
        .expect(200);

      expect(res.body.data).toMatchObject({ _id: id, username: 'ada_writes' });
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('rejects an id that is not 24-character hex', async () => {
      const admin = await adminHeader();

      await api()
        .get('/api/v1/user/123')
        .set('Authorization', admin)
        .expect(400);
    });

    it('returns 404 for a user that does not exist', async () => {
      const admin = await adminHeader();

      const res = await api()
        .get(`/api/v1/user/${missingId}`)
        .set('Authorization', admin)
        .expect(404);

      expect(res.body).toEqual({ success: false, message: 'User not found' });
    });

    it('rejects a request that is not logged in with a 401', async () => {
      const id = await createUser();

      await api().get(`/api/v1/user/${id}`).expect(401);
    });

    it('rejects a user who is not an admin with a 403, even for themselves', async () => {
      const id = await createUser();
      const reader = await authHeader();

      await api()
        .get(`/api/v1/user/${id}`)
        .set('Authorization', reader)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/user/:id', () => {
    it('updates only the fields sent', async () => {
      const id = await createUser();

      const res = await api()
        .patch(`/api/v1/user/${id}`)
        .send({ bio: 'I read mysteries.' })
        .expect(200);

      expect(res.body.data).toMatchObject({
        username: 'ada_writes',
        bio: 'I read mysteries.',
      });
    });

    it.each(['email', 'password'])(
      'does not allow changing %s',
      async (field) => {
        const id = await createUser();

        const res = await api()
          .patch(`/api/v1/user/${id}`)
          .send({ [field]: 'New!Value2026' })
          .expect(400);

        expect(res.body.errors).toContainEqual(
          expect.objectContaining({ field }),
        );
      },
    );

    it('rejects a username that belongs to another user', async () => {
      await createUser({ email: 'grace@example.com', username: 'grace' });
      const id = await createUser();

      await api()
        .patch(`/api/v1/user/${id}`)
        .send({ username: 'grace' })
        .expect(409);
    });

    it('returns 404 for a user that does not exist', async () => {
      await api()
        .patch(`/api/v1/user/${missingId}`)
        .send({ bio: 'Nobody' })
        .expect(404);
    });
  });
});
