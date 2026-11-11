import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { ForgotPasswordDto } from './forgot-password.dto.js';
import { LoginDto } from './login.dto.js';
import { ResetPasswordDto } from './reset-password.dto.js';

// does the same thing the ValidationPipe does and returns which fields failed
async function errorsFor<T extends object>(
  dtoClass: ClassConstructor<T>,
  input: object,
) {
  const dto = plainToInstance(dtoClass, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('LoginDto', () => {
  const valid = { email: 'reader@example.com', password: 'anything' };

  it('accepts any non-empty password, even a weak one', async () => {
    expect((await errorsFor(LoginDto, valid)).fields).toEqual([]);
  });

  it('trims and lowercases the email like sign up does', async () => {
    const { dto } = await errorsFor(LoginDto, {
      ...valid,
      email: ' Reader@Example.COM ',
    });

    expect(dto.email).toBe('reader@example.com');
  });

  it.each([
    ['email', { email: 'not-an-email' }],
    ['password', { password: '' }],
  ])('rejects an invalid %s', async (field, override) => {
    expect(
      (await errorsFor(LoginDto, { ...valid, ...override })).fields,
    ).toContain(field);
  });
});

describe('ForgotPasswordDto', () => {
  it('rejects an invalid email and unknown fields', async () => {
    const { fields } = await errorsFor(ForgotPasswordDto, {
      email: 'nope',
      username: 'x',
    });

    expect(fields.sort()).toEqual(['email', 'username']);
  });
});

describe('ResetPasswordDto', () => {
  const valid = { token: 'ab12'.repeat(16), password: 'N3w!Password' };

  it('accepts a 64 character hex token and a strong password', async () => {
    expect((await errorsFor(ResetPasswordDto, valid)).fields).toEqual([]);
  });

  it.each([
    ['token', { token: 'short' }],
    ['token', { token: 'z'.repeat(64) }],
    ['password', { password: 'weakpass' }],
  ])('rejects an invalid %s', async (field, override) => {
    expect(
      (await errorsFor(ResetPasswordDto, { ...valid, ...override })).fields,
    ).toContain(field);
  });
});
