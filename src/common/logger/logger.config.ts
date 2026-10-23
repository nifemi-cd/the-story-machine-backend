import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';

type Req = IncomingMessage & { id?: unknown; originalUrl?: string };

// returns the url the client actually called
// express changes req.url inside routers (/api/v1/user turns into /user)
// but originalUrl stays as what the client actually called
const urlOf = (req: Req) => req.originalUrl ?? req.url;

// returns the logger settings for nestjs-pino
export function createLoggerParams(options: {
  production: boolean;
  level: string;
}): Params {
  return {
    pinoHttp: {
      level: options.level,
      // pretty logs locally, plain json in production.
      // pino-pretty is a dev dependency so it won't be installed there anyway
      transport: options.production
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:HH:MM:ss',
              messageFormat: '{if context}[{context}] {end}{msg}',
              ignore: 'pid,hostname,context,req,res,responseTime,reqId',
            },
          },

      // not logging headers because they can have tokens/cookies in them
      serializers: {
        req: (req: Req) => ({
          id: req.id,
          method: req.method,
          url: urlOf(req),
        }),
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      },
      quietReqLogger: true,

      // makes failed requests easier to spot
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res, responseTime) =>
        `${req.method} ${urlOf(req)} ${res.statusCode} ${Math.round(responseTime)}ms`,
      customErrorMessage: (req, res, error) =>
        `${req.method} ${urlOf(req)} ${res.statusCode} ${error.message}`,

      // swagger loads a bunch of files every time you open the docs
      autoLogging: {
        ignore: (req) => urlOf(req)?.startsWith('/api/docs') ?? false,
      },
    },
  };
}
