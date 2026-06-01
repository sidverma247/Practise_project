# logger-lib

A lightweight, zero-dependency logging library for Node.js with configurable levels, formatters, and transports.

---

## Features

- Four log levels — `DEBUG`, `INFO`, `WARN`, `ERROR` — plus `SILENT` to suppress all output
- Per-logger and per-transport minimum level filtering
- Two output formats — human-readable **pretty** (with ANSI colors) and machine-readable **JSON**
- Three built-in transports — **Console**, **File**, and **Memory** (for testing)
- File rotation by size (`maxSize`) and by date (`rotate: true`)
- Child loggers that inherit transports and merge metadata
- Fully chainable API

---

## Requirements

- Node.js 14.8+ (ESM / top-level `await`)
- No `npm install` needed — zero dependencies

---

## Installation

Copy the `src/` folder into your project and import directly:

```js
import { createLogger } from './src/index.js';
```

---

## Quick Start

```js
import { createLogger } from './src/index.js';

const logger = createLogger({ level: 'DEBUG' });

logger.debug('Query executed',    { sql: 'SELECT *', ms: 12 });
logger.info('User logged in',     { userId: 123 });
logger.warn('High memory usage',  { mb: 512 });
logger.error('Database error',    { error: 'connection refused' });
```

---

## Running the Tests

```bash
node tests/run.js
```

All 26 tests should pass with no external dependencies.

---

## API

### `createLogger(options)` — factory helper

The quickest way to get a logger with sensible defaults.

| Option | Type | Default | Description |
|---|---|---|---|
| `level` | `string` | `'INFO'` | Minimum log level |
| `format` | `'pretty' \| 'json'` | `'pretty'` | Output format |
| `colors` | `boolean` | `true` | ANSI colors (pretty format only) |
| `name` | `string` | — | Logger namespace, added to every entry |
| `defaultMeta` | `object` | `{}` | Metadata merged into every entry |
| `filename` | `string` | — | If provided, also writes to this file |
| `fileRotate` | `boolean` | `false` | Daily file rotation (appends `YYYY-MM-DD` to filename) |
| `fileMaxSize` | `number` | — | Max file size in bytes before rotation |

```js
const logger = createLogger({
  level: 'WARN',
  format: 'json',
  filename: './logs/app.log',
  fileMaxSize: 5_000_000,  // 5 MB
});
```

---

### `new Logger(options)` — full control

```js
import { Logger, ConsoleTransport, FileTransport, jsonFormatter } from './src/index.js';

const logger = new Logger({
  level: 'DEBUG',
  name: 'api-server',
  defaultMeta: { env: 'production' },
  transports: [
    new ConsoleTransport({ format: 'pretty', colors: true }),
    new FileTransport({ filename: './logs/errors.log', level: 'ERROR' }),
  ],
});
```

#### Methods

| Method | Description |
|---|---|
| `logger.debug(msg, meta?)` | Log at DEBUG level |
| `logger.info(msg, meta?)`  | Log at INFO level |
| `logger.warn(msg, meta?)`  | Log at WARN level |
| `logger.error(msg, meta?)` | Log at ERROR level |
| `logger.log(level, msg, meta?)` | Log at any level |
| `logger.setLevel(level)` | Change minimum level (chainable) |
| `logger.getLevel()` | Returns current level as a string |
| `logger.addTransport(t)` | Add a transport (chainable) |
| `logger.removeTransport(t)` | Remove a transport (chainable) |
| `logger.child(options)` | Create a child logger |

---

### Log Levels

Levels are ordered — setting a minimum level suppresses everything below it.

| Level | Value | Console method |
|---|---|---|
| `DEBUG` | 0 | `console.debug` |
| `INFO`  | 1 | `console.info`  |
| `WARN`  | 2 | `console.warn`  |
| `ERROR` | 3 | `console.error` |
| `SILENT`| 4 | _(suppresses all)_ |

```js
logger.setLevel('WARN');   // only WARN and ERROR pass through
logger.setLevel('SILENT'); // nothing is logged
```

---

### Child Loggers

Children share their parent's transports but can have their own name, level, and metadata. Metadata is deep-merged.

```js
const root  = new Logger({ defaultMeta: { app: 'myapp' }, transports: [...] });
const child = root.child({ name: 'auth', defaultMeta: { module: 'auth' } });

child.info('Login attempt', { userId: 42 });
// → { app: 'myapp', module: 'auth', userId: 42 }
```

---

## Transports

### `ConsoleTransport`

Writes to stdout/stderr using the appropriate `console.*` method per level.

```js
new ConsoleTransport({
  level: 'DEBUG',         // minimum level for this transport
  formatter: prettyFormatter,
  formatOptions: { colors: true },
})
```

### `FileTransport`

Appends to a file. Creates intermediate directories automatically.

```js
new FileTransport({
  filename: './logs/app.log',
  level: 'ERROR',          // only write errors to file
  rotate: true,            // daily rotation → app-2025-01-15.log
  maxSize: 10_000_000,     // rotate at 10 MB
  maxFiles: 7,             // keep 7 rotated files (default)
})
```

Call `await transport.close()` for graceful shutdown before your process exits.

### `MemoryTransport`

Stores entries in memory. Designed for testing.

```js
const mem = new MemoryTransport();
const log = new Logger({ transports: [mem] });

log.info('hello');
console.log(mem.entries);  // [{ level: 'INFO', message: 'hello', ... }]
console.log(mem.lines);    // ['{"level":"INFO","message":"hello",...}']

mem.clear();               // reset
```

---

## Formatters

### Pretty (default)

Human-readable with ANSI colors. Best for development.

```
[2025-01-15T10:30:00.000Z] [INFO ] User logged in { "userId": 123 }
```

### JSON

One JSON object per line. Best for log aggregators (Datadog, Splunk, etc.).

```json
{"timestamp":"2025-01-15T10:30:00.000Z","level":"INFO","message":"User logged in","metadata":{"userId":123}}
```

Use formatters directly or pass them to any transport:

```js
import { jsonFormatter, prettyFormatter } from './src/index.js';

new ConsoleTransport({ formatter: jsonFormatter });
new FileTransport({ filename: 'app.log', formatter: prettyFormatter, formatOptions: { colors: false } });
```

---

## Log Entry Shape

Every entry passed to transports has this structure:

```js
{
  timestamp: "2025-01-15T10:30:00.000Z",  // ISO 8601
  level:     "INFO",
  message:   "User logged in",
  metadata:  { userId: 123, env: "production" },
  name:      "api-server"                 // only if logger.name is set
}
```

---

## Project Structure

```
logger/
├── src/
│   ├── index.js        — public API + createLogger() factory
│   ├── logger.js       — Logger class
│   ├── transports.js   — ConsoleTransport, FileTransport, MemoryTransport
│   ├── formatters.js   — prettyFormatter, jsonFormatter
│   └── levels.js       — LEVELS map, parseLevel()
├── tests/
│   └── run.js          — 26-test suite (no external deps)
└── package.json
```

---

## License

MIT
