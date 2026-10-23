import type { ValidationError } from '@nestjs/common';
import { Types } from 'mongoose';
import { AppException } from '../exceptions/app.exception.js';
import { ParseObjectIdPipe } from './parse-object-id.pipe.js';
import { toFieldErrors } from './validation.pipe.js';

describe('ParseObjectIdPipe', () => {
  const pipe = new ParseObjectIdPipe();

  it('converts a 24-character hex id', () => {
    const id = new Types.ObjectId().toString();

    expect(pipe.transform(id).toString()).toBe(id);
  });

  it.each(['123', 'not-an-object-id', 'twelve chars'])(
    'rejects %j with a 400 on the id field',
    (value) => {
      const error = (() => {
        try {
          pipe.transform(value);
        } catch (e) {
          return e;
        }
      })();

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(400);
      expect(error).toMatchObject({ errors: [{ field: 'id' }] });
    },
  );

  it('names the route parameter in the error', () => {
    const error = (() => {
      try {
        pipe.transform('123', { type: 'param', data: 'storyId' });
      } catch (e) {
        return e;
      }
    })();

    expect(error).toMatchObject({
      message: 'Invalid storyId',
      errors: [{ field: 'storyId' }],
    });
  });
});

describe('toFieldErrors', () => {
  it('flattens nested errors into dotted field paths', () => {
    const errors = [
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
        children: [],
      },
      {
        property: 'profile',
        children: [
          {
            property: 'url',
            constraints: { isUrl: 'url must be a URL address' },
            children: [],
          },
        ],
      },
    ] as ValidationError[];

    expect(toFieldErrors(errors)).toEqual([
      { field: 'email', message: 'email must be an email', success: false },
      {
        field: 'profile.url',
        message: 'url must be a URL address',
        success: false,
      },
    ]);
  });
});
