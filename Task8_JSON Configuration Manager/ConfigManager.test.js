'use strict';

/**
 * Minimal self-contained test runner.
 * Run:  node tests/ConfigManager.test.js
 */

const assert = require('assert');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { ConfigManager, createConfig } = require('../src');

// ── Tiny test harness ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function describe(suite, fn) {
  console.log(`\n  ${suite}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`    ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`    ❌  ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function writeTempJson(obj) {
  const tmp = path.join(os.tmpdir(), `cfg-test-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
  return tmp;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConfigManager – constructor', () => {
  it('creates an instance with default options', () => {
    const c = new ConfigManager();
    assert.ok(c instanceof ConfigManager);
  });

  it('factory createConfig() returns a ConfigManager', () => {
    const c = createConfig();
    assert.ok(c instanceof ConfigManager);
  });
});

describe('loadObject()', () => {
  it('loads a plain object', () => {
    const c = createConfig().loadObject({ a: 1 });
    assert.strictEqual(c.get('a'), 1);
  });

  it('replaces data by default', () => {
    const c = createConfig().loadObject({ a: 1 });
    c.loadObject({ b: 2 });
    assert.strictEqual(c.get('a'), undefined);
    assert.strictEqual(c.get('b'), 2);
  });

  it('merges when merge:true', () => {
    const c = createConfig().loadObject({ a: 1 });
    c.loadObject({ b: 2 }, { merge: true });
    assert.strictEqual(c.get('a'), 1);
    assert.strictEqual(c.get('b'), 2);
  });

  it('deep-merges nested objects', () => {
    const c = createConfig().loadObject({ db: { host: 'a', port: 5432 } });
    c.loadObject({ db: { port: 3306 } }, { merge: true });
    assert.strictEqual(c.get('db.host'), 'a');
    assert.strictEqual(c.get('db.port'), 3306);
  });

  it('throws on non-object input', () => {
    const c = createConfig();
    assert.throws(() => c.loadObject([1, 2]), /expects a plain object/);
    assert.throws(() => c.loadObject(null),   /expects a plain object/);
  });
});

describe('load() – file loading', () => {
  it('loads a JSON file', () => {
    const tmp = writeTempJson({ key: 'value' });
    const c = createConfig().load(tmp);
    assert.strictEqual(c.get('key'), 'value');
    fs.unlinkSync(tmp);
  });

  it('throws when file does not exist', () => {
    const c = createConfig();
    assert.throws(() => c.load('/no/such/file.json'), /not found/i);
  });

  it('throws on invalid JSON', () => {
    const tmp = path.join(os.tmpdir(), `bad-${Date.now()}.json`);
    fs.writeFileSync(tmp, '{ bad json }');
    assert.throws(() => createConfig().load(tmp), /Invalid JSON/);
    fs.unlinkSync(tmp);
  });

  it('merges when merge:true', () => {
    const tmp = writeTempJson({ extra: 99 });
    const c = createConfig().loadObject({ a: 1 });
    c.load(tmp, { merge: true });
    assert.strictEqual(c.get('a'), 1);
    assert.strictEqual(c.get('extra'), 99);
    fs.unlinkSync(tmp);
  });
});

describe('get()', () => {
  it('reads a top-level key', () => {
    const c = createConfig().loadObject({ x: 42 });
    assert.strictEqual(c.get('x'), 42);
  });

  it('reads a nested key via dot-notation', () => {
    const c = createConfig().loadObject({ a: { b: { c: 'deep' } } });
    assert.strictEqual(c.get('a.b.c'), 'deep');
  });

  it('returns default when key is missing', () => {
    const c = createConfig().loadObject({});
    assert.strictEqual(c.get('missing', 'default'), 'default');
  });

  it('returns undefined (no default) when key is missing', () => {
    const c = createConfig().loadObject({});
    assert.strictEqual(c.get('nope'), undefined);
  });

  it('handles null and boolean values', () => {
    const c = createConfig().loadObject({ flag: false, nothing: null });
    assert.strictEqual(c.get('flag'), false);
    assert.strictEqual(c.get('nothing'), null);
  });

  it('throws on empty keyPath', () => {
    const c = createConfig();
    assert.throws(() => c.get(''), /non-empty string/);
  });
});

