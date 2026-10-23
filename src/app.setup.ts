import { VersioningType, type INestApplication } from '@nestjs/common';

// sets the /api prefix and v1 versioning
// used by main.ts and the e2e tests so both get the same /api/v1 urls
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
}
