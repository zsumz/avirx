import { endpoint, type AvirxEndpointDefinition, type AvirxInferSchema } from 'avirx';

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
    parse(input: unknown): { title: string } {
        return input as { title: string };
    },
};

const InvalidParamsSchema = {
    parse(input: unknown): { other: string } {
        return input as { other: string };
    },
};

const InvalidQuerySchema = {
    parse(input: unknown): { filter: { nested: string } } {
        return input as { filter: { nested: string } };
    },
};

const InvalidBodySchema = {
    parse(): () => void {
        return (): void => {
            return;
        };
    },
};

const BookSchema = {
    parse(input: unknown): { id: string; title: string } {
        return input as { id: string; title: string };
    },
};

const getBook = endpoint
    .get('/books/{id}')
    .params(ParamsSchema)
    .query(QuerySchema)
    .returns(BookSchema);
const createBook = endpoint.post('/books').body(BodySchema).returns(BookSchema);

type EndpointResponse = AvirxInferSchema<typeof getBook.state.responseSchema>;

const definition: AvirxEndpointDefinition<'GET', '/books/{id}'> = endpoint.get('/books/{id}');
const method: 'GET' = getBook.state.method;
const path: '/books/{id}' = getBook.state.path;
const params = getBook.state.paramsSchema.parse({ id: 'book_123' });
const query = getBook.state.querySchema.parse({ include: ['reviews'] });
const body = createBook.state.bodySchema.parse({ title: 'The Left Hand of Darkness' });
const book: EndpointResponse = getBook.state.responseSchema.parse({
    id: 'book_123',
    title: 'The Left Hand of Darkness',
});

// @ts-expect-error Endpoint method remains literal.
const wrongMethod: 'POST' = getBook.state.method;

// @ts-expect-error Endpoint path remains literal.
const wrongPath: '/books' = getBook.state.path;

// @ts-expect-error Params schema output requires a string id.
const wrongParams: { id: number } = getBook.state.paramsSchema.parse({ id: 'book_123' });

// @ts-expect-error Response schema output requires title.
const missingTitle: EndpointResponse = { id: 'book_123' };

// @ts-expect-error GET endpoint definitions do not expose body schemas.
void endpoint.get('/books').body(BodySchema);

// @ts-expect-error HEAD endpoint definitions do not expose body schemas.
void endpoint.head('/books').body(BodySchema);

// @ts-expect-error Params schema output must match route path params.
void endpoint.get('/books/{id}').params(InvalidParamsSchema);

// @ts-expect-error Query schema output must be query-compatible.
void endpoint.get('/books').query(InvalidQuerySchema);

// @ts-expect-error Body schema output must be body-compatible.
void endpoint.post('/books').body(InvalidBodySchema);

void definition;
void method;
void path;
void params;
void query;
void body;
void book;
void wrongMethod;
void wrongPath;
void wrongParams;
void missingTitle;
