// everyone can read and write stories so there's no reader/author role,
// roles are only for extra permissions
export enum UserRole {
  User = 'user',
  // for moderating later on, nothing uses it yet
  Admin = 'admin',
}
