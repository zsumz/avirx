import { avirx, endpoint, type AvirxContractInput, type AvirxContractOutput, type AvirxResult } from 'avirx';

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
const api = avirx('https://api.example.com').contract({
    createBook,
    getBook,
});

type GetBookInput = AvirxContractInput<typeof getBook>;
type GetBookOutput = AvirxContractOutput<typeof getBook>;

const input: GetBookInput = {
    path: { id: 'book_123' },
    query: { include: ['reviews'] },
};
const output: Promise<GetBookOutput> = api.getBook(input);
const result: Promise<AvirxResult<GetBookOutput>> = api.getBook.result(input);
const created: Promise<{ id: string; title: string }> = api.createBook({
    body: { title: 'The Left Hand of Darkness' },
});

// @ts-expect-error Contract path input is required for the endpoint params schema.
void api.getBook({ query: { include: ['reviews'] } });

// @ts-expect-error Contract query input must match the endpoint query schema.
void api.getBook({ path: { id: 'book_123' }, query: { include: [123] } });

// @ts-expect-error Contract result input must match the endpoint input.
void api.getBook.result({ path: { id: 123 } });

// @ts-expect-error Contract body input is required for the endpoint body schema.
void api.createBook({});

// @ts-expect-error Response output is inferred from .returns().
const wrongOutput: Promise<{ id: number }> = api.getBook({ path: { id: 'book_123' } });

void input;
void output;
void result;
void created;
void wrongOutput;
