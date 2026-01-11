# Deployment - Planly API

Esta pasta contém todos os arquivos necessários para fazer o deployment da Lambda na AWS.

## Estrutura de Arquivos

- `template.yaml` - Template principal com recursos compartilhados (API Gateway) e módulos de lambdas
- `deploy.sh` - Script bash para automatizar o processo de deploy
- `.samconfig.toml` - Configuração do AWS SAM CLI

## Arquitetura

O template principal (`template.yaml`) contém:

- **Recursos compartilhados**: API Gateway REST API
- **Módulo Category**: Todos os recursos relacionados à categoria (Lambda, DynamoDB, IAM Role, Permissões, Eventos)

Os recursos estão organizados em seções claramente marcadas no template para facilitar a adição de novos módulos no futuro.

## Como usar

### Opção 1: Script de deploy (recomendado)

```bash
# Da raiz do projeto
./deployment/deploy.sh
```

### Opção 2: AWS SAM CLI diretamente

```bash
# Navegar para a pasta deployment
cd deployment

# Build
sam build --template-file template.yaml

# Deploy
sam deploy --template-file template.yaml \
  --stack-name planly-api \
  --parameter-overrides AWSRegion=us-east-1 \
  --capabilities CAPABILITY_NAMED_IAM \
  --resolve-s3
```

### Opção 3: NPM scripts (da raiz do projeto)

```bash
npm run deploy
```

## Recursos criados

O template cria os seguintes recursos na AWS:

- **API Gateway REST API**: API compartilhada para todas as lambdas
- **Category Lambda Function**: Função serverless com o código da API de categorias
- **DynamoDB Table**: Tabela para armazenar categorias
- **IAM Role**: Role com permissões necessárias para a Lambda de categoria

## Adicionando Novas Lambdas

Para adicionar uma nova lambda no futuro:

1. Adicione uma nova seção no `template.yaml` seguindo o padrão do módulo Category
2. Inclua os recursos necessários: DynamoDB Table (se necessário), IAM Role, Lambda Function, Permissões e Eventos do API Gateway
3. Organize os recursos com comentários claros separando cada módulo

## Parâmetros

- `AWSRegion`: Região AWS - padrão: us-east-1

## Outputs

Após o deploy, você pode obter a URL da API:

```bash
aws cloudformation describe-stacks \
  --stack-name planly-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```
