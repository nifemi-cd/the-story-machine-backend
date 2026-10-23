import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // returns the hello message
  getHello(): string {
    return 'Hello World, how are you today?!';
  }
}
