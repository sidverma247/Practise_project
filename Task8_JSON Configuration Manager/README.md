# JSON Configuration Manager

A zero-dependency Node.js library for managing application configuration from JSON files.

## Features

| Feature | Details |
|---|---|
| 🔑 Dot-notation access | `config.get('database.host')` |
| 🌿 Env-var interpolation | `"${DB_HOST}"` in JSON is resolved at read time |
| ✅ Schema validation | JSON-Schema-style rules (type, required, min/max, pattern, enum…) |
| 📸 Snapshots & rollback | Save state, mutate freely, revert when needed |
| 🔀 Deep merge | Load multiple files with `{ merge: true }` |
| 💾 Persist | Write config back to disk with `config.save(path)` |

---

## Installation

```
# Copy src/ into your project, or:
npm install   # (no external dependencies)
```

---

## Quick Start

```js
const { createConfig } = require('./src');

const config = createConfig();
config.load('./config.json');

config.get('database.host');          // resolved from ${DB_HOST}
config.get('database.port', 5432);   // 5432 when key missing
config.set('database.port', 3306);   // override a value
```

---

## API Reference

### `createConfig(options?)` → `ConfigManager`

Factory function. Options:

| Option | Type | Default | Description |
|---|---|---|---|
| `env` | `object` | `process.env` | Environment variable source |
| `interpolate` | `boolean` | `true` | Resolve `${VAR}` placeholders |
| `strict` | `boolean` | `false` | Throw on missing env vars |

---

### Instance Methods

#### `config.load(filePath, opts?)`
Load from a `.json` file. Pass `{ merge: true }` to merge into existing config.

```js
config.load('./base.json');
config.load('./local.json', { merge: true });
```

#### `config.loadObject(obj, opts?)`
Load from a plain JavaScript object. Useful for testing.

```js
config.loadObject({ database: { port: 5432 } });
```

#### `config.get(keyPath, default?)`
Read a value using dot-notation. Returns `default` (or `undefined`) when missing.

```js
config.get('database.host');
config.get('database.port', 5432);
config.get('database.pool.max');
```

#### `config.set(keyPath, value)`
Write a value. Intermediate objects are auto-created.

```js
config.set('database.port', 3306);
config.set('newSection.enabled', true);
```

#### `config.delete(keyPath)` → `boolean`
Remove a key. Returns `true` if the key existed.

#### `config.has(keyPath)` → `boolean`
Check whether a key is present (even if its value is `null`/`false`/`0`).

#### `config.validate(schema)` → `{ valid, errors }`

Validate against a JSON-Schema-like schema. Supported keywords:

- **type** – `'string'`, `'number'`, `'integer'`, `'boolean'`, `'array'`, `'object'`, `'null'`, or an array of these
- **required** – array of required property names
- **properties** – sub-schemas per property
- **additionalProperties** – `false` to forbid extra keys
- **minimum** / **maximum** – numeric bounds
- **minLength** / **maxLength** – string length bounds
- **pattern** – regex string
- **enum** – array of allowed values

```js
const { valid, errors } = config.validate({
  type: 'object',
  required: ['database'],
  properties: {
    database: {
      type: 'object',
      required: ['host', 'port'],
      properties: {
        host: { type: 'string', minLength: 1 },
        port: { type: ['number', 'string'] }
      }
    }
  }
});

if (!valid) console.error(errors);
```

#### `config.snapshot()` / `config.rollback()`
Save and restore config state (stack-based).

```js
config.snapshot();
config.set('dangerous.flag', true);
// something goes wrong…
config.rollback(); // back to snapshot state
```

#### `config.toObject()` → `object`
Deep clone of the raw (pre-interpolation) config.

#### `config.toJSON(space?)` → `string`
Pretty-printed JSON string.

#### `config.save(filePath)`
Write the current config to a file.

---

## Environment Variable Interpolation

Any string value in your JSON can reference an environment variable:

```json
{
  "database": {
    "host": "${DB_HOST}",
    "name": "app_${NODE_ENV}"
  }
}
```

Placeholders are resolved when you call `config.get()`.

- If a variable is **missing** and `strict: false` (default), the placeholder is returned as-is.
- If `strict: true`, a missing variable throws an `Error`.
- Pass `interpolate: false` to disable this feature entirely.

---

## Config File Example

```json
{
  "database": {
    "host": "${DB_HOST}",
    "port": "${DB_PORT}",
    "name": "myapp_${NODE_ENV}",
    "pool": { "min": 2, "max": 10 }
  },
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

---

## Running Tests

```bash
npm test
# or
node tests/ConfigManager.test.js
```

---

## Running the Example

```bash
DB_HOST=localhost DB_PORT=5432 NODE_ENV=production node examples/usage.js
```

---

## Project Structure

```
config-manager/
├── src/
│   ├── index.js           # Public API entry point
│   └── ConfigManager.js   # Core implementation
├── tests/
│   └── ConfigManager.test.js
├── examples/
│   ├── config.json
│   └── usage.js
├── package.json
└── README.md
```
