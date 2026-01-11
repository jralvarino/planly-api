#!/bin/sh

# Script para criar todas as tabelas necessárias no DynamoDB Local
# Uso: ./scripts/init-dynamodb.sh
# Ou com endpoint customizado: DYNAMODB_ENDPOINT=http://localhost:8000 ./scripts/init-dynamodb.sh

DYNAMODB_ENDPOINT=${DYNAMODB_ENDPOINT:-http://localhost:8000}

echo "📦 Criando tabelas no DynamoDB..."
echo "🔗 Endpoint: ${DYNAMODB_ENDPOINT}"

# Criar tabela Category
echo "📋 Criando tabela Category..."
aws dynamodb create-table \
  --table-name planly-category \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[
    {
      "IndexName": "userId-index",
      "KeySchema": [
        { "AttributeName": "userId", "KeyType": "HASH" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ]' \
  --endpoint-url ${DYNAMODB_ENDPOINT} 2>/dev/null || echo "⚠️  Tabela Category já existe ou erro ao criar"

# Criar tabela User
echo "👤 Criando tabela User..."
aws dynamodb create-table \
  --table-name user \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url ${DYNAMODB_ENDPOINT} 2>/dev/null || echo "⚠️  Tabela User já existe ou erro ao criar"

echo "✅ Processo de criação de tabelas concluído!"
