import {
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator.js';
import type {
  ApiSuccessResponse,
  PaginatedResult,
} from '../interfaces/api-response.interface.js';

const DEFAULT_MESSAGE = 'Success';

// returns true if a service gave back a paginated list
function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PaginatedResult<unknown>).items) &&
    typeof (value as PaginatedResult<unknown>).meta === 'object'
  );
}

// Wraps whatever a controller returns in { success, message, data } so the
// controllers can just return the data. For paginated lists meta gets moved
// up next to data.
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  // runs around every route and returns the wrapped response
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    // checks the method first, then the controller, for a @ResponseMessage
    const message =
      this.reflector.getAllAndOverride<string | undefined>(
        RESPONSE_MESSAGE_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? DEFAULT_MESSAGE;

    return next.handle().pipe(
      // files are left alone, wrapping them in json breaks the download
      map((data: unknown): ApiSuccessResponse<unknown> | StreamableFile =>
        data instanceof StreamableFile
          ? data
          : isPaginatedResult(data)
            ? { success: true, message, data: data.items, meta: data.meta }
            : { success: true, message, data: data ?? null },
      ),
    );
  }
}
