import type { MailMessage, MailService } from '../../src/mail/mail.service.js';

// keeps sent emails in memory instead of logging them, so the e2e tests can
// read what a real user would get in their inbox (like a reset link)
export class FakeMailService implements Pick<MailService, 'send'> {
  // every email sent, oldest first. tests look in here
  readonly sent: MailMessage[] = [];

  // remembers the email
  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  // returns the last email sent to this address, or undefined
  lastTo(to: string): MailMessage | undefined {
    return this.sent.findLast((message) => message.to === to);
  }
}
