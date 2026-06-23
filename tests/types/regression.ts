import { avirx, endpoint, type AvirxPathParams, type AvirxResult } from 'avirx';

const client = avirx('https://api.example.com');
const limitedClient = client.concurrency(2);
const rateLimitedClient = client.rateLimit({ per: '1s', requests: 60 });
const cachedClient = client.cache({ maxBytes: 1024, ttl: '30s', methods: ['GET'], vary: ['accept'] });
const signaledClient = client.signal(new AbortController().signal);

const ParamsSchema = {
    parse(input: unknown): { id: string } {
        return input as { id: string };
    },
};

const QuerySchema = {
    parse(input: unknown): { include?: readonly string[] } {
        return input as { include?: readonly string[] };
    },
};

const BodySchema = {
    parse(input: unknown): { email: string; role?: 'admin' | 'member' } {
        return input as { email: string; role?: 'admin' | 'member' };
    },
};

const UserSchema = {
    parse(input: unknown): { email: string; id: string } {
        return input as { email: string; id: string };
    },
};

const NarrowSchema = {
    parse(): Readonly<{ kind: 'user'; roles: readonly ['admin', 'member'] }> {
        return {
            kind: 'user',
            roles: ['admin', 'member'],
        };
    },
};

const ErrorSchema = {
    parse(input: unknown): { code: string; message: string } {
        return input as { code: string; message: string };
    },
};

interface User { email: string; id: string }
interface ApiError { code: string; message: string }

const typedPath: AvirxPathParams<'/users/{id}/teams/{teamId}'> = {
    id: 'usr_123',
    teamId: 'team_123',
};
const extraTypedPathVariable = {
    extra: 'nope',
    id: 'usr_123',
    teamId: 'team_123',
};

client.get('/users/{id}/teams/{teamId}').path(typedPath);

// @ts-expect-error Typed paths reject missing route params.
client.get('/users/{id}/teams/{teamId}').path({ id: 'usr_123' });

// @ts-expect-error Typed paths reject extra variable keys.
client.get('/users/{id}/teams/{teamId}').path(extraTypedPathVariable);

// @ts-expect-error GET requests do not expose .body().
void client.get('/users').body({ email: 'a@example.com' });
// @ts-expect-error GET requests do not expose .multipart().
void client.get('/users').multipart();

// @ts-expect-error HEAD requests do not expose .body().
void client.head('/users').body({ email: 'a@example.com' });
// @ts-expect-error HEAD requests do not expose .multipart().
void client.head('/users').multipart();

// @ts-expect-error Routes without params do not expose .path().
void client.get('/users').path({});

// @ts-expect-error Concurrency is a client policy, not a request policy.
void client.get('/users').concurrency(2);

// @ts-expect-error Concurrency limits must be numeric.
void client.concurrency('2');

// @ts-expect-error Rate limiting is a client policy, not a request policy.
void client.get('/users').rateLimit({ per: '1s', requests: 60 });

// @ts-expect-error Cache is a client policy, not a request policy.
void client.get('/users').cache({ ttl: '30s' });

// @ts-expect-error Cache ttl is required.
void client.cache({});

// @ts-expect-error Cache methods currently support cache-safe methods only.
void client.cache({ ttl: '30s', methods: ['POST'] });

// @ts-expect-error Cache maxBytes must be numeric.
void client.cache({ maxBytes: '1024', ttl: '30s' });

void client.get('/users').signal(new AbortController().signal);

// @ts-expect-error Signals must be AbortSignal instances.
void client.signal('cancel');

// @ts-expect-error Request signals must be AbortSignal instances.
void client.get('/users').signal('cancel');

// @ts-expect-error Rate limit input requires a window.
void client.rateLimit({ requests: 60 });

// @ts-expect-error Rate limit input requires request count.
void client.rateLimit({ per: '1s' });

const getUserEndpoint = endpoint
    .get('/users/{id}')
    .params(ParamsSchema)
    .query(QuerySchema)
    .returns(UserSchema);

