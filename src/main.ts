import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ApiErrorDoc } from './common/swagger/api-response.docs.js';

// creates the app, sets it up and starts the server
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // hold the startup logs until pino is set up below, otherwise they print in nest's format
    bufferLogs: true,
  });

  // in its own file so the e2e tests can use the same /api/v1 setup
  configureApp(app);

  // swagger docs at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('The Story Machine API')
    .setVersion('1')
    // any route can crash so the 500 is added to all of them here instead of one by one
    .addGlobalResponse({
      status: 500,
      description: 'Unexpected server error',
      type: ApiErrorDoc,
      example: { success: false, message: 'Internal server error' },
    })
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  app.use(helmet());

  // so nest's own logs use pino too and everything looks the same
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(
    `Listening on http://localhost:${port}/api (docs at /api/docs)`,
    'Bootstrap',
  );
}
await bootstrap();
