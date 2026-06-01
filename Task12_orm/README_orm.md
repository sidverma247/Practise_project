# SimpleORM

A lightweight ORM-like layer for JavaScript. No dependencies, no database required — ships with a fast in-memory adapter and a clean interface for swapping in a real DB driver.

---

## Files

```
simple-orm/
├── orm.js        ← Core library (import this)
├── examples.js   ← Runnable usage examples
├── test.js       ← Full test suite (51 tests)
└── README.md
```

---

## Quick start

```bash
node examples.js   # see everything in action
node test.js       # run 51 tests
```

No `npm install` needed — zero external dependencies.

---

## API Reference

### `model(name, schema, [options])`

Define a model. Returns a class with static CRUD methods.

```js
const { model } = require('./orm');

const User = model('User', {
  id:    { type: 'number', primary: true },
  name:  { type: 'string', required: true },
  email: { type: 'string', required: true, unique: true },
  age:   { type: 'number', min: 0, max: 150 },
  role:  { type: 'string', enum: ['admin', 'user', 'guest'] },
});
```

**Options**

| Option       | Default              | Description                         |
|--------------|----------------------|-------------------------------------|
| `adapter`    | shared MemoryAdapter | Storage backend                     |
| `tableName`  | `name.toLowerCase() + 's'` | Table/collection name         |
| `timestamps` | `true`               | Auto-add `createdAt` / `updatedAt`  |

**Schema field rules**

| Rule        | Type              | Description                              |
|-------------|-------------------|------------------------------------------|
| `type`      | string            | `'string'`, `'number'`, `'boolean'`, `'date'`, `'object'`, `'array'` |
| `primary`   | boolean           | Marks the primary key field              |
| `required`  | boolean           | Throws if missing on create              |
| `unique`    | boolean           | Enforces uniqueness across records       |
| `min`       | number            | Min value (numbers) or min length (strings) |
| `max`       | number            | Max value (numbers) or max length (strings) |
| `enum`      | any[]             | Value must be one of these               |
| `validate`  | `(v) => true/string` | Custom validator; return `true` or an error message |

---

### CRUD

#### `User.create(data)` → `Promise<instance>`

```js
const user = await User.create({ name: 'John', email: 'john@example.com' });
// user.id   → auto-incremented
// user.createdAt / updatedAt → ISO timestamps
```

Throws `ValidationError` on bad data, `UniqueConstraintError` on duplicate unique fields.

---

#### `User.findById(id)` → `Promise<instance | null>`

```js
const user = await User.findById(1);      // instance or null
```

#### `User.findByIdOrFail(id)` → `Promise<instance>`

```js
const user = await User.findByIdOrFail(1); // throws NotFoundError if missing
```

---

#### `User.find(where?)` → `Promise<instance[]>`

```js
await User.find();                         // all records
await User.find({ role: 'admin' });        // matching records
```

#### `User.findOne(where?)` → `Promise<instance | null>`

```js
const user = await User.findOne({ email: 'john@example.com' });
```

#### `User.all()` → `Promise<instance[]>`

```js
const everyone = await User.all();
```

---

#### `User.update(id, changes)` → `Promise<instance>`

```js
const updated = await User.update(1, { name: 'Jane' });
```

Throws `NotFoundError` if the record doesn't exist.

#### `instance.save()` → `Promise<instance>`

```js
user.name = 'Jane';
await user.save();
```

---

#### `User.delete(id)` → `Promise<boolean>`

```js
await User.delete(1);   // true if deleted, false if not found
```

#### `instance.destroy()` → `Promise<boolean>`

```js
await user.destroy();
```

---

#### `User.count(where?)` → `Promise<number>`

```js
await User.count({ role: 'user' });
```

#### `User.bulkCreate(dataArray)` → `Promise<instance[]>`

```js
await User.bulkCreate([
  { name: 'A', email: 'a@example.com' },
  { name: 'B', email: 'b@example.com' },
]);
```

