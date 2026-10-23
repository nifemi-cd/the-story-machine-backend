import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception.js';
import type { ApiErrorResponse } from '../interfaces/api-response.interface.js';

// Every error goes through here so the frontend always gets the same
// error shape back (success false, a message, and errors if there are any).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // sends the error back as json with the right status code
  catch(exception: unknown, host: ArgumentsHost) {
    // we only have http right now, anything else just gets rethrown
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    // if it's not an HttpException we didn't throw it on purpose, so it's a 500
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // only log 500s, 4xx errors are the client's fault and would just be noise
    if (status >= 500) {
      // request.url loses the /api/v1 part inside routers, originalUrl keeps it
      this.logger.error(
        `${request.method} ${request.originalUrl ?? request.url} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(this.bodyFor(exception));
  }

  // returns the json body to send for this error
  private bodyFor(exception: unknown): ApiErrorResponse {
    if (exception instanceof AppException) {
      return exception.errors?.length
        ? {
            success: false,
            message: exception.message,
            errors: exception.errors,
          }
        : { success: false, message: exception.message };
    }

    if (exception instanceof HttpException) {
      return { success: false, message: this.messageOf(exception) };
    }

    // don't send the real message back since it could leak things like
    // connection strings or stack details
    return { success: false, message: 'Internal server error' };
  }

  // returns a readable message from one of nest's exceptions
  // the body of nest's built in exceptions can be a plain string, an object
  // with a message, or an object with a list of messages, so handle all three
  private messageOf(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return body;
    }
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    return typeof message === 'string' ? message : exception.message;
  }
}
