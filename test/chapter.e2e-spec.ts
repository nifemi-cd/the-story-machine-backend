import request from 'supertest';
import { Types } from 'mongoose';
import { createTestApp, type TestApp } from './support/test-app.js';
import { lionScript } from './fixtures/story-json.js';

describe('Chapters (e2e)', () => {
  let testApp: TestApp;
  let authorId: string;
  let storyId: string;
  const api = () => request(testApp.app.getHttpServer());
  const missingId = new Types.ObjectId().toString();
  const chaptersUrl = () => `/api/v1/story/${storyId}/chapter`;

  async function createChapter(chapter_name = 'Chapter 1') {
    const res = await api()
      .post(chaptersUrl())
      .send({ chapter_name })
      .expect(201);
    return res.body.data.chapter_id as string;
  }

  async function chapterNames() {
    const res = await api().get(chaptersUrl()).expect(200);
    return res.body.data.map((c: { chapter_name: string }) => c.chapter_name);
  }

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await testApp.clearDatabase();
    // a chapter needs a story and a story needs an author. the characters
    // match the ones used in lionScript
    const user = await api()
      .post('/api/v1/user')
      .send({
        email: 'ada@example.com',
        username: 'ada_writes',
        password: 'Story!Time2026',
      })
      .expect(201);
    authorId = user.body.data._id;
    const story = await api()
      .post('/api/v1/story')
      .send({
        authorId,
        title: 'The Lion at the Door',
        characters: [
          {
            name: 'Dave',
            emotions: [
              { emotion: 'thinking' },
              { emotion: 'angry' },
              { emotion: 'happy' },
            ],
          },
          {
            name: 'Cindy',
            emotions: [{ emotion: 'thinking' }, { emotion: 'worried' }],
          },
        ],
      })
      .expect(201);
    storyId = story.body.data._id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('POST /api/v1/story/:storyId/chapter', () => {
    it('adds a chapter with an empty script', async () => {
      const res = await api()
        .post(chaptersUrl())
        .send({ chapter_name: 'Chapter 1' })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Chapter created',
        data: {
          title: 'The Lion at the Door',
          author: 'ada_writes',
          story_id: storyId,
          chapter_name: 'Chapter 1',
          story: { flags: {}, variables: [], lines: [] },
        },
      });
      expect(Object.keys(res.body.data.characters)).toEqual(['Dave', 'Cindy']);
    });

    it('adds a chapter with its script', async () => {
      const res = await api()
        .post(chaptersUrl())
        .send({ chapter_name: 'Chapter 1', story: lionScript })
        .expect(201);

      expect(res.body.data.story).toMatchObject(lionScript);
    });

    it("adds it to the end of the story's chapterOrder", async () => {
      const first = await createChapter('Chapter 1');
      const second = await createChapter('Chapter 2');

      const res = await api().get(`/api/v1/story/${storyId}`).expect(200);

      expect(res.body.data.chapterOrder).toEqual([
        { chapterId: first, title: 'Chapter 1' },
        { chapterId: second, title: 'Chapter 2' },
      ]);
    });

    it('rejects a missing chapter_name', async () => {
      const res = await api().post(chaptersUrl()).send({}).expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'chapter_name' }),
      );
    });

    it('rejects a script with dialogue from an unknown character', async () => {
      const script = {
        lines: [
          {
            line_id: 0,
            dialogue: { name: 'Zed', text: { words: ['Hello'] } },
          },
        ],
      };

      const res = await api()
        .post(chaptersUrl())
        .send({ chapter_name: 'Chapter 1', story: script })
        .expect(400);

      expect(res.body.message).toBe('Script is invalid');
      expect(res.body.errors.length).toBeGreaterThan(0);
      expect(await chapterNames()).toEqual([]);
    });

    it('rejects an invalid storyId', async () => {
      const res = await api()
        .post('/api/v1/story/123/chapter')
        .send({ chapter_name: 'Chapter 1' })
        .expect(400);

      expect(res.body.message).toBe('Invalid storyId');
    });

    it('returns 404 for a story that does not exist', async () => {
      await api()
        .post(`/api/v1/story/${missingId}/chapter`)
        .send({ chapter_name: 'Chapter 1' })
        .expect(404);
    });
  });

  describe('GET /api/v1/story/:storyId/chapter', () => {
    it('lists chapters in reading order without scripts or characters', async () => {
      await createChapter('Chapter 1');
      await createChapter('Chapter 2');

      const res = await api().get(chaptersUrl()).expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].chapter_name).toBe('Chapter 1');
      expect(res.body.data[0]).not.toHaveProperty('story');
      expect(res.body.data[0]).not.toHaveProperty('characters');
    });

    it('returns 404 for a story that does not exist', async () => {
      await api().get(`/api/v1/story/${missingId}/chapter`).expect(404);
    });
  });

  describe('GET /api/v1/story/:storyId/chapter/:id', () => {
    it('returns the chapter in the story JSON contract shape', async () => {
      const id = await createChapter();

      const res = await api().get(`${chaptersUrl()}/${id}`).expect(200);

      expect(res.body.data).toMatchObject({
        chapter_id: id,
        chapter_name: 'Chapter 1',
        title: 'The Lion at the Door',
        author: 'ada_writes',
      });
      expect(res.body.data.characters.Dave.emotions[0].emotion).toBe('default');
    });

    it('rejects an invalid chapter id', async () => {
      const res = await api().get(`${chaptersUrl()}/123`).expect(400);

      expect(res.body.errors).toEqual([
        expect.objectContaining({ field: 'id' }),
      ]);
    });

    it('returns 404 for a chapter that does not exist', async () => {
      const res = await api().get(`${chaptersUrl()}/${missingId}`).expect(404);

      expect(res.body).toEqual({
        success: false,
        message: 'Chapter not found',
      });
    });

    it('returns 404 for a chapter that belongs to another story', async () => {
      const id = await createChapter();
      const otherStory = await api()
        .post('/api/v1/story')
        .send({ authorId, title: 'Another story' })
        .expect(201);

      await api()
        .get(`/api/v1/story/${otherStory.body.data._id}/chapter/${id}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/story/:storyId/chapter/:id', () => {
    it("renames the chapter and its entry in the story's chapterOrder", async () => {
      const id = await createChapter();

      const res = await api()
        .patch(`${chaptersUrl()}/${id}`)
        .send({ chapter_name: 'The Door' })
        .expect(200);

      expect(res.body.data.chapter_name).toBe('The Door');
      const story = await api().get(`/api/v1/story/${storyId}`).expect(200);
      expect(story.body.data.chapterOrder).toEqual([
        { chapterId: id, title: 'The Door' },
      ]);
    });

    it('does not allow setting the script', async () => {
      const id = await createChapter();

      await api()
        .patch(`${chaptersUrl()}/${id}`)
        .send({ story: lionScript })
        .expect(400);
    });

    it('returns 404 for a chapter that does not exist', async () => {
      await api()
        .patch(`${chaptersUrl()}/${missingId}`)
        .send({ chapter_name: 'Nope' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/story/:storyId/chapter/:id', () => {
    it('deletes the chapter and moves later chapters up', async () => {
      await createChapter('Chapter 1');
      const second = await createChapter('Chapter 2');
      await createChapter('Chapter 3');

      const res = await api().delete(`${chaptersUrl()}/${second}`).expect(200);

      expect(res.body).toEqual({
        success: true,
        message: 'Chapter deleted',
        data: null,
      });
      expect(await chapterNames()).toEqual(['Chapter 1', 'Chapter 3']);
      await api().get(`${chaptersUrl()}/${second}`).expect(404);
    });

    it('returns 404 for a chapter that does not exist', async () => {
      await api().delete(`${chaptersUrl()}/${missingId}`).expect(404);
    });
  });

  describe('PUT /api/v1/story/:storyId/chapter/:id/script', () => {
    it('saves the script and returns it unchanged', async () => {
      const id = await createChapter();

      const res = await api()
        .put(`${chaptersUrl()}/${id}/script`)
        .send(lionScript)
        .expect(200);

      expect(res.body.message).toBe('Script saved');
      expect(res.body.data.story).toMatchObject(lionScript);
      const loaded = await api().get(`${chaptersUrl()}/${id}`).expect(200);
      expect(loaded.body.data.story).toMatchObject(lionScript);
    });

    it('rejects a script whose goto_line points past the end', async () => {
      const id = await createChapter();
      const script = {
        lines: [{ line_id: 0, goto_line: 99 }],
      };

      const res = await api()
        .put(`${chaptersUrl()}/${id}/script`)
        .send(script)
        .expect(400);

      expect(res.body.message).toBe('Script is invalid');
    });

    it('rejects a script with no lines', async () => {
      const id = await createChapter();

      const res = await api()
        .put(`${chaptersUrl()}/${id}/script`)
        .send({ lines: [] })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'lines' }),
      );
    });

    it('returns 404 for a chapter that does not exist', async () => {
      await api()
        .put(`${chaptersUrl()}/${missingId}/script`)
        .send(lionScript)
        .expect(404);
    });
  });
});
