#!/bin/bash

# Script para fazer deploy da Lambda usando AWS SAM CLI
# Requisitos: AWS CLI e SAM CLI instalados

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AWS_DIR="$ROOT_DIR/infrastructure/aws"

STACK_NAME="planly-api"
REGION=${AWS_REGION:-us-east-1}

echo "🚀 Iniciando deploy do stack: ${STACK_NAME}"
echo "🌍 Região: ${REGION}"

# Security scan — blocks deploy if HIGH severity findings are detected
echo "🔒 Running security scan..."
chmod +x "$SCRIPT_DIR/security-scan.sh"
bash "$SCRIPT_DIR/security-scan.sh"

# Build do projeto (na raiz do projeto)
echo "🔨 Compilando TypeScript..."
cd "$ROOT_DIR"
npm run build

# Build do SAM
echo "📦 Empacotando com SAM..."
cd "$AWS_DIR"
sam build --template-file template.yaml

# Deploy
echo "☁️  Fazendo deploy na AWS..."
sam deploy \
  --template-file template.yaml \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --parameter-overrides AWSRegion=${REGION} \
  --capabilities CAPABILITY_NAMED_IAM \
  --resolve-s3

echo "✅ Deploy concluído!"
echo "📋 Para ver os outputs do stack, execute:"
echo "   aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${REGION} --query 'Stacks[0].Outputs'"

