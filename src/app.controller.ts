import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // returns the hello message, mostly to check the api is up
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
