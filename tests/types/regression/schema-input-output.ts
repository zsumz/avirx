import { avirx, endpoint, parseWithSchema, type AvirxResult, type AvirxSchema } from 'avirx';
import { z } from 'zod';

const client = avirx('https://api.example.com');
const AsyncUser = { parse: async (input: unknown) => Promise.resolve(input as { id: string }) };
const user: Promise<{ id: string }> = client.get('/users').as(AsyncUser);
const userResult: Promise<AvirxResult<{ id: string }>> = client.get('/users').result(AsyncUser);
const rawParse: Promise<{ id: string }> = parseWithSchema(AsyncUser, { id: '123' });
const query: AvirxSchema<{ limit: number }, { limit: string }> = {
    parse: (input) => ({ limit: Number(input.limit) }),
};
const api = client.contract({
    custom: endpoint.get('/custom').query(query).returns(AsyncUser),
    inspect: endpoint.head('/items'),
    zod: endpoint.get('/items').query(z.object({ limit: z.string().transform(Number) })),
    asyncInput: endpoint.get('/async').query({
        parse: async (input: { limit: string }) => Promise.resolve({ limit: Number(input.limit) }),
    }),
});
const custom: Promise<{ id: string }> = api.custom({ query: { limit: '10' } });
const head: Promise<undefined> = api.inspect({});
const headResult: Promise<AvirxResult<undefined>> = api.inspect.result({});
void api.zod({ query: { limit: '10' } });
void api.asyncInput({ query: { limit: '10' } });
// @ts-expect-error Custom schema callers provide input rather than transformed output.
void api.custom({ query: { limit: 10 } });
// @ts-expect-error Zod transforms preserve their input shape at the call boundary.
void api.zod({ query: { limit: 10 } });
// @ts-expect-error Asynchronous transforms retain the declared input type.
void api.asyncInput({ query: { limit: 10 } });
// @ts-expect-error Awaited response schema output is not another Promise.
const wrong: Promise<AvirxResult<Promise<{ id: string }>>> = client.get('/users').result(AsyncUser);

void user;
void userResult;
void rawParse;
void custom;
void head;
void headResult;
void wrong;
