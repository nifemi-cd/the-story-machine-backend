// what goes inside a login token
export interface JwtPayload {
  // the user's id
  sub: string;
  // has to match the user's tokenVersion or the token is rejected, so
  // increasing tokenVersion logs the user out everywhere
  tokenVersion: number;
}
