import { parseWithSchema, type AvirxInferSchema, type AvirxSchema } from 'avirx';

const UserSchema = {
    parse(input: unknown): { id: string; email: string } {
        return input as { id: string; email: string };
    },
};

type User = AvirxInferSchema<typeof UserSchema>;

const user: User = parseWithSchema(UserSchema, { id: 'usr_123', email: 'a@example.com' });
const schema: AvirxSchema<User> = UserSchema;

// @ts-expect-error Inferred schema output requires email.
const missingEmail: User = { id: 'usr_123' };

void user;
void schema;
void missingEmail;
