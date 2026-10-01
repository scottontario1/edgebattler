// Parity harness for the Phaser port. tests/fixtures/golden/ holds JSON Lines logs recorded from the
// legacy engine (legacy/tools/golden.mjs): 30 campaign games and 20 AI skirmishes, played the normal
// way (continuous 18 s combat, skills and spells off). The ported engine passes when it replays every
// logged action and produces the same action results, round events, summaries and result.
//
// The comparison is a *superset* check: every field the legacy engine logged must be present and
// equal, but the new engine may add fields (for example a `time` on timed-combat batches). Arrays must
// match in length and order.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const DIR = new URL('../fixtures/golden/', import.meta.url);

/** [{ name, kind, rounds, winner, reason, level?, faction?, blue?, red?, seed, policies? }] */
export const goldenIndex = () => JSON.parse(readFileSync(new URL('index.json', DIR), 'utf8'));

/** The entries of one golden game. */
export function loadGolden(name) {
  const text = gunzipSync(readFileSync(new URL(`${name}.jsonl.gz`, DIR))).toString('utf8');
  return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** First path where `got` fails to contain `want`, or null when it does. */
export function firstDifference(want, got, path = '$') {
  if (want === got) return null;
  if (typeof want === 'number' && typeof got === 'number' && Number.isNaN(want) && Number.isNaN(got)) return null;
  if (want === null || got === null || typeof want !== 'object' || typeof got !== 'object') {
    return { path, want, got };
  }
  if (Array.isArray(want) !== Array.isArray(got)) return { path, want, got };
  if (Array.isArray(want)) {
    if (want.length !== got.length) return { path: `${path}.length`, want: want.length, got: got.length };
    for (let i = 0; i < want.length; i += 1) {
      const d = firstDifference(want[i], got[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  for (const k of Object.keys(want)) {
    if (want[k] === undefined) continue;
    if (!(k in got)) return { path: `${path}.${k}`, want: want[k], got: undefined };
    const d = firstDifference(want[k], got[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

const COMPARED = new Set(['action', 'round', 'summary', 'result']);

/**
 * Replay a golden game through the new engine.
 * create(header, push) must build a match from the logged header (seed, campaign / skirmish setup,
 * combat config, flags) that reports its log entries to `push`, and expose apply(action, actor) and
 * resolveRound(). Returns { ok, compared, mismatch } where mismatch names the first differing entry.
 */
export function replayGolden(entries, create) {
  const header = entries.find((e) => e.t === 'header');
  const got = [];
  const match = create(header, (e) => got.push(e));
  for (const e of entries) {
    if (e.t === 'action') match.apply(e.action, e.actor);
    else if (e.t === 'round') match.resolveRound();
  }
  const want = entries.filter((e) => COMPARED.has(e.t));
  const have = got.filter((e) => COMPARED.has(e.t));
  for (let i = 0; i < Math.max(want.length, have.length); i += 1) {
    if (!want[i] || !have[i]) return { ok: false, compared: i, mismatch: { index: i, want: want[i]?.t ?? null, got: have[i]?.t ?? null, reason: 'entry count differs' } };
    const d = firstDifference(want[i], have[i]);
    if (d) return { ok: false, compared: i, mismatch: { index: i, entry: want[i].t, round: want[i].round, ...d } };
  }
  return { ok: true, compared: want.length, mismatch: null, match };
}
