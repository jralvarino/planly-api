#!/bin/bash

# Script para resetar todos os itens da tabela Stats:
# currentStreak = 0, lastCompletedDate = "", longestStreak = 0, totalCompletions = 0
#
# Uso: ./scripts/reset-stats.sh
# Ou:  DYNAMODB_ENDPOINT=http://localhost:8000 ./scripts/reset-stats.sh
#
# Variáveis de ambiente (opcional):
#   DYNAMODB_ENDPOINT - endpoint do DynamoDB (ex: http://localhost:8000 para local)
#   AWS_REGION        - região AWS (default: us-east-1)

set -e

TABLE_NAME="planly-stats"
DYNAMODB_ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"
REGION="${AWS_REGION:-us-east-1}"

# Dependências: aws (AWS CLI) e jq
if ! command -v aws &> /dev/null; then
    echo "❌ Erro: AWS CLI (aws) não encontrado. Instale: https://aws.amazon.com/cli/"
    exit 1
fi
if ! command -v jq &> /dev/null; then
    echo "❌ Erro: jq não encontrado. Instale: https://stedolan.github.io/jq/"
    exit 1
fi

echo "🔄 Resetando Stats na tabela $TABLE_NAME..."
echo "📍 Endpoint: $DYNAMODB_ENDPOINT"

# Verificar se o DynamoDB está acessível
if ! curl -s "$DYNAMODB_ENDPOINT" > /dev/null 2>&1; then
    echo "❌ Erro: DynamoDB não está acessível em $DYNAMODB_ENDPOINT"
    echo "💡 Para DynamoDB local: docker-compose up -d dynamodb"
    exit 1
fi

# Verificar se a tabela existe
if ! aws dynamodb describe-table \
    --table-name "$TABLE_NAME" \
    --endpoint-url "$DYNAMODB_ENDPOINT" \
    --region "$REGION" \
    > /dev/null 2>&1; then
    echo "❌ Erro: Tabela $TABLE_NAME não existe."
    exit 1
fi

# Scan: buscar PK e SK de todos os itens (uma página; para tabelas grandes use paginação)
ITEMS_JSON=$(aws dynamodb scan \
    --table-name "$TABLE_NAME" \
    --projection-expression "PK, SK" \
    --endpoint-url "$DYNAMODB_ENDPOINT" \
    --region "$REGION" \
    --output json)

COUNT=$(echo "$ITEMS_JSON" | jq '.Items | length')
echo "📋 Encontrados $COUNT item(ns)."

if [ "$COUNT" -eq 0 ]; then
    echo "✅ Nenhum item para atualizar."
    exit 0
fi

UPDATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Expression attribute values: currentStreak=0, longestStreak=0, lastCompletedDate="", totalCompletions=0, updatedAt=now
EXPR_VALUES=$(jq -n \
    --arg ua "$UPDATED_AT" \
    '{":cs":{"N":"0"},":ls":{"N":"0"},":lcd":{"S":""},":tc":{"N":"0"},":ua":{"S":$ua}}')

UPDATED=0
FAILED=0

while IFS= read -r item; do
    PK=$(echo "$item" | jq -c '.PK')
    SK=$(echo "$item" | jq -c '.SK')
    KEY=$(jq -n --argjson pk "$PK" --argjson sk "$SK" '{PK:$pk, SK:$sk}')
    if aws dynamodb update-item \
        --table-name "$TABLE_NAME" \
        --key "$KEY" \
        --update-expression "SET currentStreak = :cs, longestStreak = :ls, lastCompletedDate = :lcd, totalCompletions = :tc, updatedAt = :ua" \
        --expression-attribute-values "$EXPR_VALUES" \
        --endpoint-url "$DYNAMODB_ENDPOINT" \
        --region "$REGION" \
        --no-cli-pager \
        > /dev/null 2>&1; then
        echo "  ✓ $(echo "$item" | jq -r '.PK.S + " | " + .SK.S')"
        UPDATED=$((UPDATED + 1))
    else
        echo "  ✗ $(echo "$item" | jq -r '.PK.S + " | " + .SK.S') (falha)"
        FAILED=$((FAILED + 1))
    fi
done < <(echo "$ITEMS_JSON" | jq -c '.Items[]')

echo ""
echo "✅ Atualizados: $UPDATED"
if [ "$FAILED" -gt 0 ]; then
    echo "❌ Falhas: $FAILED"
    exit 1
fi
