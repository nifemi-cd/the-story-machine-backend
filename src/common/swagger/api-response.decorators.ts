import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorDoc, PaginationMetaDoc } from './api-response.docs.js';

// returns the swagger decorators for a successful response
// The ResponseInterceptor wraps everything in { success, message, data } but
// swagger has no idea that happens, so this describes the wrapped version.
// Pass null as the model when data is always null (like after a delete).
export function ApiEnvelope(
  model: Type<unknown> | null,
  options: {
    status?: number;
    description?: string;
    paginated?: boolean;
    isArray?: boolean;
  } = {},
) {
  const {
    status = HttpStatus.OK,
    description,
    paginated = false,
    isArray = false,
  } = options;

  const data = !model
    ? { type: 'object', nullable: true, example: null }
    : paginated || isArray
      ? { type: 'array', items: { $ref: getSchemaPath(model) } }
      : { $ref: getSchemaPath(model) };

  return applyDecorators(
    // the $refs above don't work unless the models are registered
    ApiExtraModels(...(model ? [model] : []), PaginationMetaDoc),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        required: [
          'success',
          'message',
          'data',
          ...(paginated ? ['meta'] : []),
        ],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: description ?? 'Success' },
          data,
          ...(paginated
            ? { meta: { $ref: getSchemaPath(PaginationMetaDoc) } }
            : {}),
        },
      },
    }),
  );
}

// returns the swagger decorator for an error response
// Same idea for errors. The description is reused as the example message,
// otherwise every error in the docs showed the same "Validation failed" example.
export function ApiError(status: number, description: string) {
  return ApiResponse({
    status,
    description,
    type: ApiErrorDoc,
    example: { success: false, message: description },
  });
}
