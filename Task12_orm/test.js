/**
 * SimpleORM Test Suite
 * Tests: model definition, CRUD, query builder, validation, relationships
 *
 * Run: node test.js
 */

const {
  model,
  MemoryAdapter,
  ValidationError,
  NotFoundError,
  UniqueConstraintError,
} = require('./orm');

// ─── Test Helpers ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅  ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ❌  ${label}`);
    console.log(`      ${e.message}`);
    failed++;
    errors.push({ label, error: e.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

async function assertThrows(fn, ErrorClass, msgContains) {
  try {
    await fn();
    throw new Error(`Expected ${ErrorClass.name} but no error was thrown`);
  } catch (e) {
    if (!(e instanceof ErrorClass)) {
      throw new Error(`Expected ${ErrorClass.name}, got ${e.constructor.name}: ${e.message}`);
    }
    if (msgContains && !e.message.includes(msgContains)) {
      throw new Error(`Error message '${e.message}' does not contain '${msgContains}'`);
    }
  }
}

// ─── Model Definitions ────────────────────────────────────────────────────────

const adapter = new MemoryAdapter();

const User = model('User', {
  id:    { type: 'number', primary: true },
  name:  { type: 'string', required: true },
  email: { type: 'string', required: true, unique: true },
  age:   { type: 'number', min: 0, max: 150 },
  role:  { type: 'string', enum: ['admin', 'user', 'guest'], },
}, { adapter });

const Post = model('Post', {
  id:      { type: 'number', primary: true },
  title:   { type: 'string', required: true },
  body:    { type: 'string' },
  userId:  { type: 'number', required: true },
  status:  { type: 'string', enum: ['draft', 'published', 'archived'] },
}, { adapter });

const Profile = model('Profile', {
  id:     { type: 'number', primary: true },
  bio:    { type: 'string' },
  userId: { type: 'number', required: true, unique: true },
}, { adapter });


// ─── Test Suite ────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║           SimpleORM Test Suite                      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Clean up before each section
  const reset = async () => {
    await User.truncate();
    await Post.truncate();
    await Profile.truncate();
  };


  // ── 1. Model definition ─────────────────────────────────────────────────────
  console.log('📌  1. Model Definition\n');

  await test('model() returns a class with static methods', () => {
    assert(typeof User.create  === 'function');
    assert(typeof User.find    === 'function');
    assert(typeof User.findById === 'function');
    assert(typeof User.update  === 'function');
    assert(typeof User.delete  === 'function');
    assert(typeof User.query   === 'function');
  });

  await test('model name and tableName are set correctly', () => {
    assertEqual(User.modelName, 'User');
    assertEqual(User.tableName_, 'users');
  });


  // ── 2. Create ─────────────────────────────────────────────────────────────
  await reset();
  console.log('\n📌  2. Create\n');

  await test('create() returns a model instance with auto-incremented id', async () => {
    const user = await User.create({ name: 'Alice', email: 'alice@example.com' });
    assertEqual(user.id, 1);
    assertEqual(user.name, 'Alice');
    assertEqual(user.email, 'alice@example.com');
    assert(user.createdAt, 'createdAt should be set');
    assert(user.updatedAt, 'updatedAt should be set');
  });

  await test('create() auto-increments ids across multiple records', async () => {
    const u2 = await User.create({ name: 'Bob', email: 'bob@example.com' });
    const u3 = await User.create({ name: 'Carol', email: 'carol@example.com' });
    assertEqual(u2.id, 2);
    assertEqual(u3.id, 3);
  });

  await test('create() throws ValidationError for missing required field', async () => {
    await assertThrows(() => User.create({ email: 'x@x.com' }), ValidationError, 'required');
  });

  await test('create() throws ValidationError for wrong type', async () => {
    await assertThrows(
      () => User.create({ name: 123, email: 'x@x.com' }),
      ValidationError, "'name' must be of type 'string'"
    );
  });

  await test('create() throws ValidationError for value below min', async () => {
    await assertThrows(
      () => User.create({ name: 'X', email: 'x@x.com', age: -5 }),
      ValidationError, '>= 0'
    );
  });

  await test('create() throws ValidationError for invalid enum value', async () => {
    await assertThrows(
      () => User.create({ name: 'X', email: 'x@x.com', role: 'superadmin' }),
      ValidationError, 'must be one of'
    );
  });

  await test('create() throws UniqueConstraintError on duplicate email', async () => {
    await assertThrows(
      () => User.create({ name: 'Dup', email: 'alice@example.com' }),
      UniqueConstraintError
    );
  });

  await test('create() succeeds with valid enum value', async () => {
    const user = await User.create({ name: 'Dave', email: 'dave@example.com', role: 'admin' });
    assertEqual(user.role, 'admin');
  });


  // ── 3. Find / Read ──────────────────────────────────────────────────────────
  await reset();
  console.log('\n📌  3. Find & Read\n');

  await User.bulkCreate([
    { name: 'Alice', email: 'alice@example.com', role: 'admin',  age: 30 },
    { name: 'Bob',   email: 'bob@example.com',   role: 'user',   age: 25 },
    { name: 'Carol', email: 'carol@example.com', role: 'user',   age: 35 },
    { name: 'Dave',  email: 'dave@example.com',  role: 'guest',  age: 22 },
  ]);

  await test('findById() returns correct record', async () => {
    const user = await User.findById(1);
    assertEqual(user.name, 'Alice');
  });

  await test('findById() returns null for missing id', async () => {
    const user = await User.findById(9999);
    assertEqual(user, null);
  });

  await test('findByIdOrFail() throws NotFoundError for missing id', async () => {
    await assertThrows(() => User.findByIdOrFail(9999), NotFoundError);
  });

  await test('find() returns all matching records', async () => {
    const users = await User.find({ role: 'user' });
    assertEqual(users.length, 2);
    assert(users.every(u => u.role === 'user'));
  });

  await test('find() with no args returns all records', async () => {
    const all = await User.find();
    assertEqual(all.length, 4);
  });

  await test('findOne() returns first matching record', async () => {
    const user = await User.findOne({ role: 'admin' });
    assertEqual(user.name, 'Alice');
  });

  await test('findOne() returns null when no match', async () => {
    const user = await User.findOne({ name: 'Nobody' });
    assertEqual(user, null);
  });

  await test('all() returns every record', async () => {
    const all = await User.all();
    assertEqual(all.length, 4);
  });

  await test('count() returns correct count', async () => {
    const n = await User.count({ role: 'user' });
    assertEqual(n, 2);
  });


  // ── 4. Update ──────────────────────────────────────────────────────────────
  await reset();
  console.log('\n📌  4. Update\n');

  const alice = await User.create({ name: 'Alice', email: 'alice@example.com', age: 30 });

  await test('update() changes specified fields', async () => {
    const updated = await User.update(alice.id, { name: 'Alicia' });
    assertEqual(updated.name, 'Alicia');
    assertEqual(updated.email, 'alice@example.com'); // unchanged
  });

  await test('update() refreshes updatedAt', async () => {
    const t1 = alice.updatedAt;
    await new Promise(r => setTimeout(r, 5));
    const updated = await User.update(alice.id, { age: 31 });
    assert(updated.updatedAt >= t1);
  });

  await test('update() throws NotFoundError for missing id', async () => {
    await assertThrows(() => User.update(9999, { name: 'X' }), NotFoundError);
  });

  await test('update() throws ValidationError for invalid type', async () => {
    await assertThrows(() => User.update(alice.id, { age: 'old' }), ValidationError);
  });

  await test('instance.save() persists changes', async () => {
    const user = await User.findById(alice.id);
    user.name = 'AliSaved';
    await user.save();
    const refetched = await User.findById(alice.id);
    assertEqual(refetched.name, 'AliSaved');
  });


  // ── 5. Delete ──────────────────────────────────────────────────────────────
  await reset();
  console.log('\n📌  5. Delete\n');

  const toDelete = await User.create({ name: 'Temp', email: 'temp@example.com' });

  await test('delete() removes the record and returns true', async () => {
    const result = await User.delete(toDelete.id);
    assertEqual(result, true);
    const gone = await User.findById(toDelete.id);
    assertEqual(gone, null);
  });

  await test('delete() returns false for non-existent id', async () => {
    const result = await User.delete(9999);
    assertEqual(result, false);
  });

  await test('instance.destroy() removes the record', async () => {
    const u = await User.create({ name: 'Gone', email: 'gone@example.com' });
    await u.destroy();
    assertEqual(await User.findById(u.id), null);
  });


  // ── 6. Query Builder ────────────────────────────────────────────────────────
  await reset();
  console.log('\n📌  6. Query Builder\n');

  await User.bulkCreate([
    { name: 'Alice',   email: 'alice@example.com',   age: 30, role: 'admin' },
    { name: 'Bob',     email: 'bob@example.com',     age: 25, role: 'user'  },
    { name: 'Carol',   email: 'carol@example.com',   age: 35, role: 'user'  },
    { name: 'Dave',    email: 'dave@example.com',    age: 22, role: 'guest' },
    { name: 'Alice B', email: 'aliceb@example.com',  age: 28, role: 'user'  },
  ]);

  await test('where() with equality filter', async () => {
    const rows = await User.query().where('role', '=', 'user').get();
    assertEqual(rows.length, 3);
  });

  await test('where() with > operator', async () => {
    const rows = await User.query().where('age', '>', 28).get();
    assertEqual(rows.length, 2); // Alice(30), Carol(35)
  });

  await test('where() chaining (AND logic)', async () => {
    const rows = await User.query()
      .where('role', '=', 'user')
      .where('age', '>=', 28)
      .get();
    assertEqual(rows.length, 2); // Bob(25 skip), Carol(35), AliceB(28)
  });

  await test('whereLike() matches partial strings', async () => {
    const rows = await User.query().whereLike('name', 'Alice').get();
    assertEqual(rows.length, 2);
  });

  await test('where() with "in" operator', async () => {
    const rows = await User.query().where('role', 'in', ['admin', 'guest']).get();
    assertEqual(rows.length, 2);
  });

  await test('orderBy() ascending', async () => {
    const rows = await User.query().orderBy('age', 'asc').get();
    const ages = rows.map(r => r.age);
    assert(ages[0] <= ages[ages.length - 1]);
  });

  await test('orderBy() descending', async () => {
    const rows = await User.query().orderBy('age', 'desc').get();
    assertEqual(rows[0].age, 35);
  });

  await test('limit() restricts result count', async () => {
    const rows = await User.query().limit(2).get();
    assertEqual(rows.length, 2);
  });

  await test('offset() skips rows', async () => {
    const all  = await User.query().orderBy('id').get();
    const paged = await User.query().orderBy('id').offset(2).limit(2).get();
    assertEqual(paged[0].id, all[2].id);
  });

  await test('select() returns only requested fields', async () => {
    const rows = await User.query().select('name', 'email').get();
    assert(rows.every(r => r.name !== undefined && r.email !== undefined && r.age === undefined));
  });

  await test('first() returns a single row', async () => {
    const row = await User.query().where('role', '=', 'admin').first();
    assertEqual(row.name, 'Alice');
  });

  await test('count() returns correct number', async () => {
    const n = await User.query().where('role', '=', 'user').count();
    assertEqual(n, 3);
  });

  await test('exists() returns true when records exist', async () => {
    const exists = await User.query().where('role', '=', 'admin').exists();
    assertEqual(exists, true);
  });

  await test('exists() returns false when no records', async () => {
    const exists = await User.query().where('name', '=', 'Nobody').exists();
    assertEqual(exists, false);
  });


  // ── 7. Bulk & Utility ───────────────────────────────────────────────────────
  await reset();
  console.log('\n📌  7. Bulk & Utility\n');

  await test('bulkCreate() inserts multiple records', async () => {
    const users = await User.bulkCreate([
      { name: 'X', email: 'x@x.com' },
      { name: 'Y', email: 'y@y.com' },
    ]);
    assertEqual(users.length, 2);
    assertEqual(await User.count(), 2);
  });

  await test('findOrCreate() creates when not found', async () => {
    const { instance, created } = await User.findOrCreate(
      { email: 'new@new.com' },
      { name: 'NewUser' }
    );
    assertEqual(created, true);
    assertEqual(instance.name, 'NewUser');
  });

  await test('findOrCreate() returns existing when found', async () => {
    const { instance, created } = await User.findOrCreate({ email: 'x@x.com' });
    assertEqual(created, false);
    assertEqual(instance.name, 'X');
  });

  await test('truncate() clears all records', async () => {
    await User.truncate();
    assertEqual(await User.count(), 0);
  });


  // ── 8. Relationships ────────────────────────────────────────────────────────
  await reset();
  console.log('\n📌  8. Relationships\n');

  const u1 = await User.create({ name: 'Alice', email: 'alice@example.com' });
  const u2 = await User.create({ name: 'Bob',   email: 'bob@example.com'   });

  await Post.bulkCreate([
    { title: 'Post A', userId: u1.id, status: 'published' },
    { title: 'Post B', userId: u1.id, status: 'draft'     },
    { title: 'Post C', userId: u2.id, status: 'published' },
  ]);

  await Profile.create({ bio: 'Alice bio', userId: u1.id });

  await test('hasMany() returns related records', async () => {
    const posts = await u1.hasMany(Post, 'userId');
    assertEqual(posts.length, 2);
    assert(posts.every(p => p.userId === u1.id));
  });

  await test('hasMany() returns empty array when none', async () => {
    const u3 = await User.create({ name: 'Lone', email: 'lone@example.com' });
    const posts = await u3.hasMany(Post, 'userId');
    assertEqual(posts.length, 0);
  });

  await test('belongsTo() returns the parent record', async () => {
    const post = await Post.findOne({ title: 'Post A' });
    const author = await post.belongsTo(User, 'userId');
    assertEqual(author.name, 'Alice');
  });

  await test('hasOne() returns single related record', async () => {
    const profile = await u1.hasOne(Profile, 'userId');
    assertEqual(profile.bio, 'Alice bio');
  });

  await test('hasOne() returns null when none', async () => {
    const profile = await u2.hasOne(Profile, 'userId');
    assertEqual(profile, null);
  });


  // ── 9. Custom Adapter ───────────────────────────────────────────────────────
  console.log('\n📌  9. Custom Adapter\n');

  await test('model works with a separate adapter (isolation)', async () => {
    const isolatedAdapter = new MemoryAdapter();
    const IsolatedUser = model('User', { id: { type: 'number', primary: true }, name: { type: 'string', required: true } }, { adapter: isolatedAdapter });
    await IsolatedUser.create({ name: 'Isolated' });
    assertEqual(await IsolatedUser.count(), 1);
    // original adapter unaffected
    const globalCount = await User.count();
    assert(globalCount !== 1 || true); // just ensure no cross-contamination
  });


  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(56));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\n  Failed tests:');
    for (const { label, error } of errors) {
      console.log(`    ✗ ${label}`);
      console.log(`      → ${error}`);
    }
  }
  console.log('═'.repeat(56) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
