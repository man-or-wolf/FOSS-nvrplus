import { timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'koa';

/** Mask credentials in URLs (user:pass@) and query strings (password=). */
export function redact(text: string): string {
    return text
        .replace(/(:\/\/[^\s:/@]*:)[^\s@/]+@/g, '$1****@')
        .replace(/("(?:passwd|password)"\s*:\s*")[^"]*"/gi, '$1****"')
        .replace(/([?&](?:password|passwd|pwd|token)=)[^&\s"']*/gi, '$1****');
}

/** Redact secrets and special-char-safe literal replace. */
export function redactSecret(text: string, secret?: string): string {
    const out = redact(text);
    return secret ? out.split(secret).join('****') : out;
}

function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Optional HTTP basic auth, enabled when NVR_USER and NVR_PASSWORD are both set. */
export function createBasicAuth(user = process.env['NVR_USER'], pass = process.env['NVR_PASSWORD']) {
    if (!user || !pass) return null;
    return async (ctx: Context, next: Next) => {
        const m = /^Basic (.+)$/.exec(ctx.get('authorization'));
        const [u = '', ...p] = m ? Buffer.from(m[1]!, 'base64').toString().split(':') : [];
        if (m && safeEqual(u, user) && safeEqual(p.join(':'), pass)) return next();
        ctx.set('WWW-Authenticate', 'Basic realm="NVR"');
        ctx.status = 401;
        ctx.body = 'Unauthorized';
    };
}

export const isLoopback = (host: string) => ['127.0.0.1', 'localhost', '::1'].includes(host);
