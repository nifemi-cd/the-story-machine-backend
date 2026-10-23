import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('AppController (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /api/v1', () => {
    return request(testApp.app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          success: true,
          message: 'Success',
          data: 'Hello World, how are you today?!',
        });
      });
  });
});
