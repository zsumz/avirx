import {
    avirx,
    endpoint,
    type AvirxContractClient,
    type AvirxEndpointContract,
    type AvirxRequestBuilder,
    type AvirxPathParamNames,
} from 'avirx';

const client = avirx('https://api.example.com');
const plain: AvirxRequestBuilder = client.get('/users');
const templated: AvirxRequestBuilder = client.get('/users/{id}');
const writable: AvirxRequestBuilder = client.post('/users/{id}');

function withHeader(request: AvirxRequestBuilder): AvirxRequestBuilder {
    return request.header('x-request', 'shared');
}

withHeader(client.get('/users'));
withHeader(client.get('/users/{id}').path({ id: '123' }));
withHeader(client.post('/users').body({ name: 'Example' }));
// @ts-expect-error Unknown properties reject without depending on noUncheckedIndexedAccess.
void client.get('/users').notARequestMethod;
// @ts-expect-error Templated builders also reject unknown properties.
void client.post('/users/{id}').notARequestMethod;
// @ts-expect-error GET builders do not expose bodies.
void client.get('/users/{id}').body;
// @ts-expect-error HEAD builders do not expose multipart bodies.
void client.head('/users/{id}').multipart;
// @ts-expect-error Pathless builders do not expose path input.
void client.post('/users').path;

// @ts-expect-error The then key would turn a returned contract into an accidental thenable.
client.contract({ then: endpoint.get('/unexpected') });
const symbol = Symbol('endpoint');
// @ts-expect-error Contract endpoint names are strings, including when passed through variables.
client.contract({ [symbol]: endpoint.get('/unexpected') });

async function adoptContract(contract: AvirxContractClient<AvirxEndpointContract>): Promise<typeof contract> {
    // @ts-expect-error Broad contract views do not advertise unsupported symbol endpoints.
    void contract[symbol];
    return Promise.resolve(contract);
}

const extra = { parse: () => ({ id: '123', extra: true }) };
const asyncExtra = { parse: async () => Promise.resolve({ id: '123', extra: true }) };
const optionalExtra = { parse: (): { id: string; extra?: string } => ({ id: '123' }) };
const unionExtra = {
    parse: (input: unknown): { id: string } | { id: string; extra: boolean } =>
        input ? { id: '123' } : { id: '123', extra: true },
};
// @ts-expect-error Path parser outputs must contain exactly the route's parameter keys.
endpoint.get('/users/{id}').params(extra);
// @ts-expect-error Awaited parser output must also have exact keys.
endpoint.get('/users/{id}').params(asyncExtra);
// @ts-expect-error Optional extra keys are unsupported at runtime too.
endpoint.get('/users/{id}').params(optionalExtra);
// @ts-expect-error Extra keys on any union member are unsupported.
endpoint.get('/users/{id}').params(unionExtra);
endpoint.get('/users/{id}').params({
    parse: async (input: { raw: number }) => Promise.resolve({ id: String(input.raw) }),
});

const supportedName: AvirxPathParamNames<'/{v1.id}/{urn:id}/{用户}/{x-y}'> = '用户';
// @ts-expect-error Parameter names cannot contain URL separators.
const unsupportedName: AvirxPathParamNames<'/{a/b}'> = 'a/b';
// @ts-expect-error Malformed braces never produce a supported parameter name.
const malformedName: AvirxPathParamNames<'/{broken{nested}'> = 'broken{nested';
void plain;
void templated;
void writable;
void supportedName;
void unsupportedName;
void malformedName;
void adoptContract;
