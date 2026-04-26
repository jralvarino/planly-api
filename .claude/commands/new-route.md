Add a new route to an existing resource in the Planly API.

Arguments (format: `{resource} {METHOD} {/path} {handlerName}`):
$ARGUMENTS

Example: `category GET /planly/categories/{id}/summary getCategorySummary`

## Steps

### 1. Create the Zod schema in `src/schemas/{resource}.schemas.ts`

Add a new exported schema named `{handlerName}Schema`. Infer what fields to validate from the HTTP method and path:
- Path parameters `{param}` → validate in `pathParameters`
- POST/PUT bodies → validate in `body`
- GET with filters → validate in `queryStringParameters`
- DELETE with id → validate `pathParameters.id`

Follow the existing schemas in the file exactly — use `z.object()` with only the fields relevant to this operation.

### 2. Add the handler to `src/controllers/{resource}.controller.ts`

Insert a new `const {handlerName} = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()` block:
- If the route validates input: `.use(zodValidator({handlerName}Schema))` before `.handler(...)`
- Extract data from `event.validated` with an inline type assertion (follow the pattern of existing handlers in the same file)
- Call the appropriate service method (if it doesn't exist yet, note it needs to be created)
- Return: `created()` for POST, `success()` for GET/PUT, `success({ message })` for DELETE
- Add the schema import at the top of the file

Add the new route entry to the exported `routes` array:
```ts
{
    method: "{METHOD}",
    path: "{/path}",
    handler: {handlerName},
}
```

### 3. If the service method doesn't exist yet

Add a stub to `src/services/{Resource}Service.ts` with the correct signature, `@injectable` already in place. Include parameter validation (`NotFoundError`, `ConflictError`) following the existing service methods pattern.

### 4. Summary

After the edits, report:
- Files modified
- Whether a new service method was needed
- Any DynamoDB query patterns that might need to be added to the repository
