import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { UserRole } from '../enums/user-role.enum.js';

// one account can both read and write stories, roles is only for admin stuff
@Schema({ timestamps: true })
export class User {
  // lowercased so Ada@Example.com and ada@example.com count as the same email
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // the unique check is done by the index at the bottom so it can ignore case
  @Prop({ required: true, trim: true })
  username: string;

  // select false keeps it out of normal queries, login will need .select('+passwordHash')
  @Prop({ required: true, select: false })
  passwordHash: string;

  // goes into every login token, increasing it logs the user out everywhere
  // (resetting the password does this)
  @Prop({ default: 0 })
  tokenVersion: number;

  // only the sha256 of the reset token is saved, so someone who can read the
  // database still can't use it. select false like passwordHash
  @Prop({ select: false })
  passwordResetTokenHash?: string;

  // the reset token stops working after this
  @Prop({ select: false })
  passwordResetExpiresAt?: Date;

  @Prop({ trim: true })
  displayName: string;

  // never set from a request, admins get added manually
  @Prop({ type: [String], enum: UserRole, default: [UserRole.User] })
  roles: UserRole[];

  @Prop({ maxlength: 500, default: '' })
  bio: string;

  @Prop({ default: '' })
  profileUrl: string;

  // kept as numbers so profiles don't have to count rows every time
  // (following isn't built yet)
  @Prop({ default: 0, min: 0 })
  followerCount: number;

  @Prop({ default: 0, min: 0 })
  followingCount: number;

  // mongoose sets these because of timestamps true
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// strength 2 means compare ignoring case. any query on username has to use
// this same collation or it won't match the index
export const USERNAME_COLLATION = { locale: 'en', strength: 2 };

UserSchema.index(
  { username: 1 },
  { unique: true, collation: USERNAME_COLLATION },
);

// resetting a password looks the user up by this. sparse because most users
// don't have a reset token, so they're left out of the index
UserSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

// select false doesn't apply to what create() returns, so we also strip
// the hash here to make sure it never ends up in a response
UserSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    const {
      passwordHash: _passwordHash,
      tokenVersion: _tokenVersion,
      passwordResetTokenHash: _passwordResetTokenHash,
      passwordResetExpiresAt: _passwordResetExpiresAt,
      ...safe
    } = ret;
    return safe;
  },
});
