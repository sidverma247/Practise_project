/**
 * EventEmitter Test Suite
 * Run: node EventEmitter.test.mjs
 */
import EventEmitter from './EventEmitter.mjs';

let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗  ${name}\n       ${err.message}`);
  }
}

const assert = (c, m = 'Assertion failed') => { if (!c) throw new Error(m); };
const assertEqual = (a, b, m) => { if (a !== b) throw new Error(m ?? `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`); };
const assertDeepEqual = (a, b, m) => {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(m ?? `Expected ${sa} === ${sb}`);
};

console.log('\n📦 EventEmitter Test Suite\n');

await test('on() — basic listener receives data', async () => {
  const ee = new EventEmitter();
  const received = [];
  ee.on('greet', (name) => received.push(name));
  await ee.emit('greet', 'Alice');
  await ee.emit('greet', 'Bob');
  assertDeepEqual(received, ['Alice', 'Bob']);
});

await test('on() — multiple listeners on same event', async () => {
  const ee = new EventEmitter();
  const log = [];
  ee.on('ping', () => log.push('A'));
  ee.on('ping', () => log.push('B'));
  await ee.emit('ping');
  assertDeepEqual(log, ['A', 'B']);
});

await test('once() — fires only once', async () => {
  const ee = new EventEmitter();
  let count = 0;
  ee.once('click', () => count++);
  await ee.emit('click');
  await ee.emit('click');
  await ee.emit('click');
  assertEqual(count, 1, `Expected 1 invocation, got ${count}`);
});

await test('once() — removed after firing', async () => {
  const ee = new EventEmitter();
  ee.once('x', () => {});
  assertEqual(ee.listenerCount('x'), 1);
  await ee.emit('x');
  assertEqual(ee.listenerCount('x'), 0);
});

await test('off() — removes specific listener', async () => {
  const ee = new EventEmitter();
  const log = [];
  const h1 = () => log.push('h1');
  const h2 = () => log.push('h2');
  ee.on('ev', h1);
  ee.on('ev', h2);
  ee.off('ev', h1);
  await ee.emit('ev');
  assertDeepEqual(log, ['h2']);
});

await test('off() — non-existent event is safe', async () => {
  const ee = new EventEmitter();
  ee.off('ghost', () => {});
});

await test('wildcard — "user.*" matches "user.created"', async () => {
  const ee = new EventEmitter();
  const log = [];
  ee.on('user.*', (d) => log.push(d));
  await ee.emit('user.created', 'Alice');
  await ee.emit('user.deleted', 'Bob');
  assertDeepEqual(log, ['Alice', 'Bob']);
});

await test('wildcard — "user.*" does not match "user.created.extra"', async () => {
  const ee = new EventEmitter();
  const log = [];
  ee.on('user.*', (d) => log.push(d));
  await ee.emit('user.created.extra', 'x');
  assertEqual(log.length, 0, 'Should not have matched nested event');
});

await test('wildcard — "**" matches any event', async () => {
  const ee = new EventEmitter();
  const log = [];
  ee.on('**', (d) => log.push(d));
  await ee.emit('a.b.c', 1);
  await ee.emit('foo', 2);
  assertDeepEqual(log, [1, 2]);
});

await test('wildcard — emit-side wildcard reaches multiple listeners', async () => {
  const ee = new EventEmitter();
  const log = [];
  ee.on('user.created', () => log.push('created'));
  ee.on('user.deleted', () => log.push('deleted'));
  await ee.emit('user.*');
  assert(log.includes('created') && log.includes('deleted'), 'Both listeners should fire');
});

await test('async handler — awaited correctly', async () => {
  const ee = new EventEmitter();
  const log = [];
  ee.on('work', async () => {
    await new Promise(r => setTimeout(r, 10));
    log.push('done');
  });
  await ee.emit('work');
  assertDeepEqual(log, ['done']);
});

await test('async handler — multiple run concurrently', async () => {
  const ee = new EventEmitter();
  const log = [];
  ee.on('race', async () => {
    await new Promise(r => setTimeout(r, 20));
    log.push('slow');
  });
  ee.on('race', async () => {
    await new Promise(r => setTimeout(r, 5));
    log.push('fast');
  });
  const start = Date.now();
  await ee.emit('race');
  const elapsed = Date.now() - start;
  assert(elapsed < 40, `Handlers should run concurrently (~20ms), took ${elapsed}ms`);
  assert(log.includes('slow') && log.includes('fast'));
});

await test('error handling — onError catches thrown errors', async () => {
  const ee = new EventEmitter();
  const errors = [];
  ee.onError((err) => errors.push(err.message));
  ee.on('boom', () => { throw new Error('kaboom'); });
  await ee.emit('boom');
  assertDeepEqual(errors, ['kaboom']);
});

await test('error handling — onError catches async errors', async () => {
  const ee = new EventEmitter();
  const errors = [];
  ee.onError((err) => errors.push(err.message));
  ee.on('async-boom', async () => {
    await Promise.resolve();
    throw new Error('async-kaboom');
  });
  await ee.emit('async-boom');
  assertDeepEqual(errors, ['async-kaboom']);
});

await test('error handling — no onError re-throws', async () => {
  const ee = new EventEmitter();
  ee.on('err', () => { throw new Error('unhandled'); });
  let caught = false;
  try {
    await ee.emit('err');
  } catch (e) {
    caught = true;
    assertEqual(e.message, 'unhandled');
  }
  assert(caught, 'Error should have propagated');
});

await test('removeAllListeners(event) — clears specific event', async () => {
  const ee = new EventEmitter();
  ee.on('a', () => {});
  ee.on('a', () => {});
  ee.on('b', () => {});
  ee.removeAllListeners('a');
  assertEqual(ee.listenerCount('a'), 0);
  assertEqual(ee.listenerCount('b'), 1);
});

await test('removeAllListeners() — clears all events', async () => {
  const ee = new EventEmitter();
  ee.on('a', () => {});
  ee.on('b', () => {});
  ee.removeAllListeners();
  assertEqual(ee.eventNames().length, 0);
});

await test('listenerCount() — returns correct count', async () => {
  const ee = new EventEmitter();
  assertEqual(ee.listenerCount('x'), 0);
  ee.on('x', () => {});
  ee.once('x', () => {});
  assertEqual(ee.listenerCount('x'), 2);
});

await test('eventNames() — returns registered event names', async () => {
  const ee = new EventEmitter();
  ee.on('alpha', () => {});
  ee.on('beta', () => {});
  const names = ee.eventNames();
  assert(names.includes('alpha') && names.includes('beta'));
});

await test('on() — throws if handler is not a function', async () => {
  const ee = new EventEmitter();
  let threw = false;
  try { ee.on('x', 'not-a-function'); } catch { threw = true; }
  assert(threw, 'Should throw TypeError');
});

console.log(`\n${'─'.repeat(44)}`);
console.log(`  Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`${'─'.repeat(44)}\n`);
if (failed > 0) process.exit(1);
