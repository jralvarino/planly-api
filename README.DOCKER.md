# Deploy Local com Docker - Planly API

Este documento descreve como executar a API localmente usando Docker Compose com DynamoDB Local.

## Pré-requisitos

- Docker
- Docker Compose

**Nota:** O AWS CLI não é necessário localmente, pois o serviço `dynamodb-init` usa a imagem oficial `amazon/aws-cli` para criar a tabela automaticamente.

## Estrutura

O `docker-compose.yml` cria três serviços:

1. **dynamodb-local**: DynamoDB Local para desenvolvimento (porta 8000)
2. **dynamodb-init**: Serviço que cria automaticamente a tabela no DynamoDB Local
3. **api**: Container com a API Node.js (porta 3000)

**Nota:** A tabela é criada automaticamente quando você inicia os containers. Não é necessário executar comandos manuais!

## Como usar

### 1. Build e iniciar os containers

```bash
# Build e iniciar em background
docker-compose up -d

# Ou ver os logs em tempo real
docker-compose up
```

**Nota:** A tabela DynamoDB é criada automaticamente pelo serviço `dynamodb-init` quando você inicia os containers. Não é necessário criar manualmente!

### 2. Verificar se tudo está funcionando

```bash
# Ver logs de todos os serviços
docker-compose logs -f

# Verificar se a tabela foi criada
docker-compose logs dynamodb-init
```

Se você precisar recriar a tabela manualmente (caso tenha sido deletada):

```bash
npm run docker:init-db
```

### 3. Verificar logs

```bash
# Ver logs de todos os serviços
docker-compose logs -f

# Ver logs apenas da API
docker-compose logs -f api

# Ver logs apenas do DynamoDB
docker-compose logs -f dynamodb-local
```

### 4. Parar os containers

```bash
docker-compose down
```

### 5. Rebuild da imagem

```bash
docker-compose build
# ou
npm run docker:build
```

## Scripts NPM Disponíveis

- `npm run docker:up` - Inicia containers em background
- `npm run docker:down` - Para containers
- `npm run docker:logs` - Ver logs em tempo real
- `npm run docker:build` - Build das imagens Docker
- `npm run docker:init-db` - Inicializa tabela no DynamoDB Local
- `npm run docker:restart` - Reinicia todos os containers

## Endpoints

Após iniciar os containers:

- **API**: http://localhost:3000
- **DynamoDB Local**: http://localhost:8000

## Exemplos de uso

### 1. Fazer login e obter token:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "Barbara"}'
```

Resposta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "Barbara",
  "expiresIn": "7d"
}
```

### 2. Criar categoria (usando o token obtido):

```bash
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"name": "Trabalho"}'
```

### 3. Listar categorias:

```bash
curl -X GET http://localhost:3000/categories \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### 4. Obter categoria por nome:

```bash
curl -X GET http://localhost:3000/categories/Trabalho \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### 5. Atualizar categoria:

```bash
curl -X PUT http://localhost:3000/categories/Trabalho \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"name": "Trabalho Remoto"}'
```

### 6. Deletar categoria:

```bash
curl -X DELETE http://localhost:3000/categories/Trabalho \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Variáveis de Ambiente

As variáveis de ambiente podem ser ajustadas no `docker-compose.yml`:

- `CATEGORY_TABLE`: Nome da tabela DynamoDB (padrão: `planly-api-category`)
- `JWT_SECRET`: Chave secreta para JWT (padrão: `dev-secret-key-change-in-production`)
- `JWT_EXPIRES_IN`: Tempo de expiração do token (padrão: `7d`)
- `DYNAMODB_ENDPOINT`: Endpoint do DynamoDB (automático: `http://dynamodb-local:8000`)

## Troubleshooting

### Tabela não existe

A tabela é criada automaticamente pelo serviço `dynamodb-init`. Se você receber erros sobre a tabela não existir:

1. Verifique os logs do serviço `dynamodb-init`:
   ```bash
   docker-compose logs dynamodb-init
   ```

2. Se necessário, recrie a tabela manualmente:
   ```bash
   npm run docker:init-db
   ```

3. Ou reinicie os containers:
   ```bash
   npm run docker:restart
   ```

### Porta já em uso

Se a porta 3000 ou 8000 já estiverem em uso, ajuste no `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Mude 3001 para outra porta disponível
```

### Rebuild completo

Para fazer um rebuild completo:

```bash
docker-compose down -v  # Remove volumes também
docker-compose build --no-cache
docker-compose up -d
npm run docker:init-db
```

### Verificar se DynamoDB está rodando

```bash
# Verificar se o container está rodando
docker ps | grep dynamodb

# Verificar logs
docker-compose logs dynamodb-local
```

### Limpar tudo e começar do zero

```bash
docker-compose down -v
docker system prune -f
docker-compose build --no-cache
docker-compose up -d
npm run docker:init-db
```

## Desenvolvimento

O código fonte está montado como volume, então mudanças no código TypeScript requerem rebuild:

```bash
# Dentro do container ou localmente
npm run build
```

Ou reinicie o container para aplicar mudanças:

```bash
npm run docker:restart
```

