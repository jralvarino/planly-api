#!/bin/sh

# Script para criar a tabela User no DynamoDB Local
# Uso: ./scripts/init-user-table.sh
# Ou com endpoint customizado: DYNAMODB_ENDPOINT=http://localhost:8000 ./scripts/init-user-table.sh

DYNAMODB_ENDPOINT=${DYNAMODB_ENDPOINT:-http://localhost:8000}

echo "📦 Criando tabela User no DynamoDB..."
echo "🔗 Endpoint: ${DYNAMODB_ENDPOINT}"

aws dynamodb create-table \
  --table-name planly-api-user \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url ${DYNAMODB_ENDPOINT}

if [ $? -eq 0 ]; then
  echo "✅ Tabela User criada com sucesso!"
else
  echo "❌ Erro ao criar tabela User. Verifique se a tabela já existe ou se o DynamoDB está rodando."
  exit 1
fi
