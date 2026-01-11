# Planly API

API Lambda para gerenciamento de categorias usando AWS Lambda, API Gateway e DynamoDB.

## Pré-requisitos

- Node.js 20.x ou superior
- AWS CLI configurado
- AWS SAM CLI instalado
- Credenciais AWS configuradas

## Instalação

```bash
npm install
```

## Build

```bash
npm run build
```

## Deploy

### Usando o script de deploy

```bash
./deployment/deploy.sh
```

### Usando AWS SAM CLI diretamente

```bash
# Build
npm run sam:build

# Deploy
npm run sam:deploy
```

### Usando npm scripts

```bash
npm run deploy
```

## Estrutura do Projeto

```
src/
  handlers/
    category/
      category.controller.ts  # Controllers das rotas
      category.routes.ts      # Definição das rotas
      index.ts                # Handler principal da Lambda
  services/
    CategoryService.ts        # Lógica de negócio
  repositories/
    CategoryRepository.ts     # Acesso ao DynamoDB
  models/
    Category.ts               # Modelo de dados
  db/
    dynamoClient.ts          # Cliente DynamoDB
deployment/
  template.yaml              # CloudFormation/SAM template
  deploy.sh                  # Script de deploy
  .samconfig.toml            # Configuração do SAM CLI
```

## Recursos AWS Criados

O template CloudFormation (`deployment/template.yaml`) cria os seguintes recursos:

- **Lambda Function**: Função serverless que processa as requisições
- **API Gateway**: REST API para expor os endpoints
- **DynamoDB Table**: Tabela para armazenar categorias
- **IAM Role**: Role com permissões para Lambda acessar DynamoDB

## Variáveis de Ambiente

A Lambda recebe as seguintes variáveis de ambiente:

- `CATEGORY_TABLE`: Nome da tabela DynamoDB
- `AWS_REGION`: Região AWS
- `NODE_ENV`: production

## Endpoints

Após o deploy, os seguintes endpoints estarão disponíveis:

- `POST /categories` - Criar categoria
- `GET /categories` - Listar categorias
- `GET /categories/{id}` - Obter categoria por ID
- `PUT /categories/{id}` - Atualizar categoria
- `DELETE /categories/{id}` - Deletar categoria

## Outputs do Stack

Após o deploy, você pode obter a URL da API executando:

```bash
aws cloudformation describe-stacks \
  --stack-name planly-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

## Desenvolvimento Local

### Pré-requisitos

- AWS SAM CLI instalado ([Instruções](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- Docker instalado e rodando (necessário para SAM Local)
- Credenciais AWS configuradas (para acessar DynamoDB)

### Configuração

1. **Instalar dependências:**
```bash
npm install
```

2. **Configurar variáveis de ambiente:**
   
   O arquivo `deployment/env.json` já está configurado com valores padrão. Você pode ajustá-lo conforme necessário:
   
   ```json
   {
     "CategoryLambdaFunction": {
       "CATEGORY_TABLE": "planly-api-category",
       "AWS_REGION": "us-east-1",
       "NODE_ENV": "development"
     }
   }
   ```

3. **Configurar credenciais AWS:**
   
   Certifique-se de ter suas credenciais AWS configuradas:
   ```bash
   aws configure
   ```

### Executar Localmente

1. **Build do projeto:**
```bash
npm run build
```

2. **Build do SAM:**
```bash
npm run sam:build
```

3. **Iniciar API local:**
```bash
npm run dev
```

Ou execute os comandos separadamente:
```bash
# Build
npm run build
npm run sam:build

# Iniciar API local na porta 3000
npm run sam:local:start
```

A API estará disponível em: `http://localhost:3000`

### Testar Endpoints Localmente

```bash
# Listar categorias
curl http://localhost:3000/categories

# Criar categoria
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Category", "description": "Test description"}'

# Obter categoria por ID
curl http://localhost:3000/categories/{id}

# Atualizar categoria
curl -X PUT http://localhost:3000/categories/{id} \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Category"}'

# Deletar categoria
curl -X DELETE http://localhost:3000/categories/{id}
```

### Invocar Lambda Diretamente

Para testar a Lambda diretamente sem API Gateway:

```bash
npm run sam:local:invoke
```

Isso usará o arquivo `events/event.json` como evento de teste.

### Notas Importantes

- O SAM Local usa Docker para simular o ambiente Lambda
- Certifique-se de que o Docker está rodando antes de executar `sam local`
- As variáveis de ambiente são definidas em `deployment/env.json`
- Para usar DynamoDB Local, você precisará configurar o endpoint no código
