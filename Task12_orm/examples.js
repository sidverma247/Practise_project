/**
 * SimpleORM — usage examples
 * Run: node examples.js
 */

const { model, MemoryAdapter, ValidationError, NotFoundError } = require('./orm');

const adapter = new MemoryAdapter();

// ── 1. Define Models ─────────────────────────────────────────────────────────

const User = model('User', {
  id:    { type: 'number', primary: true },
  name:  { type: 'string', required: true },
  email: { type: 'string', required: true, unique: true },
  age:   { type: 'number', min: 0, max: 150 },
  role:  { type: 'string', enum: ['admin', 'user', 'guest'] },
}, { adapter });

const Post = model('Post', {
  id:      { type: 'number', primary: true },
  title:   { type: 'string', required: true },
  body:    { type: 'string' },
  userId:  { type: 'number', required: true },
  status:  { type: 'string', enum: ['draft', 'published'] },
}, { adapter });


async function main() {
  console.log('── SimpleORM Examples ──\n');

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  // Create
  const john = await User.create({ name: 'John', email: 'john@example.com', age: 28, role: 'user' });
  const jane = await User.create({ name: 'Jane', email: 'jane@example.com', age: 32, role: 'admin' });
  console.log('Created:', john.name, `(id=${john.id})`);

  // Find by id
  const found = await User.findById(john.id);
  console.log('findById:', found.name);

  // Find with filter
  const admins = await User.find({ role: 'admin' });
  console.log('Admins:', admins.map(u => u.name));

  // Update
  const updated = await User.update(john.id, { name: 'Johnny' });
  console.log('Updated name:', updated.name);

  // Delete
  const tempUser = await User.create({ name: 'Temp', email: 'temp@example.com' });
  await User.delete(tempUser.id);
  console.log('Deleted user id=', tempUser.id);

  // ── Query Builder ─────────────────────────────────────────────────────────────

  console.log('\n── Query Builder ──');

  await User.bulkCreate([
    { name: 'Alice', email: 'alice@example.com', age: 22, role: 'user' },
    { name: 'Bob',   email: 'bob@example.com',   age: 45, role: 'user' },
    { name: 'Carol', email: 'carol@example.com', age: 19, role: 'guest' },
  ]);

  // Complex query
  const results = await User.query()
    .where('role', '=', 'user')
    .where('age', '>', 20)
    .orderBy('age', 'desc')
    .limit(5)
    .select('name', 'age', 'role')
    .get();

  console.log('Users (role=user, age>20, ordered by age desc):');
  results.forEach(r => console.log(`  ${r.name} (${r.age})`));

  // Count
  const userCount = await User.query().where('role', '=', 'user').count();
  console.log('Total users with role=user:', userCount);

  // Exists check
  const hasAdmin = await User.query().where('role', '=', 'admin').exists();
  console.log('Has admin:', hasAdmin);

  // ── Relationships ─────────────────────────────────────────────────────────────

  console.log('\n── Relationships ──');

  const author = await User.findOne({ email: 'jane@example.com' });
  await Post.bulkCreate([
    { title: 'Hello World',   body: 'First post!',  userId: author.id, status: 'published' },
    { title: 'Draft Post',    body: 'Coming soon.', userId: author.id, status: 'draft' },
  ]);

  // hasMany
  const authorPosts = await author.hasMany(Post, 'userId');
  console.log(`${author.name}'s posts:`, authorPosts.map(p => p.title));

  // belongsTo
  const post = await Post.findOne({ title: 'Hello World' });
  const postAuthor = await post.belongsTo(User, 'userId');
  console.log(`"${post.title}" author:`, postAuthor.name);

  // ── findOrCreate ──────────────────────────────────────────────────────────────

  console.log('\n── findOrCreate ──');

  const { instance: existing, created: c1 } = await User.findOrCreate(
    { email: 'john@example.com' },
    { name: 'John' }
  );
  console.log(`john@example.com → created: ${c1}, name: ${existing.name}`);

  const { instance: newUser, created: c2 } = await User.findOrCreate(
    { email: 'newbie@example.com' },
    { name: 'Newbie', role: 'guest' }
  );
  console.log(`newbie@example.com → created: ${c2}, name: ${newUser.name}`);

  // ── Validation errors ─────────────────────────────────────────────────────────

  console.log('\n── Validation ──');

  try {
    await User.create({ email: 'no-name@example.com' });
  } catch (e) {
    console.log('Caught ValidationError:', e.message);
  }

  try {
    await User.create({ name: 'Dup', email: 'john@example.com' });
  } catch (e) {
    console.log('Caught UniqueConstraintError:', e.message);
  }

  try {
    await User.findByIdOrFail(9999);
  } catch (e) {
    console.log('Caught NotFoundError:', e.message);
  }

  console.log('\n✅  All examples ran successfully\n');
}

main().catch(console.error);
