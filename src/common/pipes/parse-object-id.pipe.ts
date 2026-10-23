import {
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AppException } from '../exceptions/app.exception.js';

// not using Types.ObjectId.isValid because it also says yes to any 12 character string
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

// Without this something like /user/123 would make it all the way to mongo
// and come back as a 500. Now it's a 400 that says which param was wrong
// (id, storyId, etc).
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<
  string,
  Types.ObjectId
> {
  // returns the param as an ObjectId, or throws a 400 if it isn't valid
  transform(value: string, metadata?: ArgumentMetadata): Types.ObjectId {
    if (!OBJECT_ID_PATTERN.test(value)) {
      const field = metadata?.data ?? 'id';
      throw AppException.badRequest(`Invalid ${field}`, [
        {
          field,
          message: `${field} must be a 24-character hex string`,
          success: false,
        },
      ]);
    }
    return new Types.ObjectId(value);
  }
}
