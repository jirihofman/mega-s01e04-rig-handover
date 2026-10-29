/** The only statuses accepted from a run log. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job, aggregated across all valid records in a night. */
export interface DigestRow {
  job: string;
  /** Owner on the chronologically last record; null remains null. */
  owner: string | null;
  /** All valid records, including retries and failures. */
  runs: number;
  retries: number;
  /** All failed records, even if the job later recovered. */
  failures: number;
  lastStatus: RunStatus;
  /** Most recent supplied error, retained after a later successful record. */
  lastError: string | null;
  /** Original timestamp strings, including their original offsets. */
  firstAt: string;
  lastAt: string;
}

export interface NightDigest {
  night: string;
  /** Sorted by job using deterministic, case-sensitive code-unit order. */
  rows: DigestRow[];
  /** Malformed JSON and invalid records; blank lines are ignored. */
  badLines: number;
  /** Counts of valid log records, not counts of aggregate job rows. */
  counts: Record<RunStatus, number>;
}

/**
 * Implemented/exported as readNight from ./reader.ts.
 * Reads runsDir/<night>.jsonl. Missing files and invalid YYYY-MM-DD night
 * identifiers return null; an empty file returns a digest with no rows.
 * Other filesystem errors propagate. Records are ordered by timestamp instant;
 * equal timestamps retain file order. Display timestamps retain their offsets.
 */
export type ReadNight = (runsDir: string, night: string) => Promise<NightDigest | null>;
