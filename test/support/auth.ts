import request from 'supertest';
import type { TestApp } from './test-app.js';

export interface LoggedInUser {
  id: string;
  username: string;
  // the "Bearer <token>" header to send with .set('Authorization', auth)
  auth: string;
}

// signs up a user, logs them in and returns their id and auth header
// call this before starting the request that needs the header, awaiting it
// inside a supertest chain makes supertest lose its server
export async function signUpAndLogin(
  testApp: TestApp,
  username = 'ada_writes',
): Promise<LoggedInUser> {
  const api = () => request(testApp.app.getHttpServer());
  const email = `${username}@example.com`;
  const password = 'Story!Time2026';

  const user = await api()
    .post('/api/v1/user')
    .send({ email, username, password })
    .expect(201);
  const login = await api()
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    id: user.body.data._id as string,
    username,
    auth: `Bearer ${login.body.data.accessToken as string}`,
  };
}