const updateUserEndpoint = endpoint
    .put('/users/{id}')
    .params(ParamsSchema)
    .query(QuerySchema)
    .body(BodySchema)
    .returns(UserSchema);

const createUserEndpoint = endpoint
    .post('/users')
    .body(BodySchema)
    .returns(UserSchema);

const api = client.contract({
    createUser: createUserEndpoint,
    getUser: getUserEndpoint,
    updateUser: updateUserEndpoint,
});

const contractUser: Promise<User> = api.getUser({
    path: { id: 'usr_123' },
    query: { include: ['teams'] },
});

const contractResult: Promise<AvirxResult<User>> = api.getUser.result({
    path: { id: 'usr_123' },
    query: { include: ['teams'] },
});

const updatedUser: Promise<User> = api.updateUser({
    body: { email: 'updated@example.com', role: 'admin' },
    path: { id: 'usr_123' },
    query: { include: ['teams'] },
});

const createdUser: Promise<User> = api.createUser({
    body: { email: 'new@example.com' },
});

// @ts-expect-error Contract input inference rejects invalid query values.
void api.getUser({ path: { id: 'usr_123' }, query: { include: [123] } });

// @ts-expect-error Contract input inference requires body when a body schema exists.
void api.createUser({});

// @ts-expect-error Contract input inference rejects path when no path params exist.
void api.createUser({ body: { email: 'new@example.com' }, path: { id: 'usr_123' } });

// @ts-expect-error Contract input inference rejects invalid body unions.
void api.updateUser({ body: { email: 'a@example.com', role: 'owner' }, path: { id: 'usr_123' } });

// @ts-expect-error Contract result output is inferred from the endpoint response schema.
const wrongContractResult: Promise<AvirxResult<{ id: number }>> = api.getUser.result({
    path: { id: 'usr_123' },
    query: { include: ['teams'] },
});

const schemaUser: Promise<User> = client.get('/users/{id}').path({ id: 'usr_123' }).as(UserSchema);

// @ts-expect-error Schema output inference preserves field types.
const wrongSchemaUser: Promise<{ email: number; id: string }> = client
    .get('/users/{id}')
    .path({ id: 'usr_123' })
    .as(UserSchema);

const narrowSchemaValue: Promise<Readonly<{ kind: 'user'; roles: readonly ['admin', 'member'] }>> = client
    .get('/narrow')
    .as(NarrowSchema);

// @ts-expect-error Schema inference preserves readonly narrow literal output.
const wrongNarrowSchemaValue: Promise<Readonly<{ kind: 'org'; roles: readonly ['admin', 'member'] }>> = client
    .get('/narrow')
    .as(NarrowSchema);

const errorResult: Promise<AvirxResult<User, ApiError>> = client
    .get('/users/{id}')
    .path({ id: 'usr_123' })
    .error(ErrorSchema)
    .result(UserSchema);

// @ts-expect-error Error schema inference preserves the parsed error body shape.
const wrongErrorResult: Promise<AvirxResult<User, { code: number }>> = client
    .get('/users/{id}')
    .path({ id: 'usr_123' })
    .error(ErrorSchema)
    .result(UserSchema);

function handleResult(result: AvirxResult<User, ApiError>): string {
    if (result.ok) {
        const email = result.data.email;
        // @ts-expect-error Result narrowing removes error from the ok branch.
        expectNever(result.error); // eslint-disable-line @typescript-eslint/no-unsafe-argument
        void email;
        return result.data.id;
    }

    const code = result.error.data?.code;
    // @ts-expect-error Result narrowing removes data from the error branch.
    expectNever(result.data); // eslint-disable-line @typescript-eslint/no-unsafe-argument
    void code;
    return result.error.message;
}

function expectNever(value: never): void {
    void value;
}

void typedPath;
void contractUser;
void contractResult;
void updatedUser;
void createdUser;
void wrongContractResult;
void schemaUser;
void wrongSchemaUser;
void narrowSchemaValue;
void wrongNarrowSchemaValue;
void errorResult;
void wrongErrorResult;
void handleResult;
void limitedClient;
void rateLimitedClient;
void cachedClient;
void signaledClient;
