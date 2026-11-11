/**
 * Hikvision ISAPI motion-detection adapter.
 *
 * Hikvision has no simple poll-and-get-current-state call like Reolink's
 * GetMdState. The documented mechanism is the alertStream: a long-lived
 * multipart/mixed HTTP connection that pushes an <EventNotificationAlert>
 * XML block whenever a configured event (VMD among them) changes state.
 * To fit the existing poll-based detectCameraMovement() model, each poll
 * opens that connection, reads whatever arrives within a short window,
 * and takes the most recent VMD eventState seen -- then closes it. No
 * state is kept between polls.
 *
 * Auth: ISAPI typically requires Digest, not Basic -- this does the
 * two-step handshake (probe for a 401 challenge, then retry with the
 * computed Digest header) using only node:crypto, no dependency.
 *
 * NOT YET VERIFIED AGAINST REAL HARDWARE: shop door (10.50.0.20) and lot
 * (10.50.0.21) cameras are still unwired (networked-nvr-tasks.md item 2,
 * HOLD). The digest/XML parsing logic has unit coverage against known
 * vectors and synthetic alertStream fixtures; the live ISAPI behavior
 * (auth scheme actually offered, exact XML namespace/shape, whether the
 * firmware emits VMD at all vs. only smart-detection events) needs
 * confirming once a camera is reachable.
 */
import http, { type IncomingMessage, type ClientRequest } from 'node:http';
import crypto from 'node:crypto';

export interface DigestChallenge {
    realm: string;
    nonce: string;
    qop?: string;
    opaque?: string;
}

/** Parse a WWW-Authenticate: Digest ... challenge header. */
export function parseDigestChallenge(header: string): DigestChallenge | null {
    const m = /^Digest\s+(.*)$/i.exec(header.trim());
    if (!m) return null;
    const parts: Record<string, string> = {};
    const re = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(m[1]!))) {
        parts[mm[1]!] = mm[2] ?? mm[3] ?? '';
    }
    if (!parts['realm'] || !parts['nonce']) return null;
    const challenge: DigestChallenge = { realm: parts['realm'], nonce: parts['nonce'] };
    if (parts['qop']) challenge.qop = parts['qop'];
    if (parts['opaque']) challenge.opaque = parts['opaque'];
    return challenge;
}

/** Build an Authorization: Digest header per RFC 2617 (qop=auth or legacy). */
export function buildDigestAuthHeader(
    user: string,
    pass: string,
    method: string,
    uri: string,
    challenge: DigestChallenge,
    nc = '00000001',
    cnonce = crypto.randomBytes(8).toString('hex')
): string {
    const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');
    const ha1 = md5(`${user}:${challenge.realm}:${pass}`);
    const ha2 = md5(`${method}:${uri}`);
    const qop = challenge.qop ? challenge.qop.split(',')[0]!.trim() : undefined;
    const response = qop
        ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
        : md5(`${ha1}:${challenge.nonce}:${ha2}`);
    const parts = [
        `username="${user}"`,
        `realm="${challenge.realm}"`,
        `nonce="${challenge.nonce}"`,
        `uri="${uri}"`,
        `response="${response}"`,
    ];
    if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
    if (qop) {
        parts.push(`qop=${qop}`);
        parts.push(`nc=${nc}`);
        parts.push(`cnonce="${cnonce}"`);
    }
    return `Digest ${parts.join(', ')}`;
}

/** Scan an accumulated alertStream chunk for the most recent VMD eventState. */
export function parseLatestVmdState(chunk: string): boolean | null {
    const re = /<eventType>\s*VMD\s*<\/eventType>[\s\S]*?<eventState>\s*(active|inactive)\s*<\/eventState>/gi;
    let last: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk))) {
        last = m[1]!.toLowerCase();
    }
    return last === null ? null : last === 'active';
}

function requestOnce(ip: string, uriPath: string, authHeader?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; stream: IncomingMessage; req: ClientRequest }> {
    return new Promise((resolve, reject) => {
        const req = http.get({
            host: ip,
            path: uriPath,
            headers: authHeader ? { Authorization: authHeader } : {},
            timeout: 5000,
        }, (res) => resolve({ status: res.statusCode || 0, headers: res.headers, stream: res, req }));
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('Request timeout')));
    });
}

/**
 * Poll a Hikvision camera's alertStream for a short window and return
 * whether the most recent VMD event seen in that window was 'active'.
 * Returns false if no VMD event arrived in the window (matches Reolink's
 * semantics: absence of a signal means no reported movement).
 */
export async function fetchHikvisionMotionState(
    ip: string,
    user: string,
    pass: string,
    motionUrl?: string,
    readWindowMs = 1500
): Promise<boolean> {
    // motionUrl may override the full URL (host + path), matching the
    // existing Reolink convention; otherwise default to ip + the
    // standard ISAPI alertStream path.
    let host = ip;
    let uriPath = '/ISAPI/Event/notification/alertStream';
    if (motionUrl) {
        const parsed = new URL(motionUrl);
        host = parsed.hostname;
        uriPath = parsed.pathname + parsed.search;
    }

    let { status, headers, stream, req } = await requestOnce(host, uriPath);

    if (status === 401) {
        stream.destroy();
        const challengeHeader = headers['www-authenticate'];
        const challenge = challengeHeader ? parseDigestChallenge(Array.isArray(challengeHeader) ? challengeHeader[0]! : challengeHeader) : null;
        if (!challenge) throw new Error('Hikvision ISAPI: 401 with no usable Digest challenge');
        const authHeader = buildDigestAuthHeader(user, pass, 'GET', uriPath, challenge);
        ({ status, stream, req } = await requestOnce(host, uriPath, authHeader));
    }

    if (status !== 200) {
        stream.destroy();
        throw new Error(`Hikvision ISAPI: unexpected status ${status}`);
    }

    return new Promise((resolve, reject) => {
        let buf = '';
        const finish = (value: boolean | Error) => {
            req.destroy();
            stream.destroy();
            if (value instanceof Error) reject(value);
            else resolve(value);
        };
        const timer = setTimeout(() => finish(parseLatestVmdState(buf) ?? false), readWindowMs);
        stream.on('data', (d: Buffer) => { buf += d.toString('utf8'); });
        stream.on('error', (e) => { clearTimeout(timer); finish(e); });
        stream.on('end', () => { clearTimeout(timer); finish(parseLatestVmdState(buf) ?? false); });
    });
}
