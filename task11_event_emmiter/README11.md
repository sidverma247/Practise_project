# EventEmitter

> Lightweight publish-subscribe event system for Node.js — wildcards, one-time listeners, async handlers, and error boundaries in a single zero-dependency ESM file.

![version](https://img.shields.io/badge/version-1.0.0-blue) ![tests](https://img.shields.io/badge/tests-20%2F20-brightgreen) ![dependencies](https://img.shields.io/badge/dependencies-none-brightgreen) ![node](https://img.shields.io/badge/node-%3E%3D14.8-blue)

---

## Features

- `on()` persistent listeners and `once()` auto-removing one-shots
- Wildcard routing: `user.*` (single segment) and `**` (any depth)
- Emit-side wildcards: broadcast one `emit('user.*')` to many listeners
- Async handlers run **concurrently** via `Promise.all()` — no serial bottleneck
- Optional `onError()` boundary prevents one bad handler from crashing the bus
- Chainable API, zero dependencies, ~80 lines

---

## Installation

Copy `EventEmitter.mjs` into your project — no `npm install` needed.

```bash
cp EventEmitter.mjs ./src/
```

```js
import EventEmitter from './src/EventEmitter.mjs';
```

Requires **Node.js 14.8+**. Works in any ESM context including Deno and modern bundlers.

---

## Quick Start

```js
import EventEmitter from './EventEmitter.mjs';

const ee = new EventEmitter();

// Persistent listener
ee.on('user.created', (user) => {
  console.log('New user:', user.name);
});

// One-time listener — removed after first fire
ee.once('user.created', (user) => {
  console.log('First user ever:', user.name);
});

// Both handlers fire
await ee.emit('user.created', { name: 'Alice', id: 1 });

// Only the persistent one fires now
await ee.emit('user.created', { name: 'Bob', id: 2 });
```

---

## API

| Method | Signature | Description |
|---|---|---|
| `on` | `on(event, handler) → this` | Register a persistent listener. Chainable. |
| `once` | `once(event, handler) → this` | One-shot: auto-removed after first invocation. |
| `off` | `off(event, handler) → this` | Remove a specific listener by reference. |
| `emit` | `emit(event, ...args) → Promise` | Emit event, runs all matching handlers concurrently. |
| `onError` | `onError(handler) → this` | Set global error handler for listener errors. |
| `removeAllListeners` | `removeAllListeners([event])` | Remove all listeners, or all for one event. |
| `listenerCount` | `listenerCount(event) → number` | Count of listeners for an exact event name. |
| `eventNames` | `eventNames() → string[]` | All currently registered event names. |

---

## Wildcard Routing

Wildcards work on **both sides** — in the listener and in the emit call.

### Listener-side

```js
// * matches exactly one dot-separated segment
ee.on('user.*', handler);
//   catches: user.created, user.deleted, user.updated
//   misses:  user.profile.updated  (two segments after dot)

// ** matches any depth
ee.on('**', handler);
//   catches: user.created, order.item.added, ping — everything
```

### Emit-side

```js
// Broadcast to all listeners whose event name matches the pattern
await ee.emit('user.*', payload);
//   fires: handlers on user.created AND user.deleted AND user.updated
```

### Pattern reference

| Pattern | Matches | Does not match |
|---|---|---|
| `user.*` | `user.created`, `user.deleted` | `user.profile.updated` |
| `*.created` | `user.created`, `order.created` | `user.profile.created` |
| `**` | anything at any depth | — |

---

## Async Handlers

`emit()` returns a `Promise` that resolves only after all matching handlers have settled. Handlers run **concurrently** — total wait equals the slowest handler, not the sum.

```js
ee.on('report.generate', async () => {
  await writeDB(data);      // 200ms
});

ee.on('report.generate', async () => {
  await sendEmail(data);    // 150ms
});

// Total wait ≈ 200ms (concurrent), not 350ms (serial)
await ee.emit('report.generate', data);
```

---

## Error Handling

### With `onError` boundary

Errors in listeners are caught per-handler and routed to the error boundary. Other handlers in the same emit still run.

```js
ee.onError((err, eventName) => {
  console.error(`[${eventName}] handler threw:`, err.message);
  Sentry.captureException(err);
});

ee.on('payment.processed', () => { throw new Error('stripe down'); });
ee.on('payment.processed', () => notifyAccountant());  // still runs

await ee.emit('payment.processed', data);
// ← both handlers attempted; error captured; no crash
```

### Without `onError` boundary

The first error propagates out of `emit()` as a rejected Promise.

```js
try {
  await ee.emit('risky.event', data);
} catch (err) {
  console.error('A handler threw:', err);
}
```

---

## Patterns & Recipes

### Domain event bus

```js
const bus = new EventEmitter();
bus.onError((err, ev) => logger.error({ ev, err }));

// Auth service
bus.on('auth.login',  ({ userId }) => session.create(userId));
bus.on('auth.logout', ({ userId }) => session.destroy(userId));

// Analytics — wildcard catches all auth events
bus.on('auth.*', (payload) => analytics.track(payload));

// Audit log — catches every domain event
bus.on('**', (payload) => auditLog.write(payload));
```

### Retry with `once()`

```js
function retryOnce(ee, event, handler) {
  const wrapped = async (...args) => {
    try { await handler(...args); }
    catch { ee.once(event, wrapped); }  // re-register on failure
  };
  ee.once(event, wrapped);
}
```

### Promise-based `waitFor()`

```js
function waitFor(ee, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ee.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeout);

    const handler = (...args) => { clearTimeout(timer); resolve(args); };
    ee.once(event, handler);
  });
}

// Usage
const [data] = await waitFor(ee, 'server.ready');
```

---

## Tests

Run the included test suite — no test framework required:

```bash
node EventEmitter.test.mjs
```

```
📦 EventEmitter Test Suite

  ✓  on() — basic listener receives data
  ✓  on() — multiple listeners on same event
  ✓  once() — fires only once
  ✓  once() — removed after firing
  ✓  off() — removes specific listener
  ✓  off() — non-existent event is safe
  ✓  wildcard — "user.*" matches "user.created"
  ✓  wildcard — "user.*" does not match "user.created.extra"
  ✓  wildcard — "**" matches any event
  ✓  wildcard — emit-side wildcard reaches multiple listeners
  ✓  async handler — awaited correctly
  ✓  async handler — multiple run concurrently
  ✓  error handling — onError catches thrown errors
  ✓  error handling — onError catches async errors
  ✓  error handling — no onError re-throws
  ✓  removeAllListeners(event) — clears specific event
  ✓  removeAllListeners() — clears all events
  ✓  listenerCount() — returns correct count
  ✓  eventNames() — returns registered event names
  ✓  on() — throws if handler is not a function

────────────────────────────────────────────
  Results: 20 passed, 0 failed (20 total)
────────────────────────────────────────────
```

---

## Files

| File | Purpose |
|---|---|
| `EventEmitter.mjs` | Core implementation — the only file you need to ship |
| `EventEmitter.test.mjs` | 20-test suite, zero external dependencies |
| `README.md` | This file |

---

## License

MIT
