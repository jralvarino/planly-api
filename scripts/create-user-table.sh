#!/bin/bash

# Script para criar a tabela User no DynamoDB local
# Baseado no modelo User e na configuração do template.yaml

# Configurações
TABLE_NAME="user"
DYNAMODB_ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"
REGION="${AWS_REGION:-us-east-1}"

echo "🚀 Criando tabela User no DynamoDB local..."
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
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
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
    echo "   - Chave primária: userId (String)"
    echo "   - Modo de cobrança: PAY_PER_REQUEST"
    echo ""
    echo "📝 Campos do modelo User:"
    echo "   - userId (string, chave primária, obrigatório)"
    echo "   - password (string, obrigatório)"
    echo "   - name (string, opcional)"
    echo "   - avatar (string, opcional)"
    echo "   - createdAt (string, opcional)"
else
    echo "❌ Erro ao criar a tabela!"
    exit 1
fi
