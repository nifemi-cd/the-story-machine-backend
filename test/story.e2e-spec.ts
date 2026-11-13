import request from 'supertest';
import { Types } from 'mongoose';
import { createTestApp, type TestApp } from './support/test-app.js';
import { signUpAndLogin } from './support/auth.js';

describe('Stories (e2e)', () => {
  let testApp: TestApp;
  let authorId: string;
  // Ada's "Bearer <token>" header, she writes every story in these tests
  let auth: string;
  const api = () => request(testApp.app.getHttpServer());
  const missingId = new Types.ObjectId().toString();

  async function createStory(title = 'The Lighthouse Keeper') {
    const res = await api()
      .post('/api/v1/story')
      .set('Authorization', auth)
      .send({ title })
      .expect(201);
    return res.body.data._id as string;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.clearDatabase();
    // stories need a logged in author
    ({ id: authorId, auth } = await signUpAndLogin(testApp));
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('POST /api/v1/story', () => {
    it('creates an empty draft', async () => {
      const res = await api()
        .post('/api/v1/story')
        .set('Authorization', auth)
        .send({ title: '  The Lighthouse Keeper  ' })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Story created',
        data: {
          authorId,
          title: 'The Lighthouse Keeper',
          status: 'draft',
          draftUrl: null,
          chapterOrder: [],
        },
      });
    });

    it('rejects a missing title with a field error', async () => {
      const res = await api()
        .post('/api/v1/story')
        .set('Authorization', auth)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'title' }),
      );
    });

    it('rejects fields that are not in the DTO', async () => {
      const res = await api()
        .post('/api/v1/story')
        .set('Authorization', auth)
        .send({ title: 'Sneaky', likeCount: 999 })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'likeCount' }),
      );
    });

    it('takes the author from the login, so authorId cannot be sent', async () => {
      const res = await api()
        .post('/api/v1/story')
        .set('Authorization', auth)
        .send({ authorId: missingId, title: 'Not mine' })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'authorId' }),
      );
    });

    it('rejects a request that is not logged in with a 401', async () => {
      await api()
        .post('/api/v1/story')
        .send({ title: 'Anonymous' })
        .expect(401);
    });
  });

  describe('GET /api/v1/story', () => {
    it('lists stories newest first with pagination meta', async () => {
      await createStory('First');
      await createStory('Second');

      const res = await api().get('/api/v1/story?limit=1').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        title: 'Second',
        // signUpAndLogin doesn't send one, so it defaults to the username
        author: { displayName: 'ada_writes' },
      });
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    });

    it('gives each story its own author when several people wrote them', async () => {
      await createStory('By Ada');
      const bob = await signUpAndLogin(testApp, 'bob_writes');
      await api()
        .post('/api/v1/story')
        .set('Authorization', bob.auth)
        .send({ title: 'By Bob' })
        .expect(201);

      const res = await api().get('/api/v1/story').expect(200);

      expect(
        res.body.data.map((s: { title: string; author: object }) => [
          s.title,
          s.author,
        ]),
      ).toEqual([
        ['By Bob', { displayName: 'bob_writes' }],
        ['By Ada', { displayName: 'ada_writes' }],
      ]);
    });

    it('filters by status', async () => {
      const id = await createStory('Published one');
      await createStory('Still a draft');
      await api()
        .patch(`/api/v1/story/${id}`)
        .set('Authorization', auth)
        .send({ status: 'published' })
        .expect(200);

      const res = await api().get('/api/v1/story?status=published').expect(200);

      expect(res.body.data.map((s: { title: string }) => s.title)).toEqual([
        'Published one',
      ]);
    });

    it('rejects an invalid query parameter', async () => {
      await api().get('/api/v1/story?status=archived').expect(400);
    });
  });

  describe('GET /api/v1/story/:id', () => {
    it('returns the story', async () => {
      const id = await createStory();

      const res = await api().get(`/api/v1/story/${id}`).expect(200);

      expect(res.body.data).toMatchObject({
        _id: id,
        authorId,
        title: 'The Lighthouse Keeper',
      });
      // only the display name. no _id since authorId already has it, and
      // nothing private about the author
      expect(res.body.data.author).toEqual({ displayName: 'ada_writes' });
      // turning on virtuals for toJSON shouldn't add an id copy of _id
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('shows the new display name after the author changes it', async () => {
      const id = await createStory();
      await api()
        .patch('/api/v1/user')
        .set('Authorization', auth)
        .send({ displayName: 'Ada Lovelace' })
        .expect(200);

      const res = await api().get(`/api/v1/story/${id}`).expect(200);

      expect(res.body.data.author.displayName).toBe('Ada Lovelace');
    });

    it('rejects an id that is not 24-character hex', async () => {
      const res = await api().get('/api/v1/story/123').expect(400);

      expect(res.body.errors).toEqual([
        expect.objectContaining({ field: 'id' }),
      ]);
    });

    it('returns 404 for a story that does not exist', async () => {
      const res = await api().get(`/api/v1/story/${missingId}`).expect(404);

      expect(res.body).toEqual({ success: false, message: 'Story not found' });
    });
  });

  describe('PATCH /api/v1/story/:id', () => {
    it('updates only the fields sent', async () => {
      const id = await createStory();

      const res = await api()
        .patch(`/api/v1/story/${id}`)
        .set('Authorization', auth)
        .send({ description: 'A storm, a stranger.' })
        .expect(200);

      expect(res.body.data).toMatchObject({
        title: 'The Lighthouse Keeper',
        description: 'A storm, a stranger.',
      });
    });

    it('sets publishedAt when published and clears it when moved back to draft', async () => {
      const id = await createStory();

      const published = await api()
        .patch(`/api/v1/story/${id}`)
        .set('Authorization', auth)
        .send({ status: 'published' })
        .expect(200);
      expect(published.body.data.publishedAt).toEqual(expect.any(String));

      const draft = await api()
        .patch(`/api/v1/story/${id}`)
        .set('Authorization', auth)
        .send({ status: 'draft' })
        .expect(200);
      expect(draft.body.data.publishedAt).toBeNull();
    });

    it('does not allow changing the author', async () => {
      const id = await createStory();

      await api()
        .patch(`/api/v1/story/${id}`)
        .set('Authorization', auth)
        .send({ authorId: missingId })
        .expect(400);
    });

    it('returns 404 for a story that does not exist', async () => {
      await api()
        .patch(`/api/v1/story/${missingId}`)
        .set('Authorization', auth)
        .send({ title: 'Nope' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/story/:id', () => {
    it('deletes the story and its file', async () => {
      const id = await createStory();
      await api()
        .put(`/api/v1/story/${id}/file`)
        .set('Authorization', auth)
        .attach('file', Buffer.from('Once upon a time...'), {
          filename: 'draft.txt',
          contentType: 'text/plain',
        })
        .expect(200);

      const res = await api()
        .delete(`/api/v1/story/${id}`)
        .set('Authorization', auth)
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        message: 'Story deleted',
        data: null,
      });
      await api().get(`/api/v1/story/${id}`).expect(404);
      expect(testApp.storage.files.size).toBe(0);
    });

    it('returns 404 for a story that does not exist', async () => {
      await api()
        .delete(`/api/v1/story/${missingId}`)
        .set('Authorization', auth)
        .expect(404);
    });
  });

  describe('PUT /api/v1/story/:id/file', () => {
    const upload = (id: string, content: Buffer, contentType = 'text/plain') =>
      api()
        .put(`/api/v1/story/${id}/file`)
        .set('Authorization', auth)
        .attach('file', content, { filename: 'draft.txt', contentType });

    it('stores the file and sets draftUrl', async () => {
      const id = await createStory();

      const res = await upload(id, Buffer.from('Once upon a time...')).expect(
        200,
      );

      expect(res.body.message).toBe('Story file uploaded');
      expect(res.body.data.draftUrl).toBe(
        `https://fake.blob.local/stories/drafts/${id}.txt`,
      );
      expect(testApp.storage.files.get(`drafts/${id}.txt`)?.toString()).toBe(
        'Once upon a time...',
      );
    });

    it('replaces an earlier file', async () => {
      const id = await createStory();
      await upload(id, Buffer.from('First draft')).expect(200);

      await upload(id, Buffer.from('Second draft')).expect(200);

      expect(testApp.storage.files.size).toBe(1);
      expect(testApp.storage.files.get(`drafts/${id}.txt`)?.toString()).toBe(
        'Second draft',
      );
    });

    it('rejects a request with no file', async () => {
      const id = await createStory();

      const res = await api()
        .put(`/api/v1/story/${id}/file`)
        .set('Authorization', auth)
        .expect(400);

      expect(res.body.errors).toEqual([
        expect.objectContaining({ field: 'file' }),
      ]);
    });

    it('rejects a file that is not plain text', async () => {
      const id = await createStory();

      await upload(id, Buffer.from('fake image'), 'image/png').expect(400);

      expect(testApp.storage.files.size).toBe(0);
    });

    it('rejects a file larger than 10 MB', async () => {
      const id = await createStory();

      await upload(id, Buffer.alloc(10 * 1024 * 1024 + 1, 'a')).expect(413);

      expect(testApp.storage.files.size).toBe(0);
    });

    it('returns 404 and stores nothing for a story that does not exist', async () => {
      await upload(missingId, Buffer.from('Once upon a time...')).expect(404);

      expect(testApp.storage.files.size).toBe(0);
    });
  });

  describe('GET /api/v1/story/:id/file', () => {
    it('sends the file as plain text, not wrapped in JSON', async () => {
      const id = await createStory();
      await api()
        .put(`/api/v1/story/${id}/file`)
        .set('Authorization', auth)
        .attach('file', Buffer.from('Once upon a time...'), {
          filename: 'draft.txt',
          contentType: 'text/plain',
        })
        .expect(200);

      const res = await api().get(`/api/v1/story/${id}/file`).expect(200);

      expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="story-${id}.txt"`,
      );
      expect(res.text).toBe('Once upon a time...');
    });

    it('returns 404 when the story has no file yet', async () => {
      const id = await createStory();

      const res = await api().get(`/api/v1/story/${id}/file`).expect(404);

      expect(res.body).toEqual({
        success: false,
        message: 'This story has no file yet',
      });
    });

    it('returns 404 for a story that does not exist', async () => {
      await api().get(`/api/v1/story/${missingId}/file`).expect(404);
    });
  });

  // every route that changes a story is for its author only
  describe('when someone other than the author tries to change a story', () => {
    let storyId: string;
    let graceAuth: string;

    beforeEach(async () => {
      storyId = await createStory();
      ({ auth: graceAuth } = await signUpAndLogin(testApp, 'grace'));
    });

    // returns each write request on the story, without its auth header yet
    const writes = () => ({
      'PATCH /story/:id': api()
        .patch(`/api/v1/story/${storyId}`)
        .send({ title: 'Stolen' }),
      'DELETE /story/:id': api().delete(`/api/v1/story/${storyId}`),
      'PUT /story/:id/file': api()
        .put(`/api/v1/story/${storyId}/file`)
        .attach('file', Buffer.from('Not mine'), {
          filename: 'draft.txt',
          contentType: 'text/plain',
        }),
    });

    it.each(['PATCH /story/:id', 'DELETE /story/:id', 'PUT /story/:id/file'])(
      '%s rejects another user with a 403',
      async (route) => {
        const res = await writes()
          [route as keyof ReturnType<typeof writes>].set(
            'Authorization',
            graceAuth,
          )
          .expect(403);

        expect(res.body).toEqual({
          success: false,
          message: 'Only the author can change this story',
        });
      },
    );

    it.each(['PATCH /story/:id', 'DELETE /story/:id', 'PUT /story/:id/file'])(
      '%s rejects a request that is not logged in with a 401',
      async (route) => {
        await writes()[route as keyof ReturnType<typeof writes>].expect(401);
      },
    );

    it('leaves the story and its file untouched', async () => {
      await writes()['PATCH /story/:id'].set('Authorization', graceAuth);
      await writes()['DELETE /story/:id'].set('Authorization', graceAuth);
      await writes()['PUT /story/:id/file'].set('Authorization', graceAuth);

      const res = await api().get(`/api/v1/story/${storyId}`).expect(200);
      expect(res.body.data).toMatchObject({
        title: 'The Lighthouse Keeper',
        draftUrl: null,
      });
      expect(testApp.storage.files.size).toBe(0);
    });

    it('still lets anyone read the story without logging in', async () => {
      await api().get(`/api/v1/story/${storyId}`).expect(200);
      await api().get('/api/v1/story').expect(200);
    });
  });
});
