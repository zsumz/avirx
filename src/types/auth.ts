export type AvirxAuthTokenProvider = () => Promise<string> | string;

export type AvirxAuthPolicy = Readonly<{
    kind: 'api-key-header';
    key: AvirxAuthTokenProvider;
    name: string;
}> | Readonly<{
    kind: 'api-key-query';
    key: AvirxAuthTokenProvider;
    name: string;
}> | Readonly<{
    kind: 'basic';
    password: string;
    username: string;
}> | Readonly<{
    kind: 'bearer';
    token: AvirxAuthTokenProvider;
}>;

export type AvirxAuthState = Readonly<{
    key: '[redacted]';
    kind: 'api-key-header';
    name: string;
}> | Readonly<{
    key: '[redacted]';
    kind: 'api-key-query';
    name: string;
}> | Readonly<{
    kind: 'basic';
    password: '[redacted]';
    username: string;
}> | Readonly<{
    kind: 'bearer';
    token: '[redacted]';
}>;

export type AvirxAuthBuilder<Owner> = Readonly<{
    apiKey(name: string, key: AvirxAuthTokenProvider): Owner;
    basic(username: string, password: string): Owner;
    bearer(token: AvirxAuthTokenProvider): Owner;
    query(name: string, key: AvirxAuthTokenProvider): Owner;
}>;
