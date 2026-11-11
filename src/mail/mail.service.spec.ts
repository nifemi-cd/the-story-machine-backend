import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

// returns a ConfigService that only knows these values
function configWith(values: Record<string, string>) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('MailService', () => {
  const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  const message = {
    to: 'reader@example.com',
    subject: 'Hello',
    text: 'secret-link',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs the whole email outside production', async () => {
    await new MailService(configWith({})).send(message);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('reader@example.com'),
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('secret-link'));
  });

  it('never logs the body in production', async () => {
    await new MailService(configWith({ NODE_ENV: 'production' })).send(message);

    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.not.stringContaining('secret-link'),
    );
  });
});
