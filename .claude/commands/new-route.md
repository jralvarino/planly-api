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

Add it to `src/services/{Resource}Service.ts` with the correct signature, following the existing methods pattern. Include ownership validation (`NotFoundError` when not found or userId mismatch) and conflict checks (`ConflictError`) where applicable.

### 4. Update controller tests in `tests/controllers/{resource}.controller.test.ts`

Read the existing test file first to understand the mock setup. Then:

**4a.** If the new service method is not yet in the mock, add it to `vi.hoisted()` and to the `container.resolve` mock object:
```ts
const { mockCreate, ..., mockNewMethod } = vi.hoisted(() => ({
    ...
    mockNewMethod: vi.fn(),
}));

vi.mock("../../src/container.js", () => ({
    container: {
        resolve: vi.fn(() => ({
            ...
            newMethod: mockNewMethod,
        })),
    },
}));
```

**4b.** Add a new `it()` block inside the existing `describe` for this controller:
- Find the handler using `routes.find((r) => r.method === "{METHOD}" && r.path === "{/path}")!.handler as any`
- Build the event with `makeEvent()`, setting `pathParameters`, `body`, or `queryStringParameters` as needed
- Mock the service return value: `mockNewMethod.mockResolvedValue(...)`
- Call the handler: `const result = await handler(event, {})`
- Assert `result.statusCode` (200 for GET/PUT, 201 for POST)
- Assert the parsed body matches the expected shape
- Assert the service was called with the right arguments: `expect(mockNewMethod).toHaveBeenCalledWith(...)`

### 5. Update service tests in `tests/services/{Resource}Service.test.ts`

Read the existing test file first to understand the mock setup. Then add a new `describe("{handlerName}", () => { ... })` block with:

- **Happy path**: mock the repository/dependency, call the service method, assert the return value
- **NotFoundError case** (if the method fetches a record): mock the repository to return `null`, assert the method throws `NotFoundError`
- **User mismatch case** (if the method validates ownership): mock the repository to return a record with a different `userId`, assert the method throws `NotFoundError`
- **ConflictError case** (if applicable): mock the repository to simulate a conflict, assert the method throws `ConflictError`

Follow the exact mock setup already present in the file (same `mockFindById`, `mockGetAll`, etc. variables — do not redeclare them).

### 6. Summary

After all edits, report:
- Files modified (source + tests)
- Whether a new service method was created
- Any DynamoDB query patterns that might need to be added to the repository
