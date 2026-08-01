import { describe, expect, it } from 'vitest';
import { cloneFormData, prepareBodyState } from '../../../src/internals/body-state.js';
import { createRequestState } from '../../../src/internals/model.js';

describe('body state utilities', () => {
    it('serializes JSON bodies and adds content-type only when absent', () => {
        const state = createRequestState('POST', '/events');

        const prepared = prepareBodyState({}, state, { ok: true });

        expect(prepared).toEqual({
            body: '{"ok":true}',
            bodyMetadata: {
                contentLength: 11,
                contentType: 'application/json',
                kind: 'json',
            },
            headers: {
                'content-type': 'application/json',
            },
        });

        expect(prepareBodyState({ 'content-type': 'text/plain' }, state, { ok: true }).headers).toEqual({});
        expect(prepareBodyState({}, {
            ...state,
            headers: { 'content-type': 'application/custom+json' },
        }, { ok: true }).headers).toEqual({ 'content-type': 'application/custom+json' });
    });

    it('clones replayable mutable body values before storing request state', () => {
        const state = createRequestState('POST', '/events');
        const params = new URLSearchParams({ tag: 'a' });
        const buffer = new ArrayBuffer(2);
        const data = new FormData();
        data.append('name', 'avatar');

        const preparedParams = prepareBodyState({}, state, params);
        const preparedBuffer = prepareBodyState({}, state, buffer);
        const preparedForm = prepareBodyState({}, state, data);
        params.set('tag', 'changed');
        new Uint8Array(buffer)[0] = 255;
        data.append('extra', 'later');

        expect(preparedParams.body).toBeInstanceOf(URLSearchParams);
        expect((preparedParams.body as URLSearchParams).toString()).toBe('tag=a');
        expect(preparedBuffer.body).toBeInstanceOf(ArrayBuffer);
        expect(new Uint8Array(preparedBuffer.body as ArrayBuffer)[0]).toBe(0);
        expect(preparedForm.body).toBeInstanceOf(FormData);
        expect((preparedForm.body as FormData).getAll('extra')).toEqual([]);
    });

    it('rejects multipart clones from non-FormData body state', () => {
        expect(() => cloneFormData('not-form')).toThrow(
            'Expected multipart body state to contain FormData.',
        );
    });
});
