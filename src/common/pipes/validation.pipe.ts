import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception.js';
import type { FieldError } from '../interfaces/api-response.interface.js';

// returns a flat list of field errors
// class-validator gives back a nested tree of errors, this flattens it into
// one error per broken rule with paths like profile.url for nested fields
export function toFieldErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    // one field can break more than one rule
    const own: FieldError[] = Object.values(error.constraints ?? {}).map(
      (message) => ({
        field,
        message,
        success: false,
      }),
    );
    return [...own, ...toFieldErrors(error.children ?? [], field)];
  });
}

// returns the validation pipe used for the whole app
export function createValidationPipe() {
  return new ValidationPipe({
    // reject any field that isn't in the DTO, so nobody can sneak in
    // something like roles or passwordHash
    whitelist: true,
    forbidNonWhitelisted: true,
    // turns query strings into real types, so ?page=2 becomes the number 2
    transform: true,
    exceptionFactory: (errors) =>
      AppException.validation(toFieldErrors(errors)),
  });
}
