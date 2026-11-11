import { ConfigService } from '@nestjs/config';
import { getJwtExpiresIn } from './jwt.config.js';

// returns a ConfigService that only knows these values
function configWith(values: Record<string, string>) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('getJwtExpiresIn', () => {
  it.each([
    ['not set', {}, 3600],
    ['set', { JWT_EXPIRES_IN: '900' }, 900],
    ['not a number', { JWT_EXPIRES_IN: '1h' }, 3600],
    ['zero', { JWT_EXPIRES_IN: '0' }, 3600],
  ])('uses the right value when %s', (_label, values, expected) => {
    expect(getJwtExpiresIn(configWith(values))).toBe(expected);
  });
});
