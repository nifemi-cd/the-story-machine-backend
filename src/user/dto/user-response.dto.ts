import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum.js';

// for swagger only. no passwordHash here since toJSON in the schema strips it
export class UserResponseDto {
  @ApiProperty({
    description: 'Database id; use it in /user/:id',
    example: '6ad4306d3168a59d2918aead',
  })
  _id: string;

  @ApiProperty({ example: 'ada.reader@example.com' })
  email: string;

  @ApiProperty({ example: 'ada_writes' })
  username: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  displayName: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    isArray: true,
    example: [UserRole.User],
  })
  roles: UserRole[];

  @ApiProperty({ example: 'I read mysteries and write branching sci-fi.' })
  bio: string;

  @ApiProperty({ example: 'https://example.com/ada' })
  profileUrl: string;

  @ApiProperty({ example: 0 })
  followerCount: number;

  @ApiProperty({ example: 0 })
  followingCount: number;

  @ApiProperty({ example: '2026-10-17T21:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-17T21:30:00.000Z' })
  updatedAt: Date;
}
