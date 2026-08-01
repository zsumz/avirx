export type Book = Readonly<{
    id: string;
    title: string;
}>;

export type ApiError = Readonly<{
    code: string;
    message: string;
}>;

export type ProductionExampleSummary = Readonly<{
    authenticatedBook: Book;
    cacheFetches: number;
    cachedBook: Book;
    cancellation: Readonly<{
        message: string;
        ok: false;
    }>;
    contractBook: Book;
    unauthorized: Readonly<{
        code: string;
        ok: false;
        status: number;
    }>;
}>;

export type ExampleCall = Readonly<{
    authorization?: string;
    method: string;
    url: string;
}>;

export type ProductionMockApi = Readonly<{
    baseUrl: string;
    calls: ExampleCall[];
    fetch: typeof fetch;
}>;
