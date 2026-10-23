import { model } from 'mongoose';
import { User, UserSchema } from './user.entity.js';

describe('UserSchema toJSON', () => {
  it('never serializes the password hash or token version', () => {
    const UserModel = model(User.name, UserSchema);
    const user = new UserModel({
      email: 'reader@example.com',
      username: 'Reader_1',
      passwordHash: 'hash',
    });

    const json = JSON.parse(JSON.stringify(user)) as Record<string, unknown>;

    expect(json).toMatchObject({ email: 'reader@example.com' });
    expect(json).not.toHaveProperty('passwordHash');
    expect(json).not.toHaveProperty('tokenVersion');
    expect(json).not.toHaveProperty('__v');
  });
});
