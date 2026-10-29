import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import type { RunStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightStatus = {
  night: string;
  counts: Record<RunStatus, number>;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightStatus[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function readStatus(config: RigConfig): Promise<Status> {
  const nights = await Promise.all(
    nightsOnDisk(config.runsDir).map(async (night) => {
      const digest = await readNight(config.runsDir, night);
      return digest ? { night, counts: digest.counts } : null;
    }),
  );

  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nights.filter((night): night is NightStatus => night !== null),
  };
}
