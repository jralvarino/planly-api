#!/bin/bash

# Script para inicializar todas as tabelas do DynamoDB local
# Cria todas as tabelas necessárias para o projeto Planly

# Configurações
DYNAMODB_ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Inicializando tabelas do DynamoDB local..."
echo "📍 Endpoint: $DYNAMODB_ENDPOINT"
echo ""

# Verificar se o DynamoDB local está rodando
if ! curl -s "$DYNAMODB_ENDPOINT" > /dev/null 2>&1; then
    echo "❌ Erro: DynamoDB local não está acessível em $DYNAMODB_ENDPOINT"
    echo "💡 Certifique-se de que o DynamoDB local está rodando:"
    echo "   docker-compose up -d dynamodb"
    exit 1
fi

# Lista de scripts de criação de tabelas na ordem de dependência
TABLES=(
    "create-user-table.sh"
    "create-category-table.sh"
    "create-habit-table.sh"
    "create-todo-table.sh"
    "create-stats-table.sh"
)

# Executar cada script
for script in "${TABLES[@]}"; do
    script_path="$SCRIPT_DIR/$script"
    
    if [ ! -f "$script_path" ]; then
        echo "⚠️  Script não encontrado: $script"
        continue
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Executando: $script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    DYNAMODB_ENDPOINT="$DYNAMODB_ENDPOINT" bash "$script_path"
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao executar $script"
        exit 1
    fi
    
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Todas as tabelas foram criadas com sucesso!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Tabelas criadas:"
echo "   - user"
echo "   - planly-category"
echo "   - planly-habit"
echo "   - planly-todo"
echo "   - planly-stats"
echo ""
