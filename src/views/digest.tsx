import type { NightDigest } from '../digest/types.js';

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>failures</th>
              <th>last error</th>
              <th>first time</th>
              <th>last time</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => {
              const marked = row.retries >= 3 || row.failures > 0;
              return (
                <tr class={marked ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? '—'}</td>
                  <td>{row.runs}</td>
                  <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
                  <td class={row.failures > 0 || row.lastStatus === 'fail' ? 'warn' : undefined}>
                    {row.lastStatus}
                  </td>
                  <td class={row.failures > 0 ? 'warn' : undefined}>{row.failures}</td>
                  <td>{row.lastError ?? '—'}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 ? <p class="mute">{digest.badLines} invalid log line(s) skipped</p> : null}
    </>
  );
}