describe('set()', () => {
  it('sets a top-level key', () => {
    const c = createConfig().loadObject({});
    c.set('foo', 'bar');
    assert.strictEqual(c.get('foo'), 'bar');
  });

  it('sets a nested key', () => {
    const c = createConfig().loadObject({ db: { host: 'a' } });
    c.set('db.port', 5432);
    assert.strictEqual(c.get('db.port'), 5432);
    assert.strictEqual(c.get('db.host'), 'a'); // untouched
  });

  it('auto-creates intermediate objects', () => {
    const c = createConfig().loadObject({});
    c.set('a.b.c', 'deep');
    assert.strictEqual(c.get('a.b.c'), 'deep');
  });

  it('overwrites existing value', () => {
    const c = createConfig().loadObject({ x: 1 });
    c.set('x', 999);
    assert.strictEqual(c.get('x'), 999);
  });

  it('is chainable', () => {
    const c = createConfig().loadObject({});
    const returned = c.set('a', 1);
    assert.strictEqual(returned, c);
  });
});

describe('delete()', () => {
  it('deletes an existing key', () => {
    const c = createConfig().loadObject({ a: 1, b: 2 });
    assert.strictEqual(c.delete('a'), true);
    assert.strictEqual(c.get('a'), undefined);
    assert.strictEqual(c.get('b'), 2);
  });

  it('returns false when key does not exist', () => {
    const c = createConfig().loadObject({});
    assert.strictEqual(c.delete('ghost'), false);
  });

  it('deletes nested keys', () => {
    const c = createConfig().loadObject({ db: { host: 'x', port: 1 } });
    c.delete('db.host');
    assert.strictEqual(c.get('db.host'), undefined);
    assert.strictEqual(c.get('db.port'), 1);
  });
});

describe('has()', () => {
  it('returns true for existing key', () => {
    const c = createConfig().loadObject({ a: 0 });
    assert.strictEqual(c.has('a'), true);
  });

  it('returns false for missing key', () => {
    const c = createConfig().loadObject({});
    assert.strictEqual(c.has('nope'), false);
  });

  it('works on nested keys', () => {
    const c = createConfig().loadObject({ x: { y: null } });
    assert.strictEqual(c.has('x.y'), true);
    assert.strictEqual(c.has('x.z'), false);
  });
});

describe('Environment variable interpolation', () => {
  const fakeEnv = { DB_HOST: 'localhost', DB_PORT: '5432', NODE_ENV: 'test' };

  it('interpolates a ${VAR} placeholder', () => {
    const c = new ConfigManager({ env: fakeEnv });
    c.loadObject({ host: '${DB_HOST}' });
    assert.strictEqual(c.get('host'), 'localhost');
  });

  it('interpolates multiple vars in one string', () => {
    const c = new ConfigManager({ env: fakeEnv });
    c.loadObject({ dsn: 'postgres://${DB_HOST}:${DB_PORT}' });
    assert.strictEqual(c.get('dsn'), 'postgres://localhost:5432');
  });

  it('interpolates nested strings', () => {
    const c = new ConfigManager({ env: fakeEnv });
    c.loadObject({ db: { host: '${DB_HOST}', name: 'app_${NODE_ENV}' } });
    assert.strictEqual(c.get('db.host'), 'localhost');
    assert.strictEqual(c.get('db.name'), 'app_test');
  });

  it('leaves placeholder when var is missing and not strict', () => {
    const c = new ConfigManager({ env: {}, strict: false });
    c.loadObject({ x: '${MISSING}' });
    assert.strictEqual(c.get('x'), '${MISSING}');
  });

  it('throws when var is missing in strict mode', () => {
    const c = new ConfigManager({ env: {}, strict: true });
    c.loadObject({ x: '${MISSING}' });
    assert.throws(() => c.get('x'), /MISSING/);
  });

  it('skips interpolation when interpolate:false', () => {
    const c = new ConfigManager({ env: fakeEnv, interpolate: false });
    c.loadObject({ host: '${DB_HOST}' });
    assert.strictEqual(c.get('host'), '${DB_HOST}');
  });

  it('interpolates values inside arrays', () => {
    const c = new ConfigManager({ env: fakeEnv });
    c.loadObject({ hosts: ['${DB_HOST}', 'other'] });
    assert.deepStrictEqual(c.get('hosts'), ['localhost', 'other']);
  });
});

