#!/bin/bash

# Script para criar a tabela Todo no DynamoDB local
# Baseado no modelo Todo com Single Table Design

# Configurações
TABLE_NAME="planly-todo"
DYNAMODB_ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"
REGION="${AWS_REGION:-us-east-1}"

echo "🚀 Criando tabela Todo no DynamoDB local..."
echo "📍 Endpoint: $DYNAMODB_ENDPOINT"
echo "📋 Nome da tabela: $TABLE_NAME"

# Verificar se o DynamoDB local está rodando
if ! curl -s "$DYNAMODB_ENDPOINT" > /dev/null 2>&1; then
    echo "❌ Erro: DynamoDB local não está acessível em $DYNAMODB_ENDPOINT"
    echo "💡 Certifique-se de que o DynamoDB local está rodando:"
    echo "   docker-compose up -d dynamodb"
    exit 1
fi

# Verificar se a tabela já existe
if aws dynamodb describe-table \
    --table-name "$TABLE_NAME" \
    --endpoint-url "$DYNAMODB_ENDPOINT" \
    --region "$REGION" \
    > /dev/null 2>&1; then
    echo "⚠️  A tabela $TABLE_NAME já existe!"
    read -p "Deseja deletar e recriar? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "🗑️  Deletando tabela existente..."
        aws dynamodb delete-table \
            --table-name "$TABLE_NAME" \
            --endpoint-url "$DYNAMODB_ENDPOINT" \
            --region "$REGION" \
            > /dev/null 2>&1
        
        echo "⏳ Aguardando tabela ser deletada..."
        aws dynamodb wait table-not-exists \
            --table-name "$TABLE_NAME" \
            --endpoint-url "$DYNAMODB_ENDPOINT" \
            --region "$REGION"
    else
        echo "✅ Tabela mantida como está."
        exit 0
    fi
fi

# Criar a tabela
echo "📦 Criando tabela..."

aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=habitId,AttributeType=S \
        AttributeName=userId,AttributeType=S \
        AttributeName=date,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        "[{
            \"IndexName\": \"habitId-index\",
            \"KeySchema\": [{\"AttributeName\": \"habitId\", \"KeyType\": \"HASH\"}],
            \"Projection\": {\"ProjectionType\": \"ALL\"}
        }, {
            \"IndexName\": \"userId-date-index\",
            \"KeySchema\": [
                {\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"},
                {\"AttributeName\": \"date\", \"KeyType\": \"RANGE\"}
            ],
            \"Projection\": {\"ProjectionType\": \"ALL\"}
        }]" \
    --endpoint-url "$DYNAMODB_ENDPOINT" \
    --region "$REGION" \
    > /dev/null

if [ $? -eq 0 ]; then
    echo "⏳ Aguardando tabela ficar ativa..."
    aws dynamodb wait table-exists \
        --table-name "$TABLE_NAME" \
        --endpoint-url "$DYNAMODB_ENDPOINT" \
        --region "$REGION"
    
    echo "✅ Tabela $TABLE_NAME criada com sucesso!"
    echo ""
    echo "📊 Estrutura da tabela:"
    echo "   - PK: USER#<userId> (Partition Key)"
    echo "   - SK: DATE#YYYY-MM-DD#HABIT#<habitId> (Sort Key)"
    echo "   - GSI: habitId-index (habitId como chave)"
    echo "   - GSI: userId-date-index (userId + date como chave)"
    echo "   - Modo de cobrança: PAY_PER_REQUEST"
    echo ""
    echo "📝 Campos do modelo Todo:"
    echo "   - PK (string, chave primária)"
    echo "   - SK (string, chave de ordenação)"
    echo "   - userId (string)"
    echo "   - habitId (string)"
    echo "   - date (string, formato YYYY-MM-DD)"
    echo "   - status (enum: done, pending)"
    echo "   - progress (number)"
    echo "   - target (number)"
    echo "   - skiped (boolean)"
    echo "   - notes (string, opcional)"
    echo "   - createdAt (string)"
    echo "   - updatedAt (string)"
else
    echo "❌ Erro ao criar a tabela!"
    exit 1
fi
