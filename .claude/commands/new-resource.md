Generate all files for a new resource in the Planly API following the existing layered architecture.

Resource name (PascalCase for classes, camelCase/kebab-case where appropriate): $ARGUMENTS

Generate the following files, strictly following the patterns from the `category` resource as reference:

## 1. `src/models/{Resource}.ts`
Plain TypeScript interface with: `id`, `userId`, `createdAt`, `updatedAt`, plus any domain-specific fields that make sense for the resource.

## 2. `src/schemas/{resource}.schemas.ts`
Zod schemas for each CRUD operation using `z.object()`. Each schema validates only the fields relevant to that operation (`body`, `pathParameters`, `queryStringParameters`). Export one named schema per operation: `create{Resource}Schema`, `update{Resource}Schema`, `get{Resource}ByIdSchema`, `delete{Resource}Schema`.

## 3. `src/repositories/{Resource}Repository.ts`
- Decorated with `@injectable()` from `tsyringe`
- Import `ddb` from `@arj/arj-common-utils/db` and `createLogger` from `@arj/arj-common-utils/util`
- Import table name from `DYNAMO_TABLES` in `src/constants/todo.constants.ts` (add the new table constant there too)
- Implement: `create`, `update`, `findById`, `findAllByUserId`, `delete`
- Use `GetCommand`, `PutCommand`, `QueryCommand`, `DeleteCommand` from `@aws-sdk/lib-dynamodb`
- `findAllByUserId` queries the `userId-index` GSI with `ScanIndexForward: false`
- `create` uses `ConditionExpression: "attribute_not_exists(id)"`
- Add `logger.debug` calls matching the pattern in `CategoryRepository`

## 4. `src/services/{Resource}Service.ts`
- Decorated with `@injectable()` from `tsyringe`
- Constructor injects `{Resource}Repository` via DI
- Import error classes from `@arj/arj-common-utils/error`: `NotFoundError`, `ConflictError`
- Implement: `create`, `getById`, `getAll`, `update`, `delete`
- In `create` and `update`: check for name conflicts and throw `ConflictError` if found
- In `getById`, `update`, `delete`: throw `NotFoundError` if not found or `userId` mismatch
- Add `logger.warn` for conflict/not-found cases and `logger.debug` for success
- Format response with capitalized name (follow `formatCategoryForResponse` pattern)

## 5. `src/controllers/{resource}.controller.ts`
- Import schemas and service
- Resolve service with `container.resolve({Resource}Service)`
- Define typed `EventWithUser` as `APIGatewayProxyEvent & WithUserId`
- Create one `middy()` handler per route, each with `.use(zodValidator(schema))` before `.handler(...)`
- Extract data from `event.validated` with inline type assertion
- Use `created()` for POST, `success()` for GET/PUT, `success({ message })` for DELETE
- Export `routes` array of `Route<APIGatewayProxyEvent, APIGatewayProxyResult>[]`
- Path prefix: `/planly/{resource-plural}`

## 6. `src/handlers/{resource}/index.ts`
Copy the exact Middy middleware chain from `src/handlers/category/index.ts`, importing from the new controller.

## 7. Update `src/container.ts`
Add `registerSingleton` calls for `{Resource}Repository` and `{Resource}Service`, following the existing ordering pattern (repositories first, then services).

## 8. Update `src/constants/todo.constants.ts`
Add the new table name to `DYNAMO_TABLES`: key in SCREAMING_SNAKE_CASE, value as `"planly-{resource}"`.

---

After generating all files, list what still needs manual configuration:
- SAM template (`infrastructure/aws/template.yaml`): new Lambda function, DynamoDB table, IAM policy, environment variable
- OpenAPI definition (`infrastructure/aws/openapi.yaml`): new route entries
- Tests: suggest test file paths to create following `tests/repositories/` and `tests/services/` patterns
