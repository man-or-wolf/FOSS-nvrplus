import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../server/index.js';
import { createServer as createHttp, type Server } from 'node:http';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * End-to-end pipeline: looping file "camera" -> ffmpeg HLS -> simulated motion API
 * -> movement record -> frame extraction -> stub ML detector -> completed movement.
 * Needs ffmpeg and python3 (the stub detector has no third-party deps).
 */
const FFMPEG = process.env['FFMPEG_PATH'] || '/usr/bin/ffmpeg';
const hasFfmpeg = spawnSync(FFMPEG, ['-version']).status === 0;

async function waitFor<T>(fn: () => Promise<T | undefined | false>, ms: number, what: string): Promise<T> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const v = await fn();
        if (v) return v;
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`Timed out waiting for ${what}`);
}

describe.skipIf(!hasFfmpeg)('movement pipeline (e2e)', () => {
    let tmp: string;
    let server: Awaited<ReturnType<typeof createServer>>;
    let motion: Server;
    let motionState = 0;
    let motionUrl: string;

    beforeAll(async () => {
        tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nvr-e2e-'));
        const video = path.join(tmp, 'source.mp4');
        const gen = spawnSync(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=15',
            '-t', '20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '15', video]);
        expect(gen.status, String(gen.stderr)).toBe(0);

        motion = createHttp((_req, res) => {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify([{ value: { state: motionState } }]));
        });
        await new Promise<void>(r => motion.listen(0, '127.0.0.1', r));
        motionUrl = `http://127.0.0.1:${(motion.address() as any).port}/`;

        server = await createServer({ port: 0, dbPath: path.join(tmp, 'db'), registerSignalHandlers: false });
    });

    afterAll(async () => {
        await server?.shutdown();
        await new Promise(r => motion?.close(r));
        await fs.rm(tmp, { recursive: true, force: true });
    });

    const post = (p: string, body: unknown) => fetch(`${server.baseUrl}/api${p}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const movements = async () => {
        const r = await fetch(`${server.baseUrl}/api/movements?mode=Movement`);
        return (await r.json() as { movements: any[] }).movements;
    };

    it('streams, detects motion, extracts frames and completes the movement', async () => {
        expect((await post('/settings', {
            disk_base_dir: tmp, disk_cleanup_interval: 0, disk_cleanup_capacity: 95,
            detection_enable: true, detection_model: 'stub', detection_frames_path: 'frames',
            detection_tag_filters: []
        })).ok).toBe(true);

        const res = await post('/camera/new', {
            delete: false, name: 'e2e', disk: tmp, folder: 'cam1',
            streamSource: path.join(tmp, 'source.mp4'), motionUrl,
            enable_streaming: true, enable_movement: true,
            pollsWithoutMovement: 2, secMaxSingleMovement: 30, mSPollFrequency: 500,
            segments_prior_to_movement: 1, segments_post_movement: 1, secMovementStartupDelay: 0
        });
        expect(res.status).toBe(201);

        await server.runControlLoop();
        await waitFor(async () => {
            const f = await fs.readFile(path.join(tmp, 'cam1', 'stream.m3u8'), 'utf8').catch(() => '');
            return f.includes('.ts') || undefined;
        }, 30000, 'HLS playlist with segments');

        // Let a few segments accumulate, then simulate motion for a few seconds
        await new Promise(r => setTimeout(r, 4000));
        motionState = 1;
        await new Promise(r => setTimeout(r, 4000));
        motionState = 0;

        const done = await waitFor(async () => {
            const m = (await movements()).find(x => x.movement.processing_state === 'completed');
            return m;
        }, 60000, 'completed movement');

        expect(done.movement.detection_output.tags.map((t: any) => t.tag)).toContain('test_object');
        expect(done.movement.frames_received_from_ml).toBeGreaterThan(0);
    }, 120000);
});
