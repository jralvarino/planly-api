Run a security scan to detect hardcoded secrets, sensitive data, and exposed configuration that could be a security risk in this public repository.

## Steps

1. Make the scan script executable and run it:
   ```
   chmod +x infrastructure/deployment/security-scan.sh
   bash infrastructure/deployment/security-scan.sh
   ```

2. Capture the full output. The script categorizes findings into three severity levels:
   - **HIGH** — blocks deployment; must be fixed before merging/deploying
   - **MEDIUM** — should be reviewed; may block depending on context
   - **LOW** — informational; review recommended

3. For each finding, analyze whether it is a **true positive** or **false positive**:
   - True positive: a real value that would expose credentials or sensitive config in the public repo
   - False positive: a pattern match on a placeholder, example, or non-secret value (e.g., `process.env.SECRET`, `"YOUR_API_KEY"`, test fixtures with fake data)

4. Report results in this format:

---

### Security Scan Results

#### HIGH Severity
| File:Line | Pattern | Finding | Verdict |
|-----------|---------|---------|---------|
| `src/foo.ts:12` | Hardcoded secret | `password = "abc123"` | True positive — must fix |

#### MEDIUM Severity
| File:Line | Pattern | Finding | Verdict |
|-----------|---------|---------|---------|

#### LOW Severity
| File:Line | Pattern | Finding | Verdict |
|-----------|---------|---------|---------|

---

### Overall verdict
- Total HIGH: N (true positives: N)
- Total MEDIUM: N (true positives: N)
- Total LOW: N (true positives: N)

**[PASS / BLOCKED]** — one-line summary of deployment eligibility.

---

5. For each **true positive**, recommend the specific fix:
   - Hardcoded secrets → move to environment variable via `process.env.VAR_NAME` and document in `.env.example`
   - Committed `.env` files → add to `.gitignore`, rotate any exposed values, use `.env.example` with placeholder values
   - AWS ARNs with real account IDs → use `!Sub` in SAM templates or reference via Parameter/SSM
   - Private keys → remove immediately, rotate, store in AWS Secrets Manager or SSM Parameter Store
   - Hardcoded tokens/Bearer values → replace with `process.env` reference, add to Lambda environment variables in `template.yaml`

6. If all HIGH findings are false positives, confirm the scan passes and deployment is unblocked.
