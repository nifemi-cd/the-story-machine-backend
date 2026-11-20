# Regression Testing & Known Testing Gaps (Backend)

## 1 What our regression suite is

Our regression suite is **the whole backend test suite**, run with one command:

```
npm run test:cov
```

This runs both groups of tests together and produces one coverage report:

| Group     | Files | Tests   | What it checks                                                                                                                                                                                 |
| --------- | ----- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | 25    | 208     | One service, controller, guard, DTO or schema at a time, with MongoDB, Azure and email replaced by mocks                                                                                        |
| End-to-end | 5    | 111     | The whole app started the way it runs in production, sent real HTTP requests to every route, against a throwaway in-memory MongoDB with fake file storage and email (`test/support/`)             |
| **Total** | **30** | **319** |                                                                                                                                                                                                |

The end-to-end tests cover auth (login, `/me`, forgot and reset password), users, stories, chapters and the root route. Across them, they check the error cases as well as the happy path: invalid ids (400), not logged in (401), someone else's story or chapter, or a non-admin on an admin route (403), missing records (404) and fields a client isn't allowed to send.

In CI, the regression suite runs together with the other checks that catch regressions: lint, format check, type check (`tsc`), the production build and `npm audit`.

## 2 How we chose which tests to run

We run **every test, every time**, instead of picking a subset based on what changed. We chose this because:

- **It's fast.** The full suite takes about **25–30 seconds**, so there's no real time to save by skipping tests.
- **Picking a subset is risky in our code.** Many of our routes share code: the response wrapper, the exception filter, the auth and role guards and the validation pipes. A change to one file can break routes that don't look related. Running everything means we don't have to predict which tests a change could affect.
- **The end-to-end tests need no setup.** They start their own MongoDB and replace Azure and email with fakes, so they need no secrets or internet and can run on every CI run like the unit tests.

**How the suite grows:** when we fix a bug, we add a test that would have caught it, so the same bug can't come back without a test failing. Two recent examples:

