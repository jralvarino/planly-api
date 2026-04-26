#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Usage: ./update-common-utils.sh <version>
# Example: ./update-common-utils.sh 1.0.18
#
# Installs the specified version of @arj/arj-common-utils from CodeArtifact.
#
# Required environment variables (or set in .env at project root):
#   CODEARTIFACT_DOMAIN        - CodeArtifact domain name
#   CODEARTIFACT_DOMAIN_OWNER  - AWS account ID that owns the domain
#   CODEARTIFACT_REPOSITORY    - CodeArtifact repository name
#   CODEARTIFACT_REGION        - AWS region (e.g. us-east-1)
#   NPM_SCOPE                  - npm scope (e.g. @arj)
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -o allexport
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set +o allexport
fi

VERSION="${1:?Usage: $0 <version>  (e.g. $0 1.0.18)}"

DOMAIN="${CODEARTIFACT_DOMAIN:?env var CODEARTIFACT_DOMAIN is required}"
DOMAIN_OWNER="${CODEARTIFACT_DOMAIN_OWNER:?env var CODEARTIFACT_DOMAIN_OWNER is required}"
REPOSITORY="${CODEARTIFACT_REPOSITORY:?env var CODEARTIFACT_REPOSITORY is required}"
REGION="${CODEARTIFACT_REGION:?env var CODEARTIFACT_REGION is required}"
SCOPE="${NPM_SCOPE:?env var NPM_SCOPE is required}"
REGISTRY_URL="https://${DOMAIN}-${DOMAIN_OWNER}.d.codeartifact.${REGION}.amazonaws.com/npm/${REPOSITORY}/"
PACKAGE="${SCOPE}/arj-common-utils"

cleanup() {
  printf 'registry=https://registry.npmjs.org/\n%s:registry=%s\n' "$SCOPE" "$REGISTRY_URL" \
    > "${ROOT_DIR}/.npmrc"
}
trap cleanup EXIT

echo "==> Authenticating with AWS CodeArtifact..."
CODEARTIFACT_TOKEN=$(aws codeartifact get-authorization-token \
  --domain "$DOMAIN" \
  --domain-owner "$DOMAIN_OWNER" \
  --region "$REGION" \
  --query authorizationToken \
  --output text)

cat > "${ROOT_DIR}/.npmrc" <<EOF
registry=https://registry.npmjs.org/
${SCOPE}:registry=${REGISTRY_URL}
//${DOMAIN}-${DOMAIN_OWNER}.d.codeartifact.${REGION}.amazonaws.com/npm/${REPOSITORY}/:_authToken=${CODEARTIFACT_TOKEN}
EOF

echo "==> Installing ${PACKAGE}@${VERSION}..."
cd "$ROOT_DIR"
npm install "${PACKAGE}@${VERSION}"

echo ""
echo "Successfully updated ${PACKAGE} to v${VERSION}."
