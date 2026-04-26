Run the test suite with coverage and report which files are below the 80% threshold.

## Steps

1. Run: `npm run test:coverage` from the project root
2. Parse the output to find files with coverage below 80% in any of: Statements, Branches, Functions, Lines
3. Report results in this format:

### Files below 80% coverage

| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| src/services/FooService.ts | 72% ⚠️ | 65% ⚠️ | 80% ✅ | 72% ⚠️ |

### Overall summary
- Total files checked: N
- Files passing: N
- Files failing: N

### Suggested next steps
For each failing file, suggest the specific untested scenarios based on the file's role:
- Repository files: missing DynamoDB error cases or missing query variants
- Service files: missing conflict/not-found branches
- Schema files: missing invalid input cases
- Handler/controller files: missing middleware interaction tests

If all files pass, confirm: "All files meet the 80% coverage threshold."
