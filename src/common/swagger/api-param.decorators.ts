import { ApiParam } from '@nestjs/swagger';

// returns a swagger decorator for an id param
// Without this swagger shows id params as an ObjectId object instead of a
// string, because of the ParseObjectIdPipe type.
// usage @ApiObjectIdParam('Story', 'storyId')
export function ApiObjectIdParam(resource: string, name = 'id') {
  return ApiParam({
    name,
    type: String,
    description: `${resource} id (24-character hex)`,
    example: '6ad4306d3168a59d2918aeb0',
  });
}
