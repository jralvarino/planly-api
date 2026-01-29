/**
 * Mock do DynamoDB para testes (evita ENOTFOUND dynamodb quando rodando fora do Docker).
 * O teste configura globalThis.__ddbMockResponses = [{ Item: ... }, {}] antes de chamar o serviço.
 */
function getResponses() {
    return globalThis.__ddbMockResponses ?? [];
}

const ddb = {
    send: function mockSend() {
        const responses = getResponses();
        const value = responses.shift();
        return Promise.resolve(value !== undefined ? value : {});
    },
};

module.exports = { ddb };
