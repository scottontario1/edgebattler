/**
 * Framework-independent schema-4 game log utilities.
 *
 * This module owns JSONL collection, serialization, parsing and deterministic replay orchestration.
 * It deliberately has no knowledge of a match implementation, browser APIs, Vite or Phaser.
 */

export const LOG_SCHEMA = 4;
export const LOG_ENTRY_TYPES = Object.freeze(['header', 'action', 'round', 'summary', 'result']);

const COMPARABLE_TYPES = new Set(['action', 'round', 'summary', 'result']);

/**
 * Construct one schema-4 envelope without reshaping its payload. The legacy writer emits `t` first;
 * preserving caller field insertion order keeps human-readable JSONL close to existing play logs.
 */
export function createLogEntry(type, fields = {}) {
  if (!LOG_ENTRY_TYPES.includes(type)) throw new TypeError(`Unknown log entry type: ${type}`);
  if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new TypeError('Log entry fields must be an object');
  }
  if (Object.hasOwn(fields, 't')) throw new TypeError('Log entry fields must not include t');
  return { t: type, ...fields };
}

/** Encode entries using the legacy JSON Lines contract: one JSON object per line and a final LF. */
export function toJSONL(entries) {
  if (!Array.isArray(entries)) throw new TypeError('JSONL entries must be an array');
  return `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
}

/** Parse non-empty JSON Lines while reporting malformed input with its one-based line number. */
export function fromJSONL(text) {
  if (typeof text !== 'string') throw new TypeError('JSONL input must be a string');
  const entries = [];
  for (const [index, line] of text.split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new TypeError('entry must be a JSON object');
      }
      entries.push(entry);
    } catch (error) {
      error.message = `Invalid JSONL at line ${index + 1}: ${error.message}`;
      throw error;
    }
  }
  return entries;
}

/** In-memory sink compatible with the legacy `log: collector.push` match option. */
export function createLogCollector() {
  const entries = [];
  return {
    entries,
    push(entry) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new TypeError('A log entry must be an object');
      }
      entries.push(entry);
      return entry;
    },
    text: () => toJSONL(entries),
  };
}

/**
 * Structural comparison of JSON values. Object insertion order is ignored; array order remains
 * significant because event order is part of deterministic combat. In legacy-superset mode, every
 * key in the recorded value must exist and match in the replay value, while newer replay fields are
 * allowed. Set `allowAdditionalFields: false` for exact state reconciliation.
 */
export function firstDifference(expected, actual, path = '$', { allowAdditionalFields = true } = {}) {
  if (Object.is(expected, actual)) return null;
  if (typeof expected === 'number' && typeof actual === 'number'
      && Number.isNaN(expected) && Number.isNaN(actual)) return null;
  if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object') {
    return { path, expected, actual };
  }
  if (Array.isArray(expected) !== Array.isArray(actual)) return { path, expected, actual };
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      return { path: `${path}.length`, expected: expected.length, actual: actual.length };
    }
    for (let index = 0; index < expected.length; index += 1) {
      const difference = firstDifference(expected[index], actual[index], `${path}[${index}]`, { allowAdditionalFields });
      if (difference) return difference;
    }
    return null;
  }

  for (const key of Object.keys(expected)) {
    if (!Object.hasOwn(actual, key)) return { path: `${path}.${key}`, expected: expected[key], actual: undefined };
    const difference = firstDifference(expected[key], actual[key], `${path}.${key}`, { allowAdditionalFields });
    if (difference) return difference;
  }
  if (!allowAdditionalFields) {
    const unexpected = Object.keys(actual).find((key) => !Object.hasOwn(expected, key));
    if (unexpected !== undefined) return { path: `${path}.${unexpected}`, expected: undefined, actual: actual[unexpected] };
  }
  return null;
}

/**
 * Normalize JSON-compatible data for key-order-independent hashing or comparison diagnostics.
 * This is intentionally separate from `toJSONL`: emitted logs retain legacy property order.
 */
export function normalizeLogValue(value) {
  if (Array.isArray(value)) return value.map(normalizeLogValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizeLogValue(value[key])]));
  }
  return value;
}

/**
 * Replay schema-4 actions and round boundaries through an injected match adapter.
 *
 * Adapter contract:
 * - createFromHeader(header, emit) -> session; rebuild map/content/seed/config from the header and
 *   send every schema-4 entry produced during construction (header and initial summary included) to
 *   `emit(entry)`.
 * - apply(session, action, actor, sourceEntry) -> void; apply one logged action in stream order and
 *   emit its action result using the legacy schema-4 shape.
 * - resolve(session, sourceEntry) -> void; resolve one logged round and emit round/events, summary,
 *   and optional result entries. Event batch and event array order must be retained.
 *
 * The adapter owns match rules and any required content registries. No browser globals, map globals,
 * file IO, timers or renderer objects belong here. Methods must be synchronous and deterministic for
 * a fixed header and action stream.
 */
export function replayLog(entries, { createFromHeader, apply, resolve, allowAdditionalFields = true } = {}) {
  if (!Array.isArray(entries)) throw new TypeError('Replay entries must be an array');
  const header = entries.find((entry) => entry?.t === 'header');
  if (!header) return { ok: false, mismatches: [{ reason: 'no-header' }] };
  if (header.schema !== LOG_SCHEMA) {
    return { ok: false, mismatches: [{ reason: 'unsupported-schema', schema: header.schema, expected: LOG_SCHEMA }] };
  }
  if (typeof createFromHeader !== 'function' || typeof apply !== 'function' || typeof resolve !== 'function') {
    return { ok: false, mismatches: [{ reason: 'incomplete-adapter', required: ['createFromHeader', 'apply', 'resolve'] }] };
  }

  const collector = createLogCollector();
  const session = createFromHeader(header, collector.push);
  if (session === undefined || session === null) {
    return { ok: false, mismatches: [{ reason: 'adapter-returned-no-session' }], entries: collector.entries };
  }

  for (const entry of entries) {
    if (entry?.t === 'action') apply(session, entry.action, entry.actor, entry);
    else if (entry?.t === 'round') resolve(session, entry);
  }

  const expected = entries.filter((entry) => COMPARABLE_TYPES.has(entry?.t));
  const actual = collector.entries.filter((entry) => COMPARABLE_TYPES.has(entry?.t));
  const mismatches = [];
  for (let index = 0; index < Math.max(expected.length, actual.length); index += 1) {
    const want = expected[index];
    const got = actual[index];
    if (!want || !got) {
      mismatches.push({ index, want: want?.t ?? null, got: got?.t ?? null, reason: 'entry-count-differs' });
      continue;
    }
    const difference = firstDifference(want, got, '$', { allowAdditionalFields });
    if (difference) mismatches.push({ index, entry: want.t, round: want.round, ...difference });
  }
  return { ok: mismatches.length === 0, mismatches, session, entries: collector.entries };
}

/** Parse and replay an existing JSONL log with the same injected adapter contract. */
export function replayJSONL(text, adapter) {
  return replayLog(fromJSONL(text), adapter);
}
