import { HttpException, HttpStatus } from '@nestjs/common';
import type {
  ApiErrorResponse,
  FieldError,
} from '../interfaces/api-response.interface.js';

// Nest's built in exceptions only have a message. This one can also carry a
// list of which fields were wrong, which the frontend uses to show errors
// next to the right inputs.
export class AppException extends HttpException {
  readonly errors?: FieldError[];

  constructor(status: HttpStatus, message: string, errors?: FieldError[]) {
    const body: ApiErrorResponse = { success: false, message, errors };
    super(body, status);
    this.errors = errors;
  }

  // returns a 400 error
  static badRequest(message: string, errors?: FieldError[]) {
    return new AppException(HttpStatus.BAD_REQUEST, message, errors);
  }

  // returns a 400 error for failed validation
  // used by the ValidationPipe when a DTO check fails
  static validation(errors: FieldError[], message = 'Validation failed') {
    return new AppException(HttpStatus.BAD_REQUEST, message, errors);
  }

  // returns a 409 error
  static conflict(message: string, errors?: FieldError[]) {
    return new AppException(HttpStatus.CONFLICT, message, errors);
  }

  // returns a 404 error
  static notfound(message: string, error?: FieldError[]) {
    return new AppException(HttpStatus.NOT_FOUND, message, error);
  }
}
