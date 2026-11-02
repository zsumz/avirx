import { expect } from 'vitest';
import { avirx, type AvirxBodyValue, type AvirxClientOptions, type AvirxRequestBuilder } from 'avirx';

interface BodyCase {
    name: string;
    create(): AvirxBodyValue;
    contentType?: string;
    text?: string;
}

export const bodyCases: readonly BodyCase[] = [
    { name: 'json', create: () => ({ ok: true }), contentType: 'application/json', text: '{"ok":true}' },
    { name: 'text', create: () => 'hello', contentType: 'text/plain;charset=UTF-8', text: 'hello' },
    {
        name: 'query', create: () => new URLSearchParams({ x: 'value' }),
        contentType: 'application/x-www-form-urlencoded;charset=UTF-8', text: 'x=value',
    },
    { name: 'blob', create: () => new Blob(['blob'], { type: 'application/custom' }),
        contentType: 'application/custom', text: 'blob' },
    { name: 'buffer', create: () => new TextEncoder().encode('bin').buffer, text: 'bin' },
    {
        name: 'form', create: (): FormData => {
            const form = new FormData();
            form.set('x', 'value');
            return form;
        },
    },
    { name: 'stream', create: () => new Blob(['chunk']).stream(), text: 'chunk' },
    { name: 'undefined', create: () => undefined, text: '' },
    { name: 'null', create: () => null, text: '' },
];

export function createBodyTransition(
    origin: string,
    source: BodyCase,
    target: BodyCase,
    explicit: string | undefined,
    placement: 'client' | 'before' | 'between' | 'after' = 'between',
    options: AvirxClientOptions = {},
): AvirxRequestBuilder<'/body', true> {
    const client = avirx(origin, options);
    let request = (placement === 'client' && explicit !== undefined
        ? client.header('Content-Type', explicit) : client).post('/body');
    if (placement === 'before' && explicit !== undefined) request = request.headers({ 'Content-Type': explicit });
    request = request.body(source.create()).header('x-derived', 'yes');
    if (placement === 'between' && explicit !== undefined) request = request.header('Content-Type', explicit);
    request = request.body(target.create()).query({ derived: true });
    if (placement === 'after' && explicit !== undefined) request = request.headers({ 'Content-Type': explicit });
    return request;
}

export function expectBodyTransition(
    target: BodyCase,
    contentType: string | undefined,
    text: string,
    explicit: string | undefined,
): void {
    if (target.name === 'form') {
        if (explicit === undefined) {
            expect(contentType).toMatch(/^multipart\/form-data; boundary=/u);
            const boundary = contentType?.split('boundary=')[1];
            expect(text).toContain(`--${boundary ?? ''}\r\n`);
        } else expect(contentType).toBe(explicit);
        expect(text).toContain('name="x"\r\n\r\nvalue');
    } else {
        expect(contentType).toBe(explicit ?? target.contentType);
        expect(text).toBe(target.text);
    }
}
