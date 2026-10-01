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

The match-specific adapter in `adapter.js` maps schema-4 headers to `createSkirmish()` and `createCampaign()` and delegates actions and round resolution to the returned controller. `replayMatchLog(entries)` is the standard entry point; `createMatchReplayAdapter()` can also be passed to `replayLog()` directly. This adapter handles the canonical River Ford skirmish and three authored campaign maps. Custom maps and custom construction experiments need a separate `createFromHeader` callback.

`replayMatchLog()` returns `parityGaps` alongside the generic replay result. It flags recorded settings the current factories cannot reproduce, including legacy shard subsets, card-limit overrides, nonstandard campaign round caps, and enabled legacy skill/spell systems. The frozen legacy fixtures also expose implementation-level gaps: the current controller flattens successful action result fields instead of nesting them under `result`, does not emit rejected actions, and has not ported legacy skills/spells or every archived experiment rule. The fixture suite should therefore be treated as a compatibility target, not as evidence of parity. No replay tests were run for this adapter change.
