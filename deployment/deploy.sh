#!/bin/bash

# Script para fazer deploy da Lambda usando AWS SAM CLI
# Requisitos: AWS CLI e SAM CLI instalados

set -e

# Navegar para o diretório do script
cd "$(dirname "$0")"

STACK_NAME="planly-api"
REGION=${AWS_REGION:-us-east-1}

echo "🚀 Iniciando deploy do stack: ${STACK_NAME}"
echo "🌍 Região: ${REGION}"

# Build do projeto (na raiz do projeto)
echo "🔨 Compilando TypeScript..."
cd ..
npm run build
cd deployment

# Build do SAM
echo "📦 Empacotando com SAM..."
sam build --template-file template.yaml

# Deploy
echo "☁️  Fazendo deploy na AWS..."
sam deploy \
  --template-file template.yaml \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --parameter-overrides AWSRegion=${REGION} \
  --capabilities CAPABILITY_NAMED_IAM \
  --resolve-s3 \
  --confirm-changeset

echo "✅ Deploy concluído!"
echo "📋 Para ver os outputs do stack, execute:"
echo "   aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${REGION} --query 'Stacks[0].Outputs'"

