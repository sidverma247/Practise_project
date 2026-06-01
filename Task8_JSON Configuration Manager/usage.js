'use strict';

// Set env vars for demo
process.env.DB_HOST    = 'db.example.com';
process.env.DB_PORT    = '5432';
process.env.NODE_ENV   = 'production';

const { createConfig } = require('../src');

// ── 1. Load a file ───────────────────────────────────────────────────────────
const config = createConfig();
config.load('./config.json');

// ── 2. Get values ────────────────────────────────────────────────────────────
console.log('DB host  :', config.get('database.host'));           // db.example.com
console.log('DB port  :', config.get('database.port'));           // 5432
console.log('DB name  :', config.get('database.name'));           // myapp_production
console.log('Pool min :', config.get('database.pool.min'));       // 2
console.log('Missing  :', config.get('database.password', 'n/a'));// n/a  (default)

// ── 3. Set values ────────────────────────────────────────────────────────────
config.set('database.port', 3306);
config.set('server.port', 8080);
config.set('newSection.key', 'auto-created');

console.log('\nAfter set:');
console.log('DB port  :', config.get('database.port'));           // 3306
console.log('New key  :', config.get('newSection.key'));          // auto-created

// ── 4. Snapshot & rollback ───────────────────────────────────────────────────
config.snapshot();
config.set('database.port', 9999);
console.log('\nAfter snapshot + mutate:', config.get('database.port')); // 9999
config.rollback();
console.log('After rollback         :', config.get('database.port')); // 3306

// ── 5. Schema validation ─────────────────────────────────────────────────────
const schema = {
  type: 'object',
  required: ['database', 'server'],
  properties: {
    database: {
      type: 'object',
      required: ['host', 'port', 'name'],
      properties: {
        host: { type: 'string', minLength: 1 },
        port: { type: ['number', 'string'] },
        name: { type: 'string' }
      }
    },
    server: {
      type: 'object',
      properties: {
        port: { type: 'number', minimum: 1, maximum: 65535 }
      }
    }
  }
};

const { valid, errors } = config.validate(schema);
console.log('\nValidation result:', valid ? '✅ VALID' : '❌ INVALID');
if (errors.length) console.log('Errors:', errors);

// ── 6. Serialise ─────────────────────────────────────────────────────────────
console.log('\nCurrent config (raw JSON):');
console.log(config.toJSON());