describe('validate()', () => {
  it('returns valid:true for a matching schema', () => {
    const c = createConfig().loadObject({ port: 3000, host: 'localhost' });
    const { valid, errors } = c.validate({
      type: 'object',
      properties: {
        port: { type: 'number', minimum: 1, maximum: 65535 },
        host: { type: 'string', minLength: 1 }
      }
    });
    assert.strictEqual(valid, true);
    assert.strictEqual(errors.length, 0);
  });

  it('catches type mismatch', () => {
    const c = createConfig().loadObject({ port: 'not-a-number' });
    const { valid, errors } = c.validate({
      type: 'object',
      properties: { port: { type: 'number' } }
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.some(e => e.includes('port')));
  });

  it('catches missing required properties', () => {
    const c = createConfig().loadObject({ host: 'localhost' });
    const { valid, errors } = c.validate({
      type: 'object',
      required: ['host', 'port']
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.some(e => e.includes('"port"')));
  });

  it('catches minimum violation', () => {
    const c = createConfig().loadObject({ port: 0 });
    const { valid, errors } = c.validate({
      type: 'object',
      properties: { port: { type: 'number', minimum: 1 } }
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.some(e => e.includes('minimum')));
  });

  it('catches maxLength violation', () => {
    const c = createConfig().loadObject({ name: 'toolongname' });
    const { valid, errors } = c.validate({
      type: 'object',
      properties: { name: { type: 'string', maxLength: 5 } }
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.some(e => e.includes('maxLength')));
  });

  it('catches pattern mismatch', () => {
    const c = createConfig().loadObject({ email: 'not-an-email' });
    const { valid, errors } = c.validate({
      type: 'object',
      properties: { email: { type: 'string', pattern: '^[^@]+@[^@]+$' } }
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.some(e => e.includes('pattern')));
  });

  it('catches enum violation', () => {
    const c = createConfig().loadObject({ level: 'verbose' });
    const { valid, errors } = c.validate({
      type: 'object',
      properties: { level: { type: 'string', enum: ['info', 'warn', 'error'] } }
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.some(e => e.includes('enum')));
  });

  it('catches additionalProperties violation', () => {
    const c = createConfig().loadObject({ port: 3000, extra: true });
    const { valid, errors } = c.validate({
      type: 'object',
      properties: { port: { type: 'number' } },
      additionalProperties: false
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.some(e => e.includes('"extra"')));
  });

  it('validates nested object schemas', () => {
    const c = createConfig().loadObject({ db: { host: 'ok', port: -1 } });
    const { valid, errors } = c.validate({
      type: 'object',
      properties: {
        db: {
          type: 'object',
          properties: { port: { type: 'number', minimum: 1 } }
        }
      }
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.some(e => e.includes('db.port')));
  });

  it('accepts union types', () => {
    const c = createConfig().loadObject({ port: '8080' });
    const { valid } = c.validate({
      type: 'object',
      properties: { port: { type: ['number', 'string'] } }
    });
    assert.strictEqual(valid, true);
  });
});

describe('snapshot() & rollback()', () => {
  it('rolls back to a previous state', () => {
    const c = createConfig().loadObject({ x: 1 });
    c.snapshot();
    c.set('x', 999);
    assert.strictEqual(c.get('x'), 999);
    c.rollback();
    assert.strictEqual(c.get('x'), 1);
  });

  it('supports multiple snapshots (stack)', () => {
    const c = createConfig().loadObject({ x: 1 });
    c.snapshot();
    c.set('x', 2);
    c.snapshot();
    c.set('x', 3);
    c.rollback();
    assert.strictEqual(c.get('x'), 2);
    c.rollback();
    assert.strictEqual(c.get('x'), 1);
  });

  it('throws when no snapshot is available', () => {
    const c = createConfig().loadObject({});
    assert.throws(() => c.rollback(), /No snapshot/);
  });
});

describe('toObject() / toJSON()', () => {
  it('toObject returns a deep clone', () => {
    const c = createConfig().loadObject({ a: { b: 1 } });
    const obj = c.toObject();
    obj.a.b = 99;
    assert.strictEqual(c.get('a.b'), 1); // original unchanged
  });

  it('toJSON returns valid JSON string', () => {
    const c = createConfig().loadObject({ x: 1 });
    const json = c.toJSON();
    assert.deepStrictEqual(JSON.parse(json), { x: 1 });
  });
});

describe('save()', () => {
  it('writes JSON to disk and can be reloaded', () => {
    const tmp = path.join(os.tmpdir(), `cfg-save-${Date.now()}.json`);
    const c = createConfig().loadObject({ saved: true });
    c.save(tmp);
    const c2 = createConfig().load(tmp);
    assert.strictEqual(c2.get('saved'), true);
    fs.unlinkSync(tmp);
  });
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('─'.repeat(50));

if (failed > 0) process.exit(1);
