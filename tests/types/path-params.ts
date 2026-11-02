import { avirx, type AvirxPathParamNames, type AvirxPathParams } from 'avirx';

const client = avirx('https://api.example.com');

type BookRoute = '/workspaces/{workspaceId}/books/{bookId}';

const paramName: AvirxPathParamNames<BookRoute> = 'bookId';
const params: AvirxPathParams<BookRoute> = {
    bookId: 'book_123',
    workspaceId: 'wrk_123',
};
const variableParams = {
    id: 'usr_123',
};
const extraVariableParams = {
    extra: 'nope',
    id: 'usr_123',
};
const extraMultiParamVariable = {
    bookId: 'book_123',
    unexpected: 'nope',
    workspaceId: 'wrk_123',
};

client.get('/workspaces/{workspaceId}/books/{bookId}').path(params);
client.get('/workspaces/{workspaceId}/books/{bookId}').path({
    bookId: 'book_123',
    workspaceId: 'wrk_123',
});
client.get('/users/{id}').path({ id: 'usr_123' });
client.get('/users/{id}').path(variableParams);
client.get('/users');

// @ts-expect-error Missing bookId should fail.
client.get('/workspaces/{workspaceId}/books/{bookId}').path({ workspaceId: 'wrk_123' });

// @ts-expect-error Extra params should fail for literal routes.
client.get('/users/{id}').path({ extra: 'nope', id: 'usr_123' });

// @ts-expect-error Extra params should fail when passed through variables.
client.get('/users/{id}').path(extraVariableParams);

// @ts-expect-error Extra params should fail for multi-param route variables.
client.get('/workspaces/{workspaceId}/books/{bookId}').path(extraMultiParamVariable);

// @ts-expect-error Routes without params do not expose .path().
void client.get('/users').path;

void paramName;
