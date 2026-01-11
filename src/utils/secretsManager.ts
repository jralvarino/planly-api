import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const SECRET_NAME = "planly/jwt";

// Cache do secret para evitar múltiplas chamadas
let cachedSecret: string | null = null;

// Detectar se está rodando localmente
const isLocal =
    !process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "development" ||
    process.env.AWS_SAM_LOCAL === "true";

/**
 * Busca o secret JWT da AWS Secrets Manager ou usa variável de ambiente em desenvolvimento
 */
export async function getJwtSecret(): Promise<string> {
    // Se já temos o secret em cache, retornar
    if (cachedSecret) {
        return cachedSecret;
    }

    // Em ambiente local, usar variável de ambiente como fallback
    if (isLocal) {
        const localSecret = process.env.JWT_SECRET;
        if (localSecret) {
            cachedSecret = localSecret;
            console.log("🔑 Usando JWT_SECRET da variável de ambiente (ambiente local)");
            return cachedSecret;
        }
    }

    try {
        // Configurar cliente do Secrets Manager
        const clientConfig: any = {
            region: process.env.AWS_REGION || "us-east-1",
        };

        // Para ambiente local, usar endpoint mock se necessário
        if (isLocal && process.env.SECRETS_MANAGER_ENDPOINT) {
            clientConfig.endpoint = process.env.SECRETS_MANAGER_ENDPOINT;
        }

        const client = new SecretsManagerClient(clientConfig);

        // Buscar o secret
        const command = new GetSecretValueCommand({
            SecretId: SECRET_NAME,
        });

        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error(`Secret ${SECRET_NAME} não contém um valor string`);
        }

        // O secret pode ser um JSON string ou apenas uma string
        let secretValue: string;
        try {
            const parsed = JSON.parse(response.SecretString);
            // Se for um objeto, tentar pegar a propriedade 'secret' ou 'jwt' ou usar o valor direto
            secretValue = parsed.secret || parsed.jwt || parsed.value || response.SecretString;
        } catch {
            // Se não for JSON, usar o valor direto
            secretValue = response.SecretString;
        }

        cachedSecret = secretValue;
        console.log(`🔑 Secret JWT recuperado da AWS Secrets Manager: ${SECRET_NAME}`);

        return cachedSecret;
    } catch (error: any) {
        console.error(`❌ Erro ao buscar secret ${SECRET_NAME}:`, error.message);

        // Fallback para variável de ambiente se houver erro
        const fallbackSecret = process.env.JWT_SECRET || "your-secret-key-change-in-production";
        console.warn(`⚠️  Usando fallback JWT_SECRET da variável de ambiente`);

        cachedSecret = fallbackSecret;
        return cachedSecret;
    }
}
