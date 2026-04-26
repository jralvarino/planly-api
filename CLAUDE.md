# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

All code, comments, and documentation must be written in English.

## Commands

```bash
# Development (build + run SAM local API on port 3000)
npm run dev

# Build TypeScript
npm run build

# Tests
npm test                  # run all tests
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report (80% threshold enforced)

# Run a single test file
npx vitest run tests/repositories/CategoryRepository.test.ts

# Lint / format
npm run lint
npm run lint:fix
npm run format

# Local DynamoDB + infra
npm run docker:up         # start DynamoDB Local (port 8000)
npm run docker:init-db    # create DynamoDB tables locally

# Deploy to AWS
npm run deploy            # sam build + sam deploy (us-east-1, stack: planly-api)
```

SAM local requires Docker running and the `planly-api_default` Docker network. DynamoDB Local uses shared-db mode (`-sharedDb`).

## Architecture

Planly API is the backend for a habit-tracking app. It is structured as **4 independent Lambda functions** behind a single API Gateway (REST, `prod` stage) with a Lambda Authorizer (from `arj-auth-service`) that validates JWTs and injects `userId` into the request context.

### Lambda Functions

| Function | Triggers |
|---|---|
| `category` | CRUD routes for habit categories |
| `habit` | CRUD routes for habits |
| `todo` | Todo status updates + stats dashboard reads |
| `stats-midnight` | EventBridge schedule — runs daily at 00:01 GMT-3 to recalculate streaks |

### Request Flow

```
API Gateway → Lambda Authorizer (JWT + userId injection)
  → Middy middleware chain:
      captureLambdaHandler → injectLambdaContext → jsonBodyParser
      → httpEventNormalizer → requestLoggingMiddleware → extractUserIdMiddleware
      → globalExceptionHandler → httpRouterHandler (route matching)
  → Controller (per-route Zod validation via zodValidator middleware)
  → Service (business logic, throws typed errors)
  → Repository (DynamoDB via AWS SDK lib-dynamodb)
```

### Layered Structure (`src/`)

- **`handlers/`** — Lambda entry points. Each wraps a Middy middleware chain and delegates to a controller's route array.
- **`controllers/`** — Define routes as `{ method, path, handler }` arrays. Each handler is itself a Middy instance with a `zodValidator` for per-route validation. Resolved data comes from `event.validated`.
- **`services/`** — Business logic. Inject repositories via TSyringe. Throw `NotFoundError`, `ConflictError`, etc. from `common-utils-layer`.
- **`repositories/`** — DynamoDB access using `GetCommand`, `PutCommand`, `QueryCommand`, `DeleteCommand` from `@aws-sdk/lib-dynamodb`. Use the shared `ddb` client from `common-utils-layer`.
- **`schemas/`** — Zod schemas validating `body`, `pathParameters`, and `queryStringParameters`. One schema per operation.
- **`models/`** — Plain TypeScript interfaces (no ORM).
- **`constants/`** — DynamoDB table names (`DYNAMO_TABLES`) and todo status enums (`TODO_STATUS`).

### Dependency Injection

All services and repositories are marked with `@injectable()` (TSyringe). The DI container is configured in `src/container.ts`. Resolve instances with `container.resolve(ServiceClass)` inside handlers/controllers.

### Shared Layer: `common-utils-layer`

Imported as `@arj/common-utils-layer/*`. Provides:
- **Middleware**: `globalExceptionHandler`, `extractUserIdMiddleware`, `requestLoggingMiddleware`, `zodValidator`
- **Response helpers**: `success()`, `created()`, `noContent()`
- **Error classes**: `NotFoundError`, `ConflictError`, `BadRequestError`, `InternalServerError`
- **DynamoDB client**: `ddb` (DocumentClient)
- **Logger**: `createLogger(serviceName)` wrapping AWS Lambda Powertools

### DynamoDB Tables

- `planly-category` — PK: `id`, GSI: `userId-index`
- `planly-habit` — PK: `id`, GSIs: `userId-index`, `userId-start_date-index`
- `planly-todo` — PK/SK composite, GSIs: `habitId-index`, `userId-date-index`
- `planly-stats` — PK/SK composite
- `user` — PK: `userId`

### Testing Conventions

Tests live in `tests/`, mirroring `src/` structure. Use `vi.mock()` to mock `@arj/common-utils-layer/db` (the `ddb` client) and `@arj/common-utils-layer/util` (logger). Instantiate classes directly (no DI container in tests). The path alias `@` maps to `./src`.

### Related Repositories

- `arj-auth-service` — Lambda Authorizer (JWT validation)
- `common-utils-layer` — Shared Lambda layer (imported via `@arj/common-utils-layer`)
- `planly` — React Native frontend
