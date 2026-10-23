import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { StorageService } from '../../src/storage/storage.service.js';
import { FakeStorageService } from './fake-storage.service.js';

export interface TestApp {
  app: INestApplication<App>;
  storage: FakeStorageService;
  clearDatabase: () => Promise<void>;
  close: () => Promise<void>;
}

// returns the running app plus helpers to reset and close it
// starts the full app like main.ts but with an in memory mongo and fake
// storage, so tests never touch real data
export async function createTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();
  // has to be set before the app starts. ConfigModule won't overwrite env vars that are already set
  process.env.MONGO_URI = mongo.getUri();
  // otherwise every request gets logged in the test output
  process.env.LOG_LEVEL = 'silent';

  const storage = new FakeStorageService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  configureApp(app);
  await app.init();

  const connection = app.get<Connection>(getConnectionToken());

  return {
    app,
    storage,
    clearDatabase: async () => {
      // deleteMany instead of dropping the db because dropping also removes the unique indexes
      await Promise.all(
        Object.values(connection.collections).map((c) => c.deleteMany({})),
      );
      storage.files.clear();
    },
    close: async () => {
      await app.close();
      await mongo.stop();
    },
  };
}
