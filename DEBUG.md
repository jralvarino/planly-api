# Debug Guide - Planly API

Este guia explica como debugar a aplicação quando rodando localmente com Docker usando AWS SAM CLI.

## Pré-requisitos

- VS Code instalado
- AWS SAM CLI instalado
- Docker instalado e rodando
- Extensão "JavaScript Debugger" do VS Code (geralmente já incluída)

## Configuração

O projeto já está configurado com:

- ✅ Source maps habilitados no `tsconfig.json`
- ✅ Configuração do VS Code em `.vscode/launch.json`
- ✅ Scripts de debug no `package.json`
- ✅ Variáveis de ambiente configuradas em `deployment/env.json`

## Passos para Debugar

### 1. Iniciar o DynamoDB Local

```bash
npm run docker:up
npm run docker:init-db
```

### 2. Compilar o projeto

```bash
npm run build
```

### 3. Iniciar o SAM Local em modo debug

```bash
npm run dev:debug
```

Este comando irá:

- Compilar o TypeScript
- Iniciar o SAM Local na porta 3000
- Habilitar o debugger na porta 9229
- Conectar ao DynamoDB Local no Docker

### 4. Anexar o debugger do VS Code

1. Abra o VS Code no diretório do projeto
2. Vá para a aba "Run and Debug" (Ctrl+Shift+D ou Cmd+Shift+D)
3. Selecione a configuração "Debug SAM Local (Docker)"
4. Clique em "Start Debugging" (F5)

### 5. Definir breakpoints

- Abra qualquer arquivo TypeScript em `src/`
- Clique na margem esquerda para definir um breakpoint
- Faça uma requisição para a API (ex: `POST http://localhost:3000/categories`)

## Estrutura de Debug

- **Porta da API**: `3000`
- **Porta do Debugger**: `9229`
- **Protocolo**: Inspector (Node.js 8+)

## Troubleshooting

### O debugger não conecta

1. Verifique se o SAM Local está rodando em modo debug:

    ```bash
    # Você deve ver algo como:
    # Debugger listening on ws://127.0.0.1:9229/...
    ```

2. Verifique se a porta 9229 não está sendo usada por outro processo:

    ```bash
    lsof -i :9229  # macOS/Linux
    netstat -ano | findstr :9229  # Windows
    ```

3. Tente usar a configuração alternativa:
    - Selecione "Attach to SAM Local (Alternative Port)" no VS Code
    - Ou ajuste a porta no comando: `--debug-port 5858`

### Source maps não funcionam

1. Certifique-se de que `sourceMap: true` está no `tsconfig.json`
2. Recompile o projeto: `npm run build`
3. Verifique se os arquivos `.map` foram gerados em `dist/`

### Breakpoints não são acionados

1. Certifique-se de que os breakpoints estão nos arquivos `src/` (não em `dist/`)
2. Verifique se o caminho do arquivo corresponde exatamente
3. Tente colocar um `debugger;` statement no código como alternativa

### DynamoDB não conecta

1. Verifique se o DynamoDB Local está rodando:

    ```bash
    docker ps
    ```

2. Verifique a variável `DYNAMODB_ENDPOINT` no `deployment/env.json`:

    ```json
    "DYNAMODB_ENDPOINT": "http://dynamodb:8000"
    ```

3. Verifique se as tabelas foram criadas:
    ```bash
    npm run docker:init-db
    ```

## Variáveis de Ambiente

As variáveis de ambiente para debug estão em `deployment/env.json`:

- `NODE_ENV`: `development`
- `AWS_SAM_LOCAL`: `true`
- `DYNAMODB_ENDPOINT`: `http://dynamodb:8000`

## Comandos Úteis

```bash
# Iniciar em modo debug
npm run dev:debug

# Apenas iniciar o SAM Local (sem debug)
npm run dev

# Ver logs do SAM Local
# (Os logs aparecem no terminal onde o SAM Local está rodando)

# Parar o SAM Local
# Pressione Ctrl+C no terminal

# Ver logs do DynamoDB
npm run docker:logs
```

## Referências

- [AWS SAM Local Debugging](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-debugging.html)
- [VS Code Debugging](https://code.visualstudio.com/docs/nodejs/nodejs-debugging)
