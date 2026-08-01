import { avirx, type AvirxPathParams } from 'avirx';

const client = avirx('https://api.example.com');
const limitedClient = client.concurrency(2);
const rateLimitedClient = client.rateLimit({ per: '1s', requests: 60 });
const cachedClient = client.cache({ maxBytes: 1024, ttl: '30s', methods: ['GET'], vary: ['accept'] });
const signaledClient = client.signal(new AbortController().signal);
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

void typedPath;
void limitedClient;
void rateLimitedClient;
void cachedClient;
void signaledClient;
