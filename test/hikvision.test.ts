import { describe, it, expect } from 'vitest';
import { parseDigestChallenge, buildDigestAuthHeader, parseLatestVmdState } from '../server/hikvision.js';

describe('parseDigestChallenge', () => {
    it('parses a standard qop=auth challenge', () => {
        const header = 'Digest realm="DS-2CD2143G0", qop="auth", nonce="abc123", opaque="xyz"';
        expect(parseDigestChallenge(header)).toEqual({
            realm: 'DS-2CD2143G0', nonce: 'abc123', qop: 'auth', opaque: 'xyz'
        });
    });
    it('parses a legacy challenge with no qop', () => {
        const header = 'Digest realm="cam", nonce="n1"';
        expect(parseDigestChallenge(header)).toEqual({ realm: 'cam', nonce: 'n1' });
    });
    it('returns null for a non-Digest or malformed header', () => {
        expect(parseDigestChallenge('Basic realm="cam"')).toBeNull();
        expect(parseDigestChallenge('Digest nonce="n1"')).toBeNull();
    });
});

describe('buildDigestAuthHeader', () => {
    // RFC 2617 section 3.5 worked example
    it('matches the RFC 2617 worked example (qop=auth)', () => {
        const challenge = { realm: 'testrealm@host.com', nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093', qop: 'auth', opaque: '5ccc069c403ebaf9f0171e9517f40e41' };
        const header = buildDigestAuthHeader('Mufasa', 'Circle Of Life', 'GET', '/dir/index.html', challenge, '00000001', '0a4f113b');
        expect(header).toContain('response="6629fae49393a05397450978507c4ef1"');
    });
    it('falls back to legacy MD5(HA1:nonce:HA2) with no qop', () => {
        const challenge = { realm: 'cam', nonce: 'n1' };
        const header = buildDigestAuthHeader('u', 'p', 'GET', '/x', challenge);
        expect(header).not.toContain('qop=');
        expect(header).toContain('username="u"');
    });
});

describe('parseLatestVmdState', () => {
    it('reads an active VMD event', () => {
        const chunk = `--boundary
Content-Type: application/xml

<EventNotificationAlert><eventType>VMD</eventType><eventState>active</eventState></EventNotificationAlert>
`;
        expect(parseLatestVmdState(chunk)).toBe(true);
    });
    it('reads an inactive VMD event', () => {
        const chunk = '<eventType>VMD</eventType><eventState>inactive</eventState>';
        expect(parseLatestVmdState(chunk)).toBe(false);
    });
    it('ignores non-VMD events and takes the latest VMD state', () => {
        const chunk = `
<eventType>videoloss</eventType><eventState>active</eventState>
<eventType>VMD</eventType><eventState>active</eventState>
<eventType>VMD</eventType><eventState>inactive</eventState>
`;
        expect(parseLatestVmdState(chunk)).toBe(false);
    });
    it('returns null when no VMD event is present', () => {
        expect(parseLatestVmdState('')).toBeNull();
        expect(parseLatestVmdState('<eventType>videoloss</eventType><eventState>active</eventState>')).toBeNull();
    });
});
