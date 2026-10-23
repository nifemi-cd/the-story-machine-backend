import {
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator.js';
import { ResponseInterceptor } from './response.interceptor.js';

function httpContext(handler: () => void) {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

const returning = (value: unknown): CallHandler => ({
  handle: () => of(value),
});

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor(new Reflector());

  it('wraps data with the @ResponseMessage message', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(RESPONSE_MESSAGE_KEY, 'User created', handler);

    const result = await firstValueFrom(
      interceptor.intercept(httpContext(handler), returning({ id: 1 })),
    );

    expect(result).toEqual({
      success: true,
      message: 'User created',
      data: { id: 1 },
    });
  });

  it('defaults the message and turns undefined data into null', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        httpContext(() => undefined),
        returning(undefined),
      ),
    );

    expect(result).toEqual({ success: true, message: 'Success', data: null });
  });

  it('moves pagination meta to the top level', async () => {
    const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };

    const result = await firstValueFrom(
      interceptor.intercept(
        httpContext(() => undefined),
        returning({ items: ['a'], meta }),
      ),
    );

    expect(result).toEqual({
      success: true,
      message: 'Success',
      data: ['a'],
      meta,
    });
  });

  it('sends files as they are, without wrapping them', async () => {
    const file = new StreamableFile(Buffer.from('Once upon a time...'));

    const result = await firstValueFrom(
      interceptor.intercept(
        httpContext(() => undefined),
        returning(file),
      ),
    );

    expect(result).toBe(file);
  });
});
