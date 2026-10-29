import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '',
};

let runsDir: string;

beforeEach(async () => {
  runsDir = await mkdtemp(path.join(tmpdir(), 'rig-digest-routes-'));
  config.runsDir = runsDir;
});

afterEach(async () => {
  await rm(runsDir, { recursive: true, force: true });
});

async function writeNight(night: string, contents: string): Promise<void> {
  await writeFile(path.join(runsDir, `${night}.jsonl`), contents, 'utf8');
}

const sampleLog = [
  JSON.stringify({ at: '2026-10-30T09:03:00+01:00', job: 'zeta', status: 'ok', owner: 'Zoe' }),
  JSON.stringify({ at: '2026-10-30T09:01:00+01:00', job: 'alpha', status: 'retry', owner: null, error: 'again' }),
  JSON.stringify({ at: '2026-10-30T09:02:00+01:00', job: 'alpha', status: 'retry', owner: null }),
  JSON.stringify({ at: '2026-10-30T09:04:00+01:00', job: 'beta', status: 'fail', owner: 'Bea', error: 'boom' }),
  JSON.stringify({ at: '2026-10-30T09:03:00+01:00', job: 'alpha', status: 'retry', owner: null }),
  '{not json',
].join('\n');

function rowForJob(html: string, job: string): string {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const row = rows.find((candidate) => candidate.includes(job));
  expect(row, `expected a table row for ${job}`).toBeDefined();
  return row ?? '';
}

describe('digest routes', () => {
  it('returns matching sorted jobs in JSON and HTML, including warnings and malformed-line count', async () => {
    await writeNight('2026-10-30', sampleLog);
    const app = createApp(config);

    const jsonResponse = await app.request('/api/digest/2026-10-30');
    expect(jsonResponse.status).toBe(200);
    const digest = (await jsonResponse.json()) as NightDigest;
    expect(digest).toEqual({
      night: '2026-10-30',
      rows: [
        {
          job: 'alpha',
          owner: null,
          runs: 3,
          retries: 3,
          failures: 0,
          lastStatus: 'retry',
          lastError: 'again',
          firstAt: '2026-10-30T09:01:00+01:00',
          lastAt: '2026-10-30T09:03:00+01:00',
        },
        {
          job: 'beta',
          owner: 'Bea',
          runs: 1,
          retries: 0,
          failures: 1,
          lastStatus: 'fail',
          lastError: 'boom',
          firstAt: '2026-10-30T09:04:00+01:00',
          lastAt: '2026-10-30T09:04:00+01:00',
        },
        {
          job: 'zeta',
          owner: 'Zoe',
          runs: 1,
          retries: 0,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-30T09:03:00+01:00',
          lastAt: '2026-10-30T09:03:00+01:00',
        },
      ],
      badLines: 1,
      counts: { ok: 1, retry: 3, fail: 1 },
    });

    const pageResponse = await app.request('/digest/2026-10-30');
    expect(pageResponse.status).toBe(200);
    const html = await pageResponse.text();
    const positions = ['alpha', 'beta', 'zeta'].map((job) => html.indexOf(job));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(rowForJob(html, 'alpha')).toContain('—');
    expect(rowForJob(html, 'alpha')).toContain('warn');
    expect(rowForJob(html, 'beta')).toContain('warn');
  });

  it('returns 404 for a night without a log', async () => {
    const app = createApp(config);

    expect((await app.request('/digest/2026-10-31')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-31')).status).toBe(404);
  });

  it('renders an empty night and returns an empty JSON digest', async () => {
    await writeNight('2026-11-01', '');
    const app = createApp(config);

    const pageResponse = await app.request('/digest/2026-11-01');
    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain('nothing ran');

    const jsonResponse = await app.request('/api/digest/2026-11-01');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toMatchObject({
      night: '2026-11-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });
});
