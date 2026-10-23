import { model, Types } from 'mongoose';
import { Story, StorySchema } from './story.entity.js';

describe('StorySchema', () => {
  it('starts as an empty draft with zero counts', () => {
    const StoryModel = model(Story.name, StorySchema);
    const story = new StoryModel({
      authorId: new Types.ObjectId(),
      title: 'The Lighthouse Keeper',
    });

    const json = JSON.parse(JSON.stringify(story)) as Record<string, unknown>;

    expect(json).toMatchObject({
      status: 'draft',
      description: '',
      draftUrl: null,
      publishedAt: null,
      chapterOrder: [],
      characters: [],
      likeCount: 0,
      commentCount: 0,
      readCount: 0,
    });
    expect(json).not.toHaveProperty('__v');
  });

  it('stores characters without sub-document ids', () => {
    const StoryModel = model(Story.name, StorySchema);
    const story = new StoryModel({
      authorId: new Types.ObjectId(),
      title: 'The Lighthouse Keeper',
      characters: [{ name: 'Dave', emotions: [{ emotion: 'default' }] }],
    });

    expect(JSON.parse(JSON.stringify(story)).characters).toStrictEqual([
      {
        name: 'Dave',
        description: null,
        emotions: [{ emotion: 'default', portrait_x: null, portrait_y: null }],
      },
    ]);
  });
});
