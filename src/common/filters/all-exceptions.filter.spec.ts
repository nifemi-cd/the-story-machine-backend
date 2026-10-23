import {
  BadRequestException,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import { AppException } from '../exceptions/app.exception.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

// fake request/response so we can see what the filter sends
function httpHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: '/api/v1/user' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('returns an AppException message and field errors', () => {
    const { host, status, json } = httpHost();

    filter.catch(
      AppException.conflict('Email is already in use', [
        { field: 'email', message: 'Email is already in use', success: false },
      ]),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Email is already in use',
      errors: [
        { field: 'email', message: 'Email is already in use', success: false },
      ],
    });
  });

  it('leaves out errors when there are none', () => {
    const { host, json } = httpHost();

    filter.catch(AppException.conflict('Already exists'), host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Already exists',
    });
  });

  it('uses the status and message of built-in Nest exceptions', () => {
    const { host, status, json } = httpHost();

    filter.catch(new NotFoundException('Cannot GET /nope'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Cannot GET /nope',
    });
  });

  it('joins array messages from built-in exceptions', () => {
    const { host, json } = httpHost();

    filter.catch(new BadRequestException(['a is bad', 'b is bad']), host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'a is bad; b is bad',
    });
  });

  it('hides the message of unexpected errors', () => {
    const { host, status, json } = httpHost();
    vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

    filter.catch(new Error('secret connection string'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
    });
  });
});
