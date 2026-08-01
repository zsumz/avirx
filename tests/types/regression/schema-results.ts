import { avirx, type AvirxResult } from 'avirx';

const client = avirx('https://api.example.com');
const UserSchema = {
    parse: (input: unknown) => input as { email: string; id: string },
};
const NarrowSchema = {
    parse(): Readonly<{ kind: 'user'; roles: readonly ['admin', 'member'] }> {
        return { kind: 'user', roles: ['admin', 'member'] };
    },
};
const ErrorSchema = {
    parse: (input: unknown) => input as { code: string; message: string },
};
interface User { email: string; id: string }
interface ApiError { code: string; message: string }

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
        // @ts-expect-error Result narrowing removes error from the ok branch.
        expectNever(result.error); // eslint-disable-line @typescript-eslint/no-unsafe-argument
        return result.data.id;
    }
    // @ts-expect-error Result narrowing removes data from the error branch.
    expectNever(result.data); // eslint-disable-line @typescript-eslint/no-unsafe-argument
    return result.error.message;
}

function expectNever(value: never): void {
    void value;
}

void schemaUser;
void wrongSchemaUser;
void narrowSchemaValue;
void wrongNarrowSchemaValue;
void errorResult;
void wrongErrorResult;
void handleResult;
