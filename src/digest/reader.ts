import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

interface RunRecord {
  at: string;
  instant: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
}

function validNight(night: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return false;
  const date = new Date(`${night}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === night;
}

function timestampInstant(at: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(at);
  if (!match || !validNight(match[1])) return null;
  if (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null;
  if (match[5] !== 'Z' && (Number(match[6]) > 23 || Number(match[7]) > 59)) return null;
  const instant = Date.parse(at);
  return Number.isFinite(instant) ? instant : null;
}

function parseRecord(line: string): RunRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (!('at' in value) || typeof value.at !== 'string') return null;
  if (!('job' in value) || typeof value.job !== 'string' || value.job.trim() === '') return null;
  if (!('status' in value) || (value.status !== 'ok' && value.status !== 'retry' && value.status !== 'fail')) return null;
  if (!('owner' in value) || (value.owner !== null && typeof value.owner !== 'string')) return null;
  if ('error' in value && typeof value.error !== 'string') return null;
  const instant = timestampInstant(value.at);
  if (instant === null) return null;
  return {
    at: value.at,
    instant,
    job: value.job,
    status: value.status,
    owner: value.owner,
    ...('error' in value && typeof value.error === 'string' ? { error: value.error } : {}),
  };
}

/** See ReadNight in types.ts for the shared route/view contract. */
export const readNight: ReadNight = async (runsDir, night) => {
  if (!validNight(night)) return null;
  let contents: string;
  try {
    contents = await readFile(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const digest: NightDigest = { night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
  const records: RunRecord[] = [];
  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const record = parseRecord(line);
    if (record === null) digest.badLines++;
    else records.push(record);
  }
  // Stable sort preserves file order for simultaneous events.
  records.sort((left, right) => left.instant - right.instant);
  const jobs = new Map<string, DigestRow>();
  for (const record of records) {
    digest.counts[record.status]++;
    let row = jobs.get(record.job);
    if (!row) {
      row = {
        job: record.job,
        owner: record.owner,
        runs: 0,
        retries: 0,
        failures: 0,
        lastStatus: record.status,
        lastError: null,
        firstAt: record.at,
        lastAt: record.at,
      };
      jobs.set(record.job, row);
    }
    row.runs++;
    if (record.status === 'retry') row.retries++;
    if (record.status === 'fail') row.failures++;
    row.owner = record.owner;
    row.lastStatus = record.status;
    if (record.error !== undefined) row.lastError = record.error;
    row.lastAt = record.at;
  }
  digest.rows = [...jobs.values()].sort((left, right) => left.job < right.job ? -1 : left.job > right.job ? 1 : 0);
  return digest;
};