- **Author info on stories** (PR #27): added unit tests in `story.service.spec.ts` and end-to-end tests in `story.e2e-spec.ts` checking that a story response includes its author.
- **Public profiles** (PR #30): added tests in `user.service.spec.ts` and `user.e2e-spec.ts` for looking up another user's public profile.

## 3 When it runs

| When                                                                  | What runs                                                                    | Where                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------- |
| On every `git commit`                                                  | Lint and Prettier on the staged files only (no tests, to keep commits fast)   | Our own machine (Husky)   |
| Whenever we want while developing                                      | `npm test`, `npm run test:e2e` or `npm run test:cov`                          | Our own machine           |
| Every pull request into `develop`, `staging` or `main`, and every update to it | Full CI: lint, format, type check, **full regression suite with coverage**, build, `npm audit`, Docker build | GitHub Actions (`ci.yml`) |
| Every push or merge into `develop`, `staging` or `main`                 | The same full CI again, so the shared branches stay working after a merge     | GitHub Actions (`ci.yml`) |
| After CI passes on `main`                                              | Deploy to Azure, then a smoke test against the live API                       | GitHub Actions (`cd.yml`) |

## 4 How long it takes

- **Regression suite alone:** about **25–30 seconds** on a laptop (`npm run test:cov`: 319 tests in 30 files). The tests run in parallel, so the total test time (about 75–85 seconds) is spread across several CPU cores. The first run on a new machine is slower because it has to download the in-memory MongoDB binary.
- **Full CI job on GitHub Actions** (install, lint, format, type check, tests, build, audit): about 2Mins per run, show on each run on the [Actions page](https://github.com/nifemi-cd/the-story-machine-backend/actions/workflows/ci.yml).

Since a full CI run takes about 2 minutes, running the whole suite on every pull request costs us very little. If the suite grows enough to slow down reviews, we plan to run only the fast unit tests on every PR update and keep the full suite for merges into staging and main

## 5 What happens when a test fails

1. **The CI run fails.** Any failed step (a test, lint, type check, build or audit) marks the run red, and GitHub shows which step and which test failed.
2. **The pull request can't be merged.** We set up a GitHub ruleset that requires CI to pass before a PR can be merged into `main`, `develop` and `staging`. A failing test blocks the merge; it isn't just a warning.
3. **The author fixes it on their branch.** They reproduce it locally with the same command CI uses (`npm run test:cov`, or `npx vitest run <file>` for a single file), push a fix, and CI runs again automatically on the updated PR.
4. **Broken code can't reach production.** The deploy workflow (`cd.yml`) only starts after CI has **passed** on `main`, and it deploys the exact commit CI tested. If CI fails on `main`, nothing is deployed.
5. **If a deploy itself is broken, we find out.** After deploying, a smoke test calls the live API's root route (`GET /api/v1`) up to 10 times over about 2 minutes. If it never answers, the deploy run fails.

## 6 Recent results

- **Latest local run (20/11/2026):** 30 test files, **319 / 319 tests passed** in 24.9 s.
- **Latest CI run:** [CI run](https://github.com/nifemi-cd/the-story-machine-backend/actions/runs/44487709155) 

Every CI run now posts its **coverage table on the run's summary page**, and the full HTML coverage report can be downloaded from that run as the `coverage-report` artifact (kept for 30 days). Each run has its own evidence; nobody has to copy numbers in by hand.

## 7 Coverage and what it tells us

Coverage counts every file in `src/`, including files no test loads, so the percentage isn't inflated by leaving files out. Only `main.ts` is excluded: it just starts the server, and the end-to-end tests run the same setup through `app.setup.ts`.

| Metric     | Covered   | %          |
| ---------- | --------- | ---------- |
| Lines      | 630 / 637 | **98.9%**  |
| Statements | 645 / 655 | **98.5%**  |
| Functions  | 169 / 173 | **97.7%**  |
| Branches   | 264 / 306 | **86.3%**  |

**What the numbers mean:**

- **Almost all of our own logic runs in at least one test.** Only 7 lines in the whole backend never run, and every route is exercised end to end, including its error cases.
- **Branch coverage (86%) is lower, but mostly not because of missing tests.** Most of the uncovered "branches" are in DTOs, schemas and classes marked `@Injectable()`, which show exactly 50% branches. These aren't `if` statements we wrote; they're extra code TypeScript generates for decorators, which no test can reach in a meaningful way.
- **The real untested lines are mostly code that's hard to trigger on purpose:**
  - `all-exceptions.filter.ts` and `response.interceptor.ts`: the "not an HTTP request" check. We only serve HTTP right now (no websockets or queues), so this can't happen yet.
  - `story.service.ts`: two "story not found" checks for when a story is deleted *while* another request is deleting it or uploading its draft. These cover race conditions that a normal test doesn't create.
  - `logger.config.ts` (80% lines, our lowest file): the log message for a request that throws a low-level error. Our exception filter turns errors into normal responses first, so this rarely runs.
- **High coverage doesn't mean everything is tested.** Coverage shows that code *ran*, not that it works against the real services. Our tests replace Azure, email and our production MongoDB with fakes, so those connections aren't covered by any of these numbers. The next section lists them.

## 8 Known gaps and next steps

| Gap | Why it matters | Why it isn't tested yet | Next step |
| --- | -------------- | ----------------------- | --------- |
| **Real Azure Blob Storage** | Story drafts are stored there. A wrong container name, permission or SDK change would only show up in production. | Tests use a mock (unit) or an in-memory fake (`fake-storage.service.ts`, e2e) so they need no secrets or internet. | Run the storage tests against **Azurite** (Microsoft's local Azure Storage emulator) as a Docker service in CI. |
| **Sending real email** | Password reset depends on the email reaching the user. | We don't have an email provider yet: `MailService` only logs the email, and tests use `fake-mail.service.ts`. | Once we choose a provider, add a test that sends through its sandbox or test mode. |
| **Frontend and backend together** | Each side tests against its own idea of the other. If the frontend and backend drift apart, both test suites can still pass. | The frontend mocks the API; the backend checks the story JSON format against shared example fixtures (`test/fixtures/`), which only covers that format. | Add browser tests (e.g. Playwright) that run the real frontend against a running backend. |
| **Production MongoDB** | The in-memory MongoDB may be a different version from production and can behave differently (e.g. indexes, unique constraints under load). | An in-memory database keeps tests fast and isolated, with no shared state. | Pin the in-memory MongoDB version to match production. |
| **Real expired tokens** | Logins expire; a wrong expiry setting would log users out too early or never. | Expired tokens are only tested with a mock in `jwt-auth.guard.spec.ts`; the e2e tests cover missing and invalid tokens but not a real expired one. | Add an e2e test that signs a token with a very short expiry and checks that it's rejected with a 401. |
| **Performance** | Our Sprint 0 performance expectations aren't measured anywhere. | Our time has gone to correctness first. | Add a small load test (e.g. k6 or autocannon) for the busiest read routes (story list and reading a chapter), and compare against our Sprint 0 targets. |
| **No minimum coverage enforced** | Coverage could drop without CI failing. | We decided not to add a threshold. Our coverage is high and reviewed on each run's summary page, and we didn't want small refactors to fail CI over a fraction of a percent. | We keep an eye on the coverage table that CI posts on each run, and check it during PR review. |
