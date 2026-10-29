import { appendFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const event = { at: '2026-10-28T23:00:00+01:00', job: 'job', status: 'ok', owner: 'rook' };
let runsDir: string;

beforeEach(async () => { runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-reader-')); });
afterEach(async () => { await rm(runsDir, { recursive: true, force: true }); });

async function writeRecords(records: unknown[]) {
  await writeFile(join(runsDir, `${night}.jsonl`), records.map((record) => JSON.stringify(record)).join('\n'));
}

describe('readNight', () => {
  it('reads the real fixture without dropping ownerless jobs or its bad line', async () => {
    const digest = await readNight(fileURLToPath(new URL('../runs/', import.meta.url)), night);
    expect(digest?.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(digest?.badLines).toBe(1);
    expect(digest?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(digest?.rows[0].owner).toBeNull();
    expect(digest?.rows[1]).toEqual({
      job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, failures: 0,
      lastStatus: 'ok', lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest?.rows[2].runs).toBe(8);
    expect(digest?.rows[3].failures).toBe(1);
  });

  it('distinguishes missing nights from empty or blank-only nights', async () => {
    expect(await readNight(runsDir, night)).toBeNull();
    for (const contents of ['', ' \n\r\n\t\n']) {
      await writeFile(join(runsDir, `${night}.jsonl`), contents);
      expect(await readNight(runsDir, night)).toEqual({
        night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
      });
    }
  });

  it('counts malformed JSON and invalid records, then continues reading', async () => {
    await writeRecords([
      null, [], 42, {}, { ...event, owner: undefined }, { ...event, owner: 7 },
      { ...event, job: ' ' }, { ...event, status: 'running' }, { ...event, status: ['ok'] },
      { ...event, error: null }, { ...event, at: 'yesterday' },
      { ...event, at: '2026-02-30T00:00:00Z' }, { ...event, at: '2026-10-28T24:00:00Z' },
      { ...event, at: '2026-10-28T23:00:00' }, { ...event, at: 12 },
    ]);
    await appendFile(join(runsDir, `${night}.jsonl`), `\n{bad json\r\n\r\n${JSON.stringify(event)}\r\n`);
    const digest = await readNight(runsDir, night);
    expect(digest?.badLines).toBe(16);
    expect(digest?.rows).toHaveLength(1);
    expect(digest?.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });

  it('orders by instant, retains offsets, and preserves errors and failures after recovery', async () => {
    await writeRecords([
      { ...event, at: '2026-10-29T00:00:00+02:00', status: 'retry', error: 'earlier error' },
      { ...event, at: '2026-10-28T23:30:00+01:00', owner: null },
      { ...event, at: '2026-10-28T22:15:00Z', status: 'fail', error: 'latest error' },
    ]);
    expect((await readNight(runsDir, night))?.rows).toEqual([{
      job: 'job', owner: null, runs: 3, retries: 1, failures: 1,
      lastStatus: 'ok', lastError: 'latest error',
      firstAt: '2026-10-29T00:00:00+02:00', lastAt: '2026-10-28T23:30:00+01:00',
    }]);
  });

  it('uses file order for equal instants and deterministic job ordering', async () => {
    await writeRecords([
      { ...event, job: 'z' }, { ...event, job: 'a' }, { ...event, job: 'A' },
      { ...event, job: '__proto__' }, { ...event, job: 'a', status: 'retry', error: 'retry' },
    ]);
    const digest = await readNight(runsDir, night);
    expect(digest?.rows.map((row) => row.job)).toEqual(['A', '__proto__', 'a', 'z']);
    expect(digest?.rows[2].lastStatus).toBe('retry');
    expect(digest?.rows[2].runs).toBe(2);
  });

  it('rejects traversal and invalid calendar nights before accessing files', async () => {
    for (const invalid of ['../2026-10-28', '/2026-10-28', '2026-10-28/..', '2026-02-30', '2026-13-01', '2026-1-1', '2026-10-28\0']) {
      expect(await readNight(runsDir, invalid)).toBeNull();
    }
    await writeFile(join(runsDir, '2024-02-29.jsonl'), '');
    expect(await readNight(runsDir, '2024-02-29')).not.toBeNull();
  });

  it('propagates filesystem errors other than missing files', async () => {
    await mkdir(join(runsDir, `${night}.jsonl`));
    await expect(readNight(runsDir, night)).rejects.toHaveProperty('code', 'EISDIR');
  });
});
