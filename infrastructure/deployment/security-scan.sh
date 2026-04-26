#!/bin/bash

# Security scan: detects hardcoded secrets and sensitive data in tracked source files.
# Exits 1 if HIGH severity findings exist (blocks deployment).
# Exits 0 if only LOW/MEDIUM findings or clean.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0

EXCLUDE_DIRS="node_modules|dist|\.aws-sam|coverage|\.git"
SCAN_EXTENSIONS="ts|js|json|yaml|yml|sh|env|toml|txt|html"

find_in_source() {
  local pattern="$1"
  git -C "$ROOT_DIR" ls-files \
    | grep -E "\.(${SCAN_EXTENSIONS})$" \
    | grep -vE "(${EXCLUDE_DIRS})" \
    | xargs grep -rniE "$pattern" 2>/dev/null \
    | grep -vE "(security-scan\.sh|\.md$)" \
    || true
}

print_finding() {
  local severity="$1"
  local label="$2"
  local matches="$3"

  if [ -z "$matches" ]; then
    return
  fi

  case "$severity" in
    HIGH)
      echo -e "${RED}${BOLD}[HIGH]${RESET} ${label}"
      HIGH_COUNT=$((HIGH_COUNT + 1))
      ;;
    MEDIUM)
      echo -e "${YELLOW}${BOLD}[MEDIUM]${RESET} ${label}"
      MEDIUM_COUNT=$((MEDIUM_COUNT + 1))
      ;;
    LOW)
      echo -e "${CYAN}${BOLD}[LOW]${RESET} ${label}"
      LOW_COUNT=$((LOW_COUNT + 1))
      ;;
  esac

  echo "$matches" | while IFS= read -r line; do
    echo "  ${line}"
  done
  echo ""
}

echo ""
echo -e "${BOLD}Security Scan — $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo -e "Repository: ${ROOT_DIR}"
echo "────────────────────────────────────────────────────"
echo ""

# ── HIGH: AWS access key ID pattern (AKIA / ASIA / AROA + 16 uppercase chars) ──
MATCH=$(find_in_source '(AKIA|ASIA|AROA)[A-Z0-9]{16}' | grep -vE '(example|placeholder|YOUR_|REPLACE|dummy|fake|test)' || true)
print_finding "HIGH" "Potential AWS access key ID" "$MATCH"

# ── HIGH: Private / certificate keys ──
MATCH=$(find_in_source '-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY' || true)
print_finding "HIGH" "Private key material embedded in file" "$MATCH"

# ── HIGH: Generic secret/password assignments with real-looking values ──
MATCH=$(find_in_source '(password|passwd|secret|api_key|apikey|auth_token|access_token)\s*[=:]\s*["'"'"'][^"'"'"'$\{][^"'"'"']{7,}["'"'"']' \
  | grep -viE '(example|placeholder|YOUR_|REPLACE|dummy|fake|test|process\.env|getenv|\$\{)' \
  || true)
print_finding "HIGH" "Hardcoded secret/password/token assignment" "$MATCH"

# ── HIGH: JWT secret hardcoded ──
MATCH=$(find_in_source 'jwt[_-]?(secret|key)\s*[=:]\s*["'"'"'][^"'"'"'$\{]{10,}' \
  | grep -viE '(example|placeholder|YOUR_|REPLACE|dummy|fake|test|process\.env|\$\{)' \
  || true)
print_finding "HIGH" "Hardcoded JWT secret" "$MATCH"

# ── MEDIUM: Hardcoded AWS account ID (12-digit number in relevant context) ──
MATCH=$(find_in_source 'arn:aws:[a-z0-9\-]+:[a-z0-9\-]*:[0-9]{12}:' \
  | grep -viE '(example|placeholder|123456789012|000000000000)' \
  || true)
print_finding "MEDIUM" "AWS ARN with real account ID" "$MATCH"

# ── MEDIUM: Hardcoded AWS region in source (not infra/config files) ──
MATCH=$(find_in_source '"(us|eu|ap|sa|ca|me|af)-(east|west|north|south|central|northeast|southeast)-[0-9]"' \
  | grep -vE '(template\.yaml|openapi\.yaml|samconfig|deploy\.sh|\.json)' \
  || true)
print_finding "MEDIUM" "Hardcoded AWS region string in source code" "$MATCH"

# ── MEDIUM: Connection strings with embedded credentials ──
MATCH=$(find_in_source '(mongodb|postgres|mysql|redis|amqp)(\+srv)?://[^/\s]+:[^@\s]+@' \
  | grep -viE '(example|placeholder|YOUR_|REPLACE|dummy|fake|test|process\.env|\$\{|localhost)' \
  || true)
print_finding "MEDIUM" "Connection string with embedded credentials" "$MATCH"

# ── MEDIUM: Bearer / API tokens that look non-placeholder ──
MATCH=$(find_in_source 'Bearer\s+[A-Za-z0-9\-_\.]{20,}' \
  | grep -viE '(example|placeholder|YOUR_|REPLACE|dummy|fake|test|\$\{|process\.env)' \
  || true)
print_finding "MEDIUM" "Hardcoded Bearer token" "$MATCH"

# ── LOW: Hardcoded non-localhost IP addresses in source ──
MATCH=$(find_in_source '\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b' \
  | grep -vE '(127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255|10\.0\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' \
  | grep -vE '(template\.yaml|openapi\.yaml|samconfig|deploy\.sh|package\.json|\.md)' \
  || true)
print_finding "LOW" "Hardcoded public IP address" "$MATCH"

# ── LOW: .env files tracked by git ──
ENV_FILES=$(git -C "$ROOT_DIR" ls-files | grep -E '^\.env(\.[a-zA-Z]+)?$' || true)
if [ -n "$ENV_FILES" ]; then
  LOW_COUNT=$((LOW_COUNT + 1))
  echo -e "${CYAN}${BOLD}[LOW]${RESET} .env file(s) tracked in git"
  echo "$ENV_FILES" | while IFS= read -r f; do echo "  ${f}"; done
  echo ""
fi

# ── LOW: TODO/FIXME comments with credential keywords ──
MATCH=$(find_in_source '(//|#|/\*)\s*(TODO|FIXME|HACK).{0,60}(secret|password|token|key|credential)' \
  | grep -viE '(example|placeholder)' || true)
print_finding "LOW" "TODO/FIXME referencing credentials" "$MATCH"

# ── Summary ──
echo "────────────────────────────────────────────────────"
echo -e "${BOLD}Summary${RESET}"
echo -e "  ${RED}HIGH   : ${HIGH_COUNT}${RESET}"
echo -e "  ${YELLOW}MEDIUM : ${MEDIUM_COUNT}${RESET}"
echo -e "  ${CYAN}LOW    : ${LOW_COUNT}${RESET}"
echo ""

if [ "$HIGH_COUNT" -gt 0 ]; then
  echo -e "${RED}${BOLD}BLOCKED: ${HIGH_COUNT} HIGH severity finding(s) must be resolved before deploying.${RESET}"
  echo ""
  exit 1
fi

if [ "$MEDIUM_COUNT" -gt 0 ] || [ "$LOW_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}WARNING: Review MEDIUM/LOW findings above before deploying.${RESET}"
  echo ""
fi

echo -e "${GREEN}${BOLD}No HIGH severity findings. Scan passed.${RESET}"
echo ""
exit 0
