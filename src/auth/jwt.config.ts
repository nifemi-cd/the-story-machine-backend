import type { ConfigService } from '@nestjs/config';

// how long a login token works for if JWT_EXPIRES_IN isn't set (1 hour)
const DEFAULT_EXPIRES_IN_SECONDS = 3600;

// returns how many seconds a login token lasts
// the module signs tokens with it and login sends it back to the client,
// so both read it from here to make sure they agree
export function getJwtExpiresIn(configService: ConfigService): number {
  const value = Number(configService.get<string>('JWT_EXPIRES_IN'));
  return Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_EXPIRES_IN_SECONDS;
}