#### `User.findOrCreate(where, defaults?)` → `Promise<{ instance, created }>`

```js
const { instance, created } = await User.findOrCreate(
  { email: 'john@example.com' },
  { name: 'John' }
);
```

#### `User.truncate()` → `Promise<void>`

```js
await User.truncate();   // clears all records (useful in tests)
```

---

### Query Builder

`User.query()` returns a chainable `QueryBuilder`. Call `.get()` to execute.

```js
const users = await User.query()
  .where('role', '=', 'user')       // equality
  .where('age', '>', 18)            // comparison: =, !=, >, >=, <, <=
  .whereLike('name', 'ali')         // partial string match (case-insensitive)
  .where('role', 'in', ['user', 'admin'])  // in list
  .orderBy('age', 'desc')           // sorting
  .limit(10)                        // max results
  .offset(20)                       // skip N rows (pagination)
  .select('name', 'email')          // pick fields
  .get();                           // execute → Model[]
```

**Terminal methods**

| Method      | Returns              | Description                         |
|-------------|----------------------|-------------------------------------|
| `.get()`    | `Promise<Model[]>`   | Execute and return all matches      |
| `.first()`  | `Promise<Model\|null>` | Return first match                |
| `.count()`  | `Promise<number>`    | Count matches                       |
| `.exists()` | `Promise<boolean>`   | Check if any match exists           |

**Pagination example**

```js
const PAGE = 2, PER_PAGE = 10;

const users = await User.query()
  .orderBy('createdAt', 'asc')
  .offset((PAGE - 1) * PER_PAGE)
  .limit(PER_PAGE)
  .get();
```

---

### Relationships

Relationships are instance methods on every model. They run a query on the related model at call time — no lazy-loading magic, always explicit.

#### `hasMany(OtherModel, foreignKey)`

```js
const posts = await user.hasMany(Post, 'userId');
// → Post[] where post.userId === user.id
```

#### `belongsTo(OtherModel, foreignKey)`

```js
const author = await post.belongsTo(User, 'userId');
// → User where user.id === post.userId
```

#### `hasOne(OtherModel, foreignKey)`

```js
const profile = await user.hasOne(Profile, 'userId');
// → Profile | null
```

---

### Error Types

| Error                  | When thrown                                      |
|------------------------|--------------------------------------------------|
| `ValidationError`      | Missing required field, wrong type, enum/min/max |
| `UniqueConstraintError`| Duplicate value for a `unique: true` field       |
| `NotFoundError`        | `findByIdOrFail` or `update` on missing id       |
| `ORMError`             | Base class for all ORM errors                    |

```js
const { ValidationError, NotFoundError, UniqueConstraintError } = require('./orm');

try {
  await User.create({ email: 'x@x.com' }); // missing name
} catch (e) {
  if (e instanceof ValidationError) console.log('Bad data:', e.message);
}
```

---

### Custom Adapters

Swap the in-memory store for a real database by implementing the `MemoryAdapter` interface:

```js
class PostgresAdapter {
  nextId(tableName)             { /* return next sequence value */ }
  insert(tableName, row)        { /* INSERT ... RETURNING * */ }
  findAll(tableName)            { /* SELECT * FROM tableName */ }
  findById(tableName, id)       { /* SELECT * WHERE id = $1 */ }
  update(tableName, id, changes){ /* UPDATE ... WHERE id = $1 */ }
  delete(tableName, id)         { /* DELETE WHERE id = $1 */ }
  clear(tableName)              { /* DELETE FROM tableName */ }
}

const User = model('User', schema, { adapter: new PostgresAdapter() });
```

Each model can use a different adapter, so you can mix in-memory models (for tests) with real-DB models.

---

## Running the tests

```bash
node test.js
```

Expected output: `51 passed, 0 failed`

Tests cover: model definition · create · find · findById · findOne · update · delete · query builder operators · orderBy · limit · offset · select · count · exists · bulkCreate · findOrCreate · truncate · hasMany · belongsTo · hasOne · custom adapter isolation
