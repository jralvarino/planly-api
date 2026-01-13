#!/bin/bash

# Script para criar a tabela Habit no DynamoDB local
# Baseado no modelo Habit e na configuração do template.yaml

# Configurações
TABLE_NAME="planly-habit"
DYNAMODB_ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"
REGION="${AWS_REGION:-us-east-1}"

echo "🚀 Criando tabela Habit no DynamoDB local..."
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
        AttributeName=id,AttributeType=S \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        "[{
            \"IndexName\": \"userId-index\",
            \"KeySchema\": [{\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"}],
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
    echo "   - Chave primária: id (String)"
    echo "   - GSI: userId-index (userId como chave)"
    echo "   - Modo de cobrança: PAY_PER_REQUEST"
    echo ""
    echo "📝 Campos do modelo Habit:"
    echo "   - id (string, chave primária)"
    echo "   - userId (string, GSI)"
    echo "   - title (string, obrigatório)"
    echo "   - description (string, opcional)"
    echo "   - color (string)"
    echo "   - emoji (string)"
    echo "   - unit (enum: count, pg, km, ml)"
    echo "   - value (string)"
    echo "   - period_type (enum: every_day, specific_days_week, specific_days_month)"
    echo "   - period_value (string, opcional)"
    echo "   - categoryId (string)"
    echo "   - period (enum: Anytime, Morning, Afternoon, Evening)"
    echo "   - reminder_enabled (boolean)"
    echo "   - reminder_time (string, opcional)"
    echo "   - start_date (string)"
    echo "   - end_date (string, opcional)"
    echo "   - active (boolean)"
    echo "   - createdAt (string)"
    echo "   - updatedAt (string)"
else
    echo "❌ Erro ao criar a tabela!"
    exit 1
fi