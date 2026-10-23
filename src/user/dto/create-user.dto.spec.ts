import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';
import { UpdateUserDto } from './update-user.dto.js';

const valid = {
  email: 'reader@example.com',
  username: 'Reader_1',
  password: 'Str0ng!Pass',
};

// does the same thing the ValidationPipe does and returns which fields failed
async function errorsFor(input: object) {
  const dto = plainToInstance(CreateUserDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('CreateUserDto', () => {
  it('accepts a valid user', async () => {
    expect((await errorsFor(valid)).fields).toEqual([]);
  });

  it('trims and lowercases the email before validating it', async () => {
    const { dto, fields } = await errorsFor({
      ...valid,
      email: '  Reader@Example.COM ',
    });

    expect(fields).toEqual([]);
    expect(dto.email).toBe('reader@example.com');
  });

  it('trims the username and display name', async () => {
    const { dto, fields } = await errorsFor({
      ...valid,
      username: ' Reader_1 ',
      displayName: ' The Reader ',
    });

    expect(fields).toEqual([]);
    expect(dto.username).toBe('Reader_1');
    expect(dto.displayName).toBe('The Reader');
  });

  it.each([
    ['email', { email: 'not-an-email' }],
    ['username', { username: 'ab' }],
    ['username', { username: 'has space' }],
    ['password', { password: 'weakpass' }],
    ['profileUrl', { profileUrl: 'not a url' }],
  ])('rejects an invalid %s', async (field, override) => {
    expect((await errorsFor({ ...valid, ...override })).fields).toContain(
      field,
    );
  });

  it('rejects unknown fields', async () => {
    expect((await errorsFor({ ...valid, passwordHash: 'x' })).fields).toContain(
      'passwordHash',
    );
  });
});

describe('UpdateUserDto', () => {
  it('does not allow changing email or password', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      email: 'new@example.com',
      password: 'Str0ng!Pass',
      bio: 'Hello',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map((e) => e.property).sort()).toEqual(['email', 'password']);
  });
});
