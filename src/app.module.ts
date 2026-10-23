import { Logger, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './user/user.module.js';
import { StoryModule } from './story/story.module.js';
import { ChapterModule } from './chapter/chapter.module.js';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { createValidationPipe } from './common/pipes/validation.pipe.js';
import { createLoggerParams } from './common/logger/logger.config.js';

@Module({
  imports: [
    // isGlobal so every module can use ConfigService without importing it
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createLoggerParams({
          production: configService.get('NODE_ENV') === 'production',
          level: configService.get<string>('LOG_LEVEL') ?? 'info',
        }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        connectionFactory: (connection) => {
          const logger = new Logger('MongoDB');
          if (connection.readyState === 1) {
            logger.log(
              `Connected to MongoDB: ${connection.host}:${connection.port}/${connection.name}`,
            );
          }
          connection.on('connected', () => logger.log('Connected'));
          connection.on('disconnected', () => logger.warn('Disconnected'));
          connection.on('error', (err: Error) => logger.error(err.message));
          return connection;
        },
      }),
    }),
    UserModule,
    StoryModule,
    ChapterModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // registering these here instead of main.ts means the e2e tests get them
    // too, since the tests build the app from AppModule
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
