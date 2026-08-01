import { avirx, endpoint, type AvirxResult } from 'avirx';

const client = avirx('https://api.example.com');
const ParamsSchema = { parse: (input: unknown) => input as { id: string } };
const QuerySchema = {
    parse: (input: unknown) => input as { include?: readonly string[] },
};
const BodySchema = {
    parse: (input: unknown) => input as { email: string; role?: 'admin' | 'member' },
};
const UserSchema = {
    parse: (input: unknown) => input as { email: string; id: string },
};
interface User { email: string; id: string }

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

void contractUser;
void contractResult;
void updatedUser;
void createdUser;
void wrongContractResult;
