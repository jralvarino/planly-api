# planly-api

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-FF9900?style=flat&logo=awslambda&logoColor=white)
![AWS DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=flat&logo=amazondynamodb&logoColor=white)
![AWS SAM](https://img.shields.io/badge/AWS_SAM-FF9900?style=flat&logo=amazonaws&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat&logo=zod&logoColor=white)

Backend da aplicação **Planly** — plataforma de rastreamento de hábitos. A API gerencia hábitos, categorias, to-dos diários e estatísticas de streaks, exposta via AWS API Gateway com funções Lambda independentes por domínio.

**Repositórios relacionados:**
- [`common-utils-layer`](../common-utils-layer) — layer compartilhada com utilitários, middlewares e repositórios comuns
- [`planly`](../planly) — aplicativo mobile React Native / Expo

---

## Como funciona

A API segue uma arquitetura serverless orientada a domínios:

- **4 funções Lambda** independentes: `category`, `habit`, `todo+stats` e `stats-midnight`
- Cada handler usa **Middy** com uma cadeia de middlewares: tracing → logging → body parsing → autenticação → roteamento → tratamento de erros
- Autenticação delegada ao **arj-auth-service** (Lambda Authorizer externo), que injeta o `userId` no contexto da requisição
- Persistência no **DynamoDB** com design single-table nos domínios `todo` e `stats`
- `stats-midnight` é um job agendado (EventBridge) que recalcula streaks diariamente às 00:01 (GMT-3) para hábitos sem ação registrada no dia anterior

```
API Gateway → Lambda Authorizer (arj-auth-service)
                     ↓
           Lambda (category | habit | todo | stats)
                     ↓
                DynamoDB
```

---

## Subindo localmente via Docker

### Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Node.js 20+

### 1. Instalar as imagens e subir os containers

```bash
npm run docker:up
```

Isso sobe o **DynamoDB Local** na porta `8000` na rede `planly-network`.

### 2. Popular as tabelas

```bash
npm run docker:init-db
```

O script cria todas as tabelas necessárias no DynamoDB Local:

| Tabela | Chave | GSIs |
|--------|-------|------|
| `user` | `userId` | — |
| `planly-category` | `id` | `userId-index` |
| `planly-habit` | `id` | `userId-index`, `userId-start_date-index` |
| `planly-todo` | `PK` / `SK` | `habitId-index`, `userId-date-index` |
| `planly-stats` | `PK` / `SK` | — |

Para inserir um usuário de teste:

```bash
DYNAMODB_ENDPOINT=http://localhost:8000 ./scripts/populate-user.sh
```

### 3. Iniciar a API localmente

```bash
npm run dev
```

A API sobe em `http://localhost:3000` via SAM Local.

Para rodar com debugger na porta `9229`:

```bash
npm run dev:debug
```

### 4. Visualizar a documentação Swagger

```bash
npm run swagger
```

Disponível em `http://localhost:8080`.

### Parar os containers

```bash
npm run docker:down
```

---

## Compilar

```bash
npm run build
```

Compila o TypeScript de `src/` para `dist/` com as configurações de `tsconfig.json`.

---

## Rodar os testes unitários

```bash
npm test
```

Para modo watch durante o desenvolvimento:

```bash
npm run test:watch
```

Para gerar relatório de cobertura (threshold mínimo: 80%):

```bash
npm run test:coverage
```

Os testes ficam em `tests/` e utilizam **Vitest** com mocks via `vi.mock`.

---

## Deploy na AWS

### Pré-requisitos

- AWS CLI configurado com as credenciais corretas
- SAM CLI instalado
- Permissões para criar Lambda, API Gateway, DynamoDB e IAM Roles

### Executar o deploy

```bash
npm run deploy
```

O script executa internamente:

```bash
npm run build
sam build --template-file deployment/template.yaml
sam deploy --capabilities CAPABILITY_NAMED_IAM
```

As configurações de deploy ficam em `deployment/samconfig.toml` (stack `planly-api`, região `us-east-1`).

### Recursos criados na AWS

- API Gateway REST (`PlanlyApi`) com stage `prod`
- 4 funções Lambda com IAM Roles dedicadas
- Agendamento EventBridge para o job de meia-noite
- Integração com o Lambda Authorizer externo (`arj-auth-service`) via SSM Parameter Store

A URL da API é exibida como output do stack após o deploy:

```
https://{api-id}.execute-api.us-east-1.amazonaws.com/prod/
```

---

## Variáveis de ambiente

Usadas no ambiente local via `deployment/env.json`:

| Variável | Descrição |
|----------|-----------|
| `AWS_REGION` | Região AWS (`us-east-1`) |
| `NODE_ENV` | Ambiente (`development`) |
| `DYNAMODB_ENDPOINT` | Endpoint do DynamoDB Local (`http://dynamodb:8000`) |
| `POWERTOOLS_LOG_LEVEL` | Nível de log (`DEBUG`) |

Em produção, as variáveis são gerenciadas pelo SAM template e AWS Secrets Manager.
