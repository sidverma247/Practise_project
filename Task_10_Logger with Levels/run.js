/**
 * Test suite for logger-lib
 * Run with: node tests/run.js
 *
 * Uses a tiny assertion helper — no external deps needed.
 */

import { Logger, createLogger, LEVELS, parseLevel,
         ConsoleTransport, FileTransport, MemoryTransport,
         prettyFormatter, jsonFormatter }
  from '../src/index.js';

import fs   from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Tiny test runner
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(a, b, label) {
  if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`      ${err.message}`);
    failed++;
  }
}

function suite(name) {
  console.log(`\n${name}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

suite('Levels');

await test('parseLevel accepts string (case-insensitive)', () => {
  assertEqual(parseLevel('debug'), LEVELS.DEBUG, 'debug');
  assertEqual(parseLevel('INFO'),  LEVELS.INFO,  'INFO');
  assertEqual(parseLevel('warn'),  LEVELS.WARN,  'warn');
  assertEqual(parseLevel('ERROR'), LEVELS.ERROR, 'ERROR');
});

await test('parseLevel accepts numeric levels', () => {
  assertEqual(parseLevel(0), 0, 'numeric 0');
  assertEqual(parseLevel(3), 3, 'numeric 3');
});

await test('parseLevel throws on unknown level', () => {
  let threw = false;
  try { parseLevel('TRACE'); } catch { threw = true; }
  assert(threw, 'should throw for TRACE');
});

// ──

suite('Logger — basic');

await test('constructor defaults', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ transports: [mem] });
  assertEqual(log.getLevel(), 'DEBUG', 'default level');
});

await test('setLevel / getLevel round-trip', () => {
  const log = new Logger({ transports: [] });
  log.setLevel('WARN');
  assertEqual(log.getLevel(), 'WARN', 'getLevel after setLevel');
});

await test('setLevel returns logger (chainable)', () => {
  const log = new Logger({ transports: [] });
  assert(log.setLevel('INFO') === log, 'should return self');
});

await test('log() returns the entry object', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ transports: [mem] });
  const entry = log.info('hello');
  assert(entry && entry.level === 'INFO', 'entry.level should be INFO');
  assert(entry.message === 'hello', 'entry.message should be hello');
  assert(entry.timestamp, 'entry.timestamp should exist');
});

// ──

suite('Logger — level filtering');

await test('messages below minimum level are suppressed', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ level: 'WARN', transports: [mem] });

  log.debug('debug msg');
  log.info('info msg');
  log.warn('warn msg');
  log.error('error msg');

  assertEqual(mem.entries.length, 2, 'only warn + error should pass');
  assertEqual(mem.entries[0].level, 'WARN',  'first entry WARN');
  assertEqual(mem.entries[1].level, 'ERROR', 'second entry ERROR');
});

await test('SILENT level suppresses everything', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ level: 'SILENT', transports: [mem] });

  log.debug('d'); log.info('i'); log.warn('w'); log.error('e');
  assertEqual(mem.entries.length, 0, 'nothing should be logged');
});

await test('DEBUG level passes everything', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ level: 'DEBUG', transports: [mem] });

  log.debug('d'); log.info('i'); log.warn('w'); log.error('e');
  assertEqual(mem.entries.length, 4, 'all 4 should pass');
});

// ──

suite('Logger — metadata');

await test('metadata is merged into entry', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ transports: [mem] });
  log.info('login', { userId: 99 });

  assertEqual(mem.entries[0].metadata.userId, 99, 'userId in metadata');
});

await test('defaultMeta is merged into every entry', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ defaultMeta: { service: 'api' }, transports: [mem] });
  log.warn('slow query');

  assertEqual(mem.entries[0].metadata.service, 'api', 'service in metadata');
});

await test('per-call metadata overrides defaultMeta', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ defaultMeta: { env: 'prod' }, transports: [mem] });
  log.info('msg', { env: 'staging' });

  assertEqual(mem.entries[0].metadata.env, 'staging', 'override should win');
});

// ──

suite('Logger — child loggers');

await test('child inherits parent transports', () => {
  const mem  = new MemoryTransport();
  const root = new Logger({ transports: [mem] });
  const child = root.child({ name: 'child' });

  child.info('from child');
  assertEqual(mem.entries.length, 1, 'parent transport should receive child entry');
});

await test('child merges defaultMeta with parent', () => {
  const mem  = new MemoryTransport();
  const root = new Logger({ defaultMeta: { app: 'myapp' }, transports: [mem] });
  const child = root.child({ defaultMeta: { module: 'auth' } });

  child.info('login');
  const { metadata } = mem.entries[0];
  assertEqual(metadata.app,    'myapp', 'app from parent');
  assertEqual(metadata.module, 'auth',  'module from child');
});

// ──

suite('Formatters');

await test('jsonFormatter produces valid JSON', () => {
  const entry = { timestamp: 'T', level: 'INFO', message: 'hi', metadata: { x: 1 } };
  const out   = jsonFormatter(entry);
  const parsed = JSON.parse(out);
  assertEqual(parsed.level,           'INFO', 'level');
  assertEqual(parsed.metadata.x,      1,      'metadata.x');
});

await test('prettyFormatter (no color) produces readable string', () => {
  const entry = { timestamp: '2025-01-01T00:00:00.000Z', level: 'WARN', message: 'oops', metadata: {} };
  const out   = prettyFormatter(entry, { colors: false });
  assert(out.includes('WARN'),   'should contain level');
  assert(out.includes('oops'),   'should contain message');
  assert(out.includes('2025'),   'should contain timestamp');
});

await test('prettyFormatter includes metadata when present', () => {
  const entry = { timestamp: 'T', level: 'ERROR', message: 'boom', metadata: { code: 500 } };
  const out   = prettyFormatter(entry, { colors: false });
  assert(out.includes('500'), 'should include metadata value');
});

// ──

suite('MemoryTransport');

await test('stores entries and lines separately', () => {
  const mem = new MemoryTransport({ formatter: jsonFormatter });
  const log = new Logger({ transports: [mem] });
  log.info('a'); log.warn('b');

  assertEqual(mem.entries.length, 2, 'two entries');
  assertEqual(mem.lines.length,   2, 'two lines');
  assert(mem.lines[0].startsWith('{'), 'line is JSON');
});

await test('clear() empties both arrays', () => {
  const mem = new MemoryTransport();
  const log = new Logger({ transports: [mem] });
  log.info('x');
  mem.clear();
  assertEqual(mem.entries.length, 0, 'entries cleared');
  assertEqual(mem.lines.length,   0, 'lines cleared');
});

await test('transport-level filter works independently', () => {
  const mem  = new MemoryTransport({ level: 'ERROR' });
  const log  = new Logger({ level: 'DEBUG', transports: [mem] });

  log.debug('d'); log.info('i'); log.warn('w'); log.error('e');
  assertEqual(mem.entries.length, 1, 'only ERROR should reach mem transport');
});

// ──

suite('FileTransport');

const TMP_DIR  = '/tmp/logger-tests';
const TMP_FILE = path.join(TMP_DIR, 'test.log');

function cleanup() {
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch {}
}

cleanup();

await test('creates file and writes JSON lines', async () => {
  const ft  = new FileTransport({ filename: TMP_FILE });
  const log = new Logger({ transports: [ft] });

  log.info('file entry', { x: 1 });
  log.warn('file warn');

  await ft.close();

  const lines = fs.readFileSync(TMP_FILE, 'utf8').trim().split('\n');
  assertEqual(lines.length, 2, 'two lines written');
  const parsed = JSON.parse(lines[0]);
  assertEqual(parsed.level, 'INFO', 'first line level');
});

await test('creates intermediate directories automatically', async () => {
  const deep = path.join(TMP_DIR, 'a', 'b', 'c', 'deep.log');
  const ft   = new FileTransport({ filename: deep });
  const log  = new Logger({ transports: [ft] });
  log.error('deep');
  await ft.close();
  assert(fs.existsSync(deep), 'nested directories should be created');
});

await test('maxSize triggers rotation', async () => {
  const file = path.join(TMP_DIR, 'rot.log');
  const ft   = new FileTransport({ filename: file, maxSize: 50 });
  const log  = new Logger({ transports: [ft] });

  // Write enough to exceed 50 bytes; tiny delay ensures unique rotation suffixes
  for (let i = 0; i < 10; i++) {
    log.info(`msg ${i}`);
    await new Promise(r => setTimeout(r, 5));
  }
  await ft.close();

  const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith('rot'));
  assert(files.length >= 2, `rotation should produce extra files (got ${files.length})`);
});

cleanup();

// ──

suite('createLogger factory');

await test('returns a Logger instance', () => {
  const log = createLogger({ level: 'WARN' });
  assert(log instanceof Logger, 'should be a Logger');
  assertEqual(log.getLevel(), 'WARN', 'level should be WARN');
});

await test('adds FileTransport when filename given', () => {
  const file = '/tmp/factory-test.log';
  const log  = createLogger({ filename: file });
  const hasFile = log.transports.some(t => t instanceof FileTransport);
  assert(hasFile, 'should have a FileTransport');
  try { fs.unlinkSync(file); } catch {}
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`  ${passed} passed, ${failed} failed`);
console.log('─'.repeat(50));

if (failed > 0) process.exit(1);
