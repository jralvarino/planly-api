# Guia de Desenvolvimento Local

Este guia explica como executar o projeto localmente usando AWS SAM Local.

## Pré-requisitos

1. **Node.js 20.x ou superior**
   ```bash
   node --version
   ```

2. **AWS SAM CLI instalado**
   ```bash
   # macOS
   brew install aws-sam-cli
   
   # Ou siga: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
   sam --version
   ```

3. **Docker instalado e rodando**
   ```bash
   docker --version
   docker ps  # Deve funcionar sem erros
   ```

4. **Credenciais AWS configuradas**
   ```bash
   aws configure
   ```

## Configuração Inicial

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente:**
   
   O arquivo `deployment/env.json` contém as variáveis de ambiente para a Lambda local. Você pode ajustá-lo conforme necessário:
   
   ```json
   {
     "CategoryLambdaFunction": {
       "CATEGORY_TABLE": "planly-api-category",
       "AWS_REGION": "us-east-1",
       "NODE_ENV": "development"
     }
   }
   ```

## Executar Localmente

### Opção 1: Comando único (recomendado)

```bash
npm run dev
```

Este comando faz:
1. Build do TypeScript (`npm run build`)
2. Build do SAM (`sam build`)
3. Inicia a API local na porta 3000

### Opção 2: Comandos separados

```bash
# 1. Build do TypeScript
npm run build

# 2. Build do SAM
npm run sam:build

# 3. Iniciar API local
npm run sam:local:start
```

A API estará disponível em: **http://localhost:3000**

## Testar a API

### Listar categorias
```bash
curl http://localhost:3000/categories
```

### Criar categoria
```bash
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Categoria Teste",
    "description": "Descrição da categoria"
  }'
```

### Obter categoria por ID
```bash
curl http://localhost:3000/categories/{id}
```

### Atualizar categoria
```bash
curl -X PUT http://localhost:3000/categories/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Categoria Atualizada",
    "description": "Nova descrição"
  }'
```

### Deletar categoria
```bash
curl -X DELETE http://localhost:3000/categories/{id}
```

## Invocar Lambda Diretamente

Para testar a Lambda sem passar pelo API Gateway:

```bash
npm run sam:local:invoke
```

Isso usa o arquivo `events/event.json` como evento de teste. Você pode modificar esse arquivo para testar diferentes cenários.

## Estrutura de Arquivos

```
planly-api/
├── events/
│   └── event.json          # Evento de teste para invocação direta
├── deployment/
│   ├── template.yaml       # Template CloudFormation/SAM
│   ├── openapi.yaml        # Especificação OpenAPI
│   ├── env.json            # Variáveis de ambiente para desenvolvimento local
│   └── ...
└── src/
    └── handlers/
        └── category/
            └── index.ts    # Handler da Lambda
```

## Troubleshooting

### Erro: "Docker is not running"
- Certifique-se de que o Docker Desktop está rodando
- Verifique com: `docker ps`

### Erro: "Template not found"
- Execute `npm run sam:build` primeiro
- Verifique se o arquivo `deployment/template.yaml` existe

### Erro: "Cannot find module"
- Execute `npm install` para instalar dependências
- Execute `npm run build` para compilar TypeScript

### Erro de conexão com DynamoDB
- Verifique suas credenciais AWS: `aws configure list`
- Certifique-se de que a tabela existe na AWS (ou use DynamoDB Local)

### Porta 3000 já em uso
- Altere a porta no comando: `--port 3001`
- Ou pare o processo que está usando a porta 3000

## Usando DynamoDB Local (Opcional)

Se você quiser usar DynamoDB Local em vez da AWS:

1. **Instalar DynamoDB Local:**
   ```bash
   docker run -d -p 8000:8000 amazon/dynamodb-local
   ```

2. **Criar tabela local:**
   ```bash
   aws dynamodb create-table \
     --table-name planly-api-category \
     --attribute-definitions AttributeName=id,AttributeType=S AttributeName=userId,AttributeType=S \
     --key-schema AttributeName=id,KeyType=HASH \
     --global-secondary-indexes IndexName=userId-index,KeySchema=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL} \
     --billing-mode PAY_PER_REQUEST \
     --endpoint-url http://localhost:8000
   ```

3. **Ajustar código para usar endpoint local:**
   
   Modifique `src/db/dynamoClient.ts` para usar o endpoint local quando em desenvolvimento.

## Próximos Passos

- Adicione mais rotas seguindo o padrão do módulo Category
- Configure testes automatizados
- Configure CI/CD para deploy automático

