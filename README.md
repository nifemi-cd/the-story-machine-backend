# The Story Machine - Backend

The Story Machine is intended to be a community platform for creating,
publishing, reading, and discussing interactive stories. Readers will be able to
shape stories through their choices, connecting authors and readers around
shared storytelling.

## Project overview

The backend is built with NestJS and TypeScript. It currently provides:

- A root greeting endpoint.
- A versioned user API scaffold with create, list, read, update, and delete
  routes.
- MongoDB connection configuration through `MONGO_URI`.
- Helmet security headers, CORS, and Pino-based application logging.

The user service is currently a scaffold: its methods return placeholder
messages rather than persisting user records. Interactive-story features are
part of the product vision but are not implemented in this API yet.

## Prerequisites

- Node.js 26 or newer
- npm
- A MongoDB instance for running the application (the app reads its connection
  string from `MONGO_URI`)

## Get started

Install dependencies:

```bash
npm ci
```

Create a `.env` file in the project root based on `.env.example`, then set the
values for your local environment:

values for the current enviroment
```dotenv
PORT = <port>
MONGO_URI = <uri>
LOG_LEVEL = info
AZURE_STORAGE_CONNECTION_STRING=<azure connection string>
AZURE_STORAGE_CONTAINER=<azure container string>
```

Start the app in watch mode:

```bash
npm run start:dev
```

The server listens on port `4563` by default, or on the port set in `PORT`.
Routes use the `/api` prefix and URI version `v1`; for example:

- `GET /api/v1` — root greeting
- `POST /api/v1/user` — create-user scaffold
- `GET /api/v1/user` — list-users scaffold
- `GET /api/v1/user/:id` — get-user scaffold
- `PATCH /api/v1/user/:id` — update-user scaffold
- `DELETE /api/v1/user/:id` — delete-user scaffold

## Common commands

| Task | Command |
| --- | --- |
| Start in watch mode | `npm run start:dev` |
| Start normally | `npm run start` |
| Start with debugger and watch mode | `npm run start:debug` |
| Build for production | `npm run build` |
| Run the production build | `npm run start:prod` |
| Run unit tests | `npm test` |
| Run unit tests in watch mode | `npm run test:watch` |
| Run end-to-end tests (in-memory MongoDB, nothing to set up) | `npm run test:e2e` |
| Run unit and end-to-end tests with one coverage report | `npm run test:cov` |
| Lint source and tests | `npm run lint` |
| Lint and fail on warnings | `npm run lint:ci` |
| Check TypeScript types | `npm run typecheck` |
| Format source and tests | `npm run format` |
| Check formatting without changing files | `npm run format:check` |

To prepare and run the production build:

```bash
npm ci
npm run build
npm run start:prod
```

## Project structure

Each feature lives in its own folder under `src/` with the usual Nest layout:
a module, a controller (the routes), a service (the business logic), `dto/`
(request and response shapes, with their validation rules) and `entities/`
(the MongoDB schemas). Unit tests sit next to the file they test as
`*.spec.ts`.

```text
src/
  main.ts                    Starts the app: /api prefix, v1 versioning, Swagger at /api/docs, Helmet, CORS
  app.module.ts              Wires everything together: config, MongoDB, logging, global validation and responses
  app.controller.ts          Root greeting endpoint
  app.service.ts
  user/                      Users: register, list, get and update profiles
    entities/                User schema
    dto/                     Create, update and response shapes
    enums/                   User roles
  story/                     Stories: create, list, get, update, publish and delete,
                             plus uploading and downloading the .txt draft file
    entities/                Story schema, with its characters and chapter order
    dto/                     Create, update, list-query, character and response shapes
    enums/                   Story status (draft or published)
  chapter/                   Chapters of a story, returned in the story JSON format
    entities/                Chapter schema and the typed chapter script (lines, flags, variables)
    dto/                     Create, update, script and response shapes
    check-script.ts          Checks a script before saving: line ids, jumps, flags and characters
  storage/                   Saves and loads files in Azure Blob Storage
  common/                    Shared by every feature
    decorators/              @ResponseMessage, the message sent with a successful response
    dto/                     Pagination query (page, limit)
    exceptions/              AppException, for errors that name the fields at fault
    filters/                 Turns every error into { success: false, message, errors }
    interceptors/            Wraps every success in { success: true, message, data }
    interfaces/              The response and error types
    logger/                  Pino logging setup
    pipes/                   Request validation and MongoDB id checking
    swagger/                 Decorators that describe responses and id params in Swagger
test/
  app.e2e-spec.ts            End-to-end test of the whole app (needs MongoDB)
  fixtures/                  Example stories from our story JSON docs, used as test data
docs/                        Vision statement and sprint deliverables
.github/workflows/ci.yml     CI: lint, format check, tests, build, security audit
Dockerfile                   Container image for deployment
```

## Documentation

- [Vision statement](./docs/vision.md)
- [Sprint 0 deliverables](./docs/sprint0.md)
- [Sprint 1 deliverables](./docs/sprint1.md)

## Group members

- Lara De Leon
- Carsten Kolynchuk
- Colin Leger
- Arthur McMullen
- Krupal Patel
- Adejare Taiwo
- Oluwanifemi Tawoju
