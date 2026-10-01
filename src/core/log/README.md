# Portable logging and replay

This package has no match, rendering, DOM, browser transport, filesystem or Phaser dependency. Consumers import `src/core/log/index.js` directly. The normal play adapter is responsible for supplying schema-4 entries as match actions and round outcomes occur; this package collects, serializes and replays those entries.

## Schema 4

JSONL contains one JSON object per line. Existing logs use these entry kinds:

- `header`: `schema`, `seed`, `maxRounds`, `map`, rules/configuration, content and optional campaign metadata.
- `action`: `round`, `actor`, `action`, `ok`, optional `reason`, and optional successful `result`.
- `round`: `round` and ordered `batches`; a batch has a `type` and ordered `events`.
- `summary`: `round`, Blue/Red summaries, plus campaign phase when applicable.
- `result`: `round`, `winner`, `reason`, and statistics.

Action, result, summary, batch and event payloads stay plain JSON data. This utility does not translate their keys or reorder arrays. `toJSONL()` preserves the object's insertion order and emits a final newline, matching the legacy writer. `fromJSONL()` ignores blank lines and identifies malformed input by line number.

```js
import { createLogCollector, createLogEntry, replayLog } from './src/core/log/index.js';

const log = createLogCollector();
log.push(createLogEntry('header', { schema: 4, seed: 7, maxRounds: 90, map: 'campaign-road' }));
```

`createLogEntry(type, fields)` only builds the `{ t, ...fields }` envelope. The match layer owns the required fields and must retain legacy forms, including action outcomes, ordered event batches, summaries, and results. Keep browser POST/beacon code in an application adapter.

## Replay adapter

`replayLog(entries, { createFromHeader, apply, resolve })` checks for a schema-4 header and replays actions and round boundaries in stream order. Its adapter callbacks are synchronous and deterministic:

```js
const replay = replayLog(entries, {
  createFromHeader(header, emit) {
    // Build the same map, content, seed and rules. Emit the header and initial summary.
    return buildSessionFromHeader(header, emit);
  },
  apply(session, action, actor, sourceEntry) {
    // Apply the action and emit its schema-4 action result.
    session.apply(action, actor);
  },
  resolve(session, sourceEntry) {
    // Resolve once and emit the ordered round batch, summary and optional result.
    session.resolveRound();
  },
});
```

The injected session owns all game rules, content registration and mutable state. `createFromHeader` receives the parsed header and an `emit(entry)` sink; construction should emit its header and starting summary. `apply` gets the action payload, actor and original entry. `resolve` gets the original round entry. Both operations emit the records produced by that operation. Return value is `{ ok, mismatches, session, entries }`; malformed structure and adapter exceptions are left visible to the caller, while missing headers, unsupported schema and incomplete adapters are reported as structured mismatches.

Replay compares `action`, `round`, `summary` and `result`. Object keys are compared by name, so property insertion order does not affect parity. Array order remains significant because batch and event order is observable. The default legacy-superset check requires every recorded field to match and allows the replay to add fields; `allowAdditionalFields: false` enables exact recursive comparison. `firstDifference()` also supports comparing application state snapshots. `normalizeLogValue()` returns recursively key-sorted data for canonical diagnostics or hashes; never use it when writing legacy-compatible JSONL because that would change the visible key order.

## Boundaries and migration notes

The current batch core does not yet have the match controller. Its future match adapter should own header creation, log action/result emission, summary snapshots, RNG and round ordering. `replayLog()` intentionally cannot infer campaign setup, initialize factions, change a global map, set economy constants or import a legacy module. Replay each migration adapter with the checked-in schema-4 fixtures and preserve their round/action/event ordering.
