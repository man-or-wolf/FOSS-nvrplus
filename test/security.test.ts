import { describe, it, expect } from 'vitest';
import { redact, redactSecret, createBasicAuth } from '../server/security.js';

describe('redact', () => {
    it('masks URL credentials, query passwords and JSON passwd', () => {
        expect(redact('rtsp://admin:p%40ss@10.0.0.2:554/x')).toBe('rtsp://admin:****@10.0.0.2:554/x');
        expect(redact('http://h/api?cmd=a&password=sec&x=1')).toBe('http://h/api?cmd=a&password=****&x=1');
        expect(redact('{"passwd":"sec","ip":"1"}')).toBe('{"passwd":"****","ip":"1"}');
    });
    it('handles regex-special secrets', () => {
        expect(redactSecret('fail pw a(b[c', 'a(b[c')).toBe('fail pw ****');
    });
});

describe('basic auth', () => {
    it('is disabled without credentials', () => {
        expect(createBasicAuth(undefined, undefined)).toBeNull();
    });
    it('allows valid and rejects invalid credentials', async () => {
        const mw = createBasicAuth('u', 'p:w')!;
        const mk = (h: string) => ({ get: () => h, set() {}, status: 0, body: '' }) as any;
        const ok = mk('Basic ' + Buffer.from('u:p:w').toString('base64'));
        let called = false;
        await mw(ok, async () => { called = true; });
        expect(called).toBe(true);
        const bad = mk('Basic ' + Buffer.from('u:x').toString('base64'));
        await mw(bad, async () => { throw new Error('no'); });
        expect(bad.status).toBe(401);
    });
});
