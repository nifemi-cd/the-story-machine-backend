import request from 'supertest';
import { Types } from 'mongoose';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Stories (e2e)', () => {
  let testApp: TestApp;
  let authorId: string;
  const api = () => request(testApp.app.getHttpServer());
  const missingId = new Types.ObjectId().toString();

  async function createStory(title = 'The Lighthouse Keeper') {
    const res = await api()
      .post('/api/v1/story')
      .send({ authorId, title })
      .expect(201);
    return res.body.data._id as string;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.clearDatabase();
    // stories need a real author
    const res = await api()
      .post('/api/v1/user')
      .send({
        email: 'ada@example.com',
        username: 'ada_writes',
        password: 'Story!Time2026',
      })
      .expect(201);
    authorId = res.body.data._id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('POST /api/v1/story', () => {
    it('creates an empty draft', async () => {
      const res = await api()
        .post('/api/v1/story')
        .send({ authorId, title: '  The Lighthouse Keeper  ' })
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
        .send({ authorId })
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
        .send({ authorId, title: 'Sneaky', likeCount: 999 })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'likeCount' }),
      );
    });

    it('rejects an author that does not exist', async () => {
      const res = await api()
        .post('/api/v1/story')
        .send({ authorId: missingId, title: 'Orphan' })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        message: 'Author not found',
        errors: [{ field: 'authorId' }],
      });
    });
  });

  describe('GET /api/v1/story', () => {
    it('lists stories newest first with pagination meta', async () => {
      await createStory('First');
      await createStory('Second');

      const res = await api().get('/api/v1/story?limit=1').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Second');
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    });

    it('filters by status', async () => {
      const id = await createStory('Published one');
      await createStory('Still a draft');
      await api()
        .patch(`/api/v1/story/${id}`)
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
        title: 'The Lighthouse Keeper',
      });
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
        .send({ status: 'published' })
        .expect(200);
      expect(published.body.data.publishedAt).toEqual(expect.any(String));

      const draft = await api()
        .patch(`/api/v1/story/${id}`)
        .send({ status: 'draft' })
        .expect(200);
      expect(draft.body.data.publishedAt).toBeNull();
    });

    it('does not allow changing the author', async () => {
      const id = await createStory();

      await api()
        .patch(`/api/v1/story/${id}`)
        .send({ authorId: missingId })
        .expect(400);
    });

    it('returns 404 for a story that does not exist', async () => {
      await api()
        .patch(`/api/v1/story/${missingId}`)
        .send({ title: 'Nope' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/story/:id', () => {
    it('deletes the story and its file', async () => {
      const id = await createStory();
      await api()
        .put(`/api/v1/story/${id}/file`)
        .attach('file', Buffer.from('Once upon a time...'), {
          filename: 'draft.txt',
          contentType: 'text/plain',
        })
        .expect(200);

      const res = await api().delete(`/api/v1/story/${id}`).expect(200);

      expect(res.body).toEqual({
        success: true,
        message: 'Story deleted',
        data: null,
      });
      await api().get(`/api/v1/story/${id}`).expect(404);
      expect(testApp.storage.files.size).toBe(0);
    });

    it('returns 404 for a story that does not exist', async () => {
      await api().delete(`/api/v1/story/${missingId}`).expect(404);
    });
  });

  describe('PUT /api/v1/story/:id/file', () => {
    const upload = (id: string, content: Buffer, contentType = 'text/plain') =>
      api()
        .put(`/api/v1/story/${id}/file`)
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

      const res = await api().put(`/api/v1/story/${id}/file`).expect(400);

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
});
