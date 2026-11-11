import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Auth (e2e)', () => {
  let testApp: TestApp;
  const api = () => request(testApp.app.getHttpServer());
  const ada = {
    email: 'ada@example.com',
    username: 'ada_writes',
    password: 'Story!Time2026',
  };
  const newPassword = 'N3w!Story2026';

  async function createUser() {
    await api().post('/api/v1/user').send(ada).expect(201);
  }

  // returns the access token for this email and password
  async function login(email: string, password: string) {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.data.accessToken as string;
  }

  // asks for a reset link and returns the token from the link that was "emailed"
  async function requestReset() {
    await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: ada.email })
      .expect(200);
    const email = testApp.mail.lastTo(ada.email);
    return /\?token=([0-9a-f]+)/.exec(email?.text ?? '')?.[1] as string;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.clearDatabase();
    await createUser();
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in and returns a token and the user without the password', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: '  Ada@Example.COM ', password: ada.password })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Logged in',
        data: {
          accessToken: expect.any(String),
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: { email: ada.email, username: ada.username },
        },
      });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.user).not.toHaveProperty('tokenVersion');
    });

    it.each([
      ['a wrong password', ada.email, 'Wr0ng!Pass2026'],
      ['an unknown email', 'nobody@example.com', ada.password],
    ])('rejects %s with the same 401', async (_label, email, password) => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(401);

      expect(res.body).toEqual({
        success: false,
        message: 'Invalid email or password',
      });
    });

    it('rejects a missing password with a field error', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: ada.email })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'password' }),
      );
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the logged in user', async () => {
      const token = await login(ada.email, ada.password);

      const res = await api()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toMatchObject({ username: ada.username });
    });

    it.each([
      ['no token', undefined],
      ['a made up token', 'Bearer not.a.token'],
    ])('rejects %s with a 401', async (_label, header) => {
      const req = api().get('/api/v1/auth/me');
      if (header) {
        req.set('Authorization', header);
      }

      const res = await req.expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('sends a reset token to a registered email', async () => {
      const token = await requestReset();

      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('gives the same reply for an email that is not registered', async () => {
      const res = await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        message: 'If that email is registered, a reset link has been sent',
        data: null,
      });
      expect(testApp.mail.sent).toHaveLength(0);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('sets the new password so only it works for login', async () => {
      const token = await requestReset();

      await api()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: newPassword })
        .expect(200);

      await login(ada.email, newPassword);
      await api()
        .post('/api/v1/auth/login')
        .send({ email: ada.email, password: ada.password })
        .expect(401);
    });

    it('logs out tokens made before the reset', async () => {
      const oldToken = await login(ada.email, ada.password);
      const token = await requestReset();

      await api()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: newPassword })
        .expect(200);

      await api()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);
    });

    it('only lets a token be used once', async () => {
      const token = await requestReset();
      await api()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: newPassword })
        .expect(200);

      const res = await api()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'An0ther!Pass2026' })
        .expect(400);

      expect(res.body.message).toBe('Reset link is invalid or has expired');
    });

    it('stops the old token working after asking for a new one', async () => {
      const first = await requestReset();
      await requestReset();

      await api()
        .post('/api/v1/auth/reset-password')
        .send({ token: first, password: newPassword })
        .expect(400);
    });

    it('rejects a weak new password with a field error', async () => {
      const token = await requestReset();

      const res = await api()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'password' })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'password' }),
      );
    });
  });
});
