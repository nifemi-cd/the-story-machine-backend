# Sprint 1

## 1 Sprint Summary

## 2 Testing Status

### Front end testing

We tested the Angular client with **Vitest** and Angular's **TestBed**, running in **jsdom** which is essentially a browser that is a simulation that runs in Node. The backend(HTTP calls) has been mocked using `provideHttpClientTesting()` and `HttpTestingController`. This lets us test and check every request that the webapp sends and controls the response including errors.

#### Unit Tests

These unit tests checks every part of a function on its own, it uses a mocked backend. This helps us know exactly which part is broken in the code.

We tested 3 kinds of units: a service, the pages and a component

- **`story.service.spec.ts`**: We tested on getting data from the backend, made sure that the stories show their correct author, chapters and title and lines.
- **`story-preview.spec.ts`**: This tests the popup that shows a story's detail that is shown in the card. it makes sure the popup opens when a story is clicked and closes when we click outside of it.
- **`landing.spec.ts`**: This tests the homepage of the website, it test to see if the cards show for each story.
- **`reader.spec.ts`**: THis test checks the reader page where you read the story. It makes sure the lines pop up 1 by 1 with the speaker's name for dialogue.
- **`app.spec.ts`**: This checks if the webapp starts properly.

#### Integration Tests

These tests check the the different parts of the webapp works together, the backend is mocked.

**Boundaries we test:**

- **Client and API**: The 'StoryServices' sends requests to the backend,`HttpTestingController` answers them just like the API would. This way we check that the app is sending the right rewuest and it handles the responses along with any error encountered.
- **Router and pages**: THis tests the routes that checks that the links are going to the correct places.
- **Component and component**: This tests the story popup works like the real homepage, it checks the opening and closing of it.

**What we test** (`app.integration.spec.ts`):

- **Reading a story from start to end**: We tested this like a user would, go through the entire app. Going to the homepage, clicking a story's link, and clicking till it ends.
- **Opening a story link directly**: We tested by directly opening the story link, so we woudn't have to go through the homepage. THis way a user could jump straight into reading.
- **Backend errors**: These tests send teh backend an error, this way we test that the homepage and reader show the correct error response to it.

### Back end testing

We tested the NestJS API with **Vitest** and Nest's testing module (`@nestjs/testing`), which builds just the parts of the app a test needs. In unit tests the MongoDB models are replaced with mocks, so the tests run without a database and we control exactly what each query returns, including "not found" results and database errors. The end-to-end tests use **supertest** to send real HTTP requests to the whole app, running against an in-memory MongoDB (**mongodb-memory-server**).

| Command            | What it runs                                                              |
| ------------------ | ------------------------------------------------------------------------- |
| `npm test`         | The unit tests                                                            |
| `npm run test:e2e` | The end-to-end tests (nothing to set up, they start their own MongoDB)    |
| `npm run test:cov` | Both, with one coverage report for the whole backend (this is what CI runs) |

At the end of Sprint 1 we have **221 tests**: 158 unit tests in 18 files and 63 end-to-end tests in 4 files. All of them pass, and together they cover **98.9% of the backend's lines**.

#### Unit Tests

These check each part of the backend on its own, mostly the services (the business logic) and the DTOs (the rules for what a request body may contain).

- **Stories** (`story.service.spec.ts`, `create-story.dto.spec.ts`, `story.entity.spec.ts`): creating a story only when its author exists, listing stories a page at a time with author and status filters, publishing and unpublishing (which sets or clears `publishedAt`), every character getting a `default` emotion, uploading and downloading the story's `.txt` draft, and deleting a story together with its chapters and draft file. The DTO tests check which fields a client may send, for example that `status` and `likeCount` can't be set when creating a story and that two characters can't share a name.
- **Chapters** (`chapter.service.spec.ts`, `create-chapter.dto.spec.ts`): adding a chapter to the end of its story (and taking it back out if saving fails), returning chapters in the agreed story JSON shape, renaming, and deleting a chapter, which moves the later chapters up one place so the reading order has no gaps.
- **Chapter scripts** (`check-script.spec.ts`): the checks a script must pass before it is saved. Each line has exactly one kind (dialogue, prose, choice, background, goto_line or end), `line_id` matches the line's position, every jump and flag points to a real line, and dialogue only uses the story's characters and their emotions.
- **Users** (`user.service.spec.ts`, `create-user.dto.spec.ts`, `user.entity.spec.ts`): registering with a hashed password, rejecting taken emails and usernames with a 409 (case-insensitively, and also when two sign-ups race each other), paging through users and updating profiles. The DTO tests cover the email, username and strong-password rules.
- **File storage** (`storage.service.spec.ts`): saving, reading and deleting draft files in Azure Blob Storage, with Azure's client replaced by a mock so the tests never contact Azure. They also check that deleting a file that's already gone is fine, and that any other delete failure is logged rather than ignored, so a leftover file can be found and cleaned up.
- **Shared pieces** (`src/common`): the response wrapper that puts every reply in `{ success, message, data }`, the error filter that turns every error into the same shape (and hides the details of unexpected errors), the pipe that rejects invalid ids, and the pagination defaults and limits.

