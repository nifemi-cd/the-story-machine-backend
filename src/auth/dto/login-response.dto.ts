import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../user/dto/user-response.dto.js';

// for swagger only, describes what login sends back
export class LoginResponseDto {
  @ApiProperty({
    description:
      'Send it on later requests as the header Authorization: Bearer <accessToken>',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({
    description: 'Seconds until the token stops working',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
