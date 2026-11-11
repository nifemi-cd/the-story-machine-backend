import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// one email to send. plain text only for now
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

// Keeps all the email code in one place, so any feature that needs to send
// an email (password reset, notifications later on) just calls send().
// We don't have an email service yet, so for now it only logs the email
// outside production so flows like password reset can be tested locally.
// Plugging in a real provider later only means changing send().
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly production: boolean;

  constructor(configService: ConfigService) {
    this.production = configService.get('NODE_ENV') === 'production';
  }

  // "sends" the email
  send({ to, subject, text }: MailMessage): Promise<void> {
    // never log the body in production, emails can hold things like reset
    // links that anyone reading the logs could use
    if (this.production) {
      this.logger.warn(
        `No email service set up, "${subject}" to ${to} was not sent`,
      );
    } else {
      this.logger.log(`Email to ${to}: ${subject}\n${text}`);
    }
    return Promise.resolve();
  }
}