#### Contract Tests

The frontend's reader and the backend have to agree on the story JSON format, so we used the two examples from our story JSON documents ("The Lion at the Door" and the sprint 1 Team Beluga example) as test data (`test/fixtures/story-json.ts`). The tests check that both examples pass validation and that a saved chapter comes back **exactly** as the agreed JSON, with no extra or missing fields. If either side's format changes, these tests fail.

#### End-to-End Tests

These start the whole app exactly as it runs for real (the same modules, validation, response format and `/api/v1` URLs) and send real HTTP requests to every route. Each test starts with an empty database: a throwaway in-memory MongoDB, with Azure storage replaced by an in-memory fake (`test/support/`), so the tests need no secrets or internet and never touch our real data. That also means they run in CI.

- **Users** (`user.e2e-spec.ts`): registering, duplicate emails and usernames, weak passwords, paging through users and updating profiles (email and password can't be changed there), and that a password is never sent back.
- **Stories** (`story.e2e-spec.ts`): creating, listing and filtering, publishing and unpublishing, deleting, and the draft file: uploading a `.txt`, replacing it, downloading it as plain text, and rejecting a missing file, a file that isn't plain text and a file over 10 MB.
- **Chapters** (`chapter.e2e-spec.ts`): adding a chapter with and without its script, getting it back in the story JSON format, rejecting invalid scripts, saving a new script (the "Lion at the Door" example), renaming (which also updates the story's `chapterOrder`), deleting a chapter (later chapters move up), and that a chapter can't be reached through a different story.
- **App** (`app.e2e-spec.ts`): the root route (`GET /api/v1`) answers in the `{ success, message, data }` wrapper.

Across these, the tests also check invalid ids (400), missing records (404) and fields a client isn't allowed to send.

#### Gaps

- There is no minimum coverage that CI enforces yet.
- The tests replace Azure with a mock or a fake, so nothing checks our code against the real Azure Blob Storage.

## 3 CI Status

While we've split up our project across two repositories, both of them have CI set up the same way:

| Repository | CI workflow                                                                                                         | Run history                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Frontend   | [`.github/workflows/ci.yml`](https://github.com/laradeleon/the-story-machine/blob/develop/.github/workflows/ci.yml) | [Actions](https://github.com/laradeleon/the-story-machine/actions/workflows/ci.yml) |
| Backend    | [`.github/workflows/ci.yml`](https://github.com/nifemi-cd/the-story-machine/blob/develop/.github/workflows/ci.yml)  | [Actions](https://github.com/nifemi-cd/the-story-machine/actions/workflows/ci.yml)  |

In both repositories, we check our code at two points: on our own machines when we commit and also on GitHub when we open a PR.

#### 1. Before every commit (Husky)

When any of us runs `git commit`, a pre-commit hook runs automatically on our own machine. We set this up with Husky and lint-staged (the hook is in `.husky/pre-commit` and its settings are under `"lint-staged"` in `package.json`). It only looks at the files being committed, runs our linter over them and formats them with **Prettier**.

#### 2. On pull requests (GitHub Actions)

On GitHub Actions, each repository has a workflow called **CI**. It runs whenever one of us opens or updates a pull request into `develop`, `staging` or `main`, and again whenever something is pushed or merged into those branches. It checks the whole project in this order:

1. **Install** (`npm ci`): installs the package versions in `package-lock.json`.
2. **Lint** (`npm run lint` / `npm run lint:ci`)
3. **Format check** (`npm run format:check`): makes sure the code follows our Prettier style.
4. **Tests**: the frontend runs its Vitest tests once. The backend runs its unit and end-to-end tests together with a coverage report (`npm run test:cov`).
5. **Build** (`npm run build`): makes sure the project actually compiles.
6. **Security audit** (`npm audit --omit=dev --audit-level=high`): fails if a package that ships to users has a vulnerability.

**Why this trigger:** we picked **pull requests** because that's where we review each other's work, so every change gets checked before it's merged into a shared branch. It also runs on **pushes to the shared branches**, so we know `develop`, `staging` and `main` stay working after a merge. We chose not to run it on every push to our personal branches since the pre-commit hook already covers that work.

**Why both the hook and CI:** the commit hook is fast and lets us catch problems early, however, it can be skipped. For example, editing a file directly on GitHub's website doesn't run it. So the GitHub Actions CI is our other safety net that checks everything.

**As the pipeline matures:** we plan to add some more checks:

- **Coverage threshold:** make CI fail if test coverage drops below a set percentage
- **Frontend end-to-end tests in CI:** the backend's end-to-end tests already run in CI, so the next step is a frontend job that runs browser tests (through Playwright for example)

## 4 API Documentation

The backend API is documented with **Swagger**. Every route, request body, field rule and possible response is described there, with examples, and requests can be sent straight from the page. So this means the backend would need to be built to access the swagger documentation through a url. Steps listed below are the same steps to build and run the backend project

### Running it locally

1. Install **Node.js 26** (the version is in `.nvmrc`; with nvm, run `nvm use`).
2. In the backend repository, install the dependencies:

   ```bash
   npm ci
   ```

3. Copy `.env.example` to `.env` and fill in the values. Ask a teammate for them; they aren't committed to the repository.

   | Variable                          | What it is                                                                  |
   | --------------------------------- | --------------------------------------------------------------------------- |
   | `PORT`                            | Port the server listens on, e.g. `4563`                                     |
   | `MONGO_URI`                       | MongoDB connection string                                                   |
   | `LOG_LEVEL`                       | How much to log, e.g. `info`                                                |
   | `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage connection string, where story draft files are saved. Required: the server won't start without it |
   | `AZURE_STORAGE_CONTAINER`         | Blob container for the files (`stories` if left out)                        |

4. Start the server:

   ```bash
   npm run start:dev
   ```

5. Open **`http://localhost:<PORT>/api/docs`** in a browser, e.g. `http://localhost:4563/api/docs`.

### Using the Swagger page

- Routes are grouped into **Users**, **Stories** and **Chapters**. Click a route, then **Try it out**, fill in the parameters or body, and **Execute**.
- **Server response** shows what actually came back from the request you just sent. **Responses** below it lists every response the route *can* return, whatever happened in your request.
- Every response is wrapped the same way. A success looks like `{ "success": true, "message": "Story created", "data": { ... } }`, and an error looks like `{ "success": false, "message": "Validation failed", "errors": [{ "field": "title", "message": "...", "success": false }] }`.
- There's no login yet, so creating a story takes the author's user id (`authorId`) in the request body.

**Creating a readable chapter** takes three requests, in order: create the story with its characters (`POST /api/v1/story`), add a chapter with its parsed script (`POST /api/v1/story/{storyId}/chapter`), then fetch the chapter (`GET /api/v1/story/{storyId}/chapter/{id}`), which returns it in the story JSON format the reader plays.

## 5 Architecture

## 6 Deployment

Deployment is partially complete. The backend is live on Azure Container Apps at a public HTTPS URL, but deployment is still manual and the CD pipeline is not finished. We provisioned the resource group, container registry, and Container Apps environment, created the container app with ingress, and confirmed the URL serves over a managed certificate. Three environment-specific obstacles worth recording: Azure’s region policy on student subscriptions rejected both canadacentral and eastus, so we settled on westus; the CLI provisioned an “express” environment by default, which does not support managed-identity authentication to the registry, and resolving it required installing the preview containerapp extension and recreating the environment with --environment-mode WorkloadProfiles; and a startup-probe failure traced to a mismatch between the configured target port and the port the container actually listened on.

What is outstanding is continuous deployment. Connecting GitHub Actions to Azure via OIDC federated credentials requires registering an application in Entra ID, which the University of Manitoba tenant does not permit for student accounts. We have moved the deployment into a teammate’s Azure for Students subscription, where Paul holds Owner access, and the frontend’s deployment and CD setup is in progress. Until that lands, deploying means running az acr build and az containerapp update by hand, so a working URL exists but no push-to-deploy pipeline does. Secrets are configured through Container Apps secrets rather than baked into the image, and MongoDB Atlas remains the database, reachable from the container app over the public endpoint.

## 7 Reflection

As a group, we are proud of the progress that we made for Sprint 1, and the feature that we are particularly proud of is the story reading feature. It’s one of our primary user facing features and its development also heavily depended on the parser, which we identified as a major bottleneck early on since a lot of our project’s functionality relied on it being completed first. Being able to complete the reader and the parser represents significant progress for our Sprint 1 and gives us a strong foundation to work on for Sprint 2.

One area that could have been improved was the writing feature. We underestimated the amount of effort that it would require to learn, integrate and build around CodeMirror, which introduced additional complexity that affected our development time. As a result, we weren’t able to implement the writing functionality to the extent that we had originally envisioned for this sprint. However, despite this challenge, we now have a much better understanding of this process and the remaining work we need to complete and we plan to continue refining and expanding the writing feature for Sprint 2.

Our testing was done primarily after implementation. Our initial focus was on ensuring that our core functionality was working before dedicating time to write tests and fix issues that were discovered during development. Having a more test driven approach may have helped us catch some problems earlier, however our main priority was establishing a functional foundation given the scope of our project and any time constraints. As our project matures, we do expect testing to become a more integrated part of our development process.

Our team working agreement is still valid. While our Git branching strategy was followed somewhat more loosely than we originally planned, we were careful when we were integrating changes and communicated regularly to avoid conflicts. We were responsible when it came to always pulling in the latest changes. Additionally, the repository management and pull request tools we used also provided us with some safeguards to reduce the risk of any major integration problems.

## 8 Known Issues *

| Issue                           | Description                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Writing functionality not added | The writer page required much more overhead than expected to be able to start, thus was not included in this sprint                 |
| Application not deployed        | Much more of the time was dedicated to development of the api/backend. However the deployment process was started but not completed |
|                                 |                                                                                                                                     |
