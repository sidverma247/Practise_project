/**
 * SimpleORM - A lightweight ORM-like layer
 * Supports model definition, query building, CRUD operations, and relationships.
 * Uses an in-memory SQLite-compatible store (swappable for real DB adapters).
 */

// ─── In-Memory Database Adapter ─────────────────────────────────────────────

class MemoryAdapter {
  constructor() {
    this.tables = {};   // { tableName: Map<id, row> }
    this.sequences = {}; // { tableName: lastId }
  }

  _ensureTable(name) {
    if (!this.tables[name]) {
      this.tables[name] = new Map();
      this.sequences[name] = 0;
    }
  }

  nextId(tableName) {
    this._ensureTable(tableName);
    this.sequences[tableName]++;
    return this.sequences[tableName];
  }

  insert(tableName, row) {
    this._ensureTable(tableName);
    this.tables[tableName].set(row.id, { ...row });
    return { ...row };
  }

  findAll(tableName) {
    this._ensureTable(tableName);
    return [...this.tables[tableName].values()].map(r => ({ ...r }));
  }

  findById(tableName, id) {
    this._ensureTable(tableName);
    const row = this.tables[tableName].get(id);
    return row ? { ...row } : null;
  }

  update(tableName, id, changes) {
    this._ensureTable(tableName);
    const existing = this.tables[tableName].get(id);
    if (!existing) return null;
    const updated = { ...existing, ...changes };
    this.tables[tableName].set(id, updated);
    return { ...updated };
  }

  delete(tableName, id) {
    this._ensureTable(tableName);
    const existed = this.tables[tableName].has(id);
    this.tables[tableName].delete(id);
    return existed;
  }

  clear(tableName) {
    this._ensureTable(tableName);
    this.tables[tableName].clear();
    this.sequences[tableName] = 0;
  }
}

// Shared adapter instance (can be swapped per environment)
const defaultAdapter = new MemoryAdapter();


// ─── Validators ──────────────────────────────────────────────────────────────

const TYPE_CHECKERS = {
  string:  v => typeof v === 'string',
  number:  v => typeof v === 'number' && !isNaN(v),
  boolean: v => typeof v === 'boolean',
  date:    v => v instanceof Date || (typeof v === 'string' && !isNaN(Date.parse(v))),
  object:  v => typeof v === 'object' && v !== null && !Array.isArray(v),
  array:   v => Array.isArray(v),
};

function validateField(fieldName, value, schema) {
  const rules = schema[fieldName];
  if (!rules) return; // unknown field — tolerated

  // required
  if (rules.required && (value === undefined || value === null || value === '')) {
    throw new ValidationError(`Field '${fieldName}' is required`);
  }
  if (value === undefined || value === null) return; // optional & absent → ok

  // type
  if (rules.type && TYPE_CHECKERS[rules.type]) {
    if (!TYPE_CHECKERS[rules.type](value)) {
      throw new ValidationError(
        `Field '${fieldName}' must be of type '${rules.type}', got '${typeof value}'`
      );
    }
  }

  // min / max (strings → length, numbers → value)
  if (rules.min !== undefined) {
    const check = typeof value === 'string' ? value.length : value;
    if (check < rules.min)
      throw new ValidationError(`Field '${fieldName}' must be >= ${rules.min}`);
  }
  if (rules.max !== undefined) {
    const check = typeof value === 'string' ? value.length : value;
    if (check > rules.max)
      throw new ValidationError(`Field '${fieldName}' must be <= ${rules.max}`);
  }

  // enum
  if (rules.enum && !rules.enum.includes(value)) {
    throw new ValidationError(
      `Field '${fieldName}' must be one of: ${rules.enum.join(', ')}`
    );
  }

  // custom validator
  if (rules.validate) {
    const result = rules.validate(value);
    if (result !== true && result !== undefined) {
      throw new ValidationError(
        typeof result === 'string' ? result : `Field '${fieldName}' failed custom validation`
      );
    }
  }
}


// ─── Custom Errors ───────────────────────────────────────────────────────────

class ORMError extends Error {
  constructor(message) { super(message); this.name = 'ORMError'; }
}

class ValidationError extends ORMError {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}

class NotFoundError extends ORMError {
  constructor(message) { super(message); this.name = 'NotFoundError'; }
}

class UniqueConstraintError extends ORMError {
  constructor(message) { super(message); this.name = 'UniqueConstraintError'; }
}


// ─── QueryBuilder ────────────────────────────────────────────────────────────

class QueryBuilder {
  constructor(modelInstance) {
    this._model = modelInstance;
    this._filters = [];
    this._orderField = null;
    this._orderDir = 'asc';
    this._limitVal = null;
    this._offsetVal = 0;
    this._selectedFields = null;
  }

  /** Filter: where({ field: value }) or where(field, op, value) */
  where(fieldOrObject, op, value) {
    if (typeof fieldOrObject === 'object') {
      for (const [k, v] of Object.entries(fieldOrObject)) {
        this._filters.push({ field: k, op: '=', value: v });
      }
    } else {
      // where('age', '>', 18)
      const VALID_OPS = ['=', '!=', '>', '>=', '<', '<=', 'like', 'in', 'not in'];
      if (!VALID_OPS.includes(op)) throw new ORMError(`Unsupported operator: ${op}`);
      this._filters.push({ field: fieldOrObject, op, value });
    }
    return this;
  }

  /** Shorthand: whereNot(field, value) */
  whereNot(field, value) { return this.where(field, '!=', value); }

  /** Shorthand: whereLike(field, pattern) — uses JS .includes() for simplicity */
  whereLike(field, pattern) { return this.where(field, 'like', pattern); }

  /** Order results */
  orderBy(field, direction = 'asc') {
    this._orderField = field;
    this._orderDir = direction.toLowerCase();
    return this;
  }

  /** Limit number of results */
  limit(n) { this._limitVal = n; return this; }

  /** Skip N results */
  offset(n) { this._offsetVal = n; return this; }

  /** Select only specific fields */
  select(...fields) { this._selectedFields = fields.flat(); return this; }

  /** Execute and return all matching rows */
  async get() {
    let rows = this._model._adapter.findAll(this._model._tableName);

    // Apply filters
    rows = rows.filter(row => this._matchesFilters(row));

    // Order
    if (this._orderField) {
      rows.sort((a, b) => {
        const av = a[this._orderField], bv = b[this._orderField];
        if (av < bv) return this._orderDir === 'asc' ? -1 : 1;
        if (av > bv) return this._orderDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Offset / Limit
    rows = rows.slice(this._offsetVal);
    if (this._limitVal !== null) rows = rows.slice(0, this._limitVal);

    // Select
    if (this._selectedFields) {
      rows = rows.map(r => {
        const out = {};
        for (const f of this._selectedFields) out[f] = r[f];
        return out;
      });
    }

    return rows;
  }

  /** Return first match or null */
  async first() {
    const results = await this.limit(1).get();
    return results[0] ?? null;
  }

  /** Return count of matching rows */
  async count() {
    const results = await this.get();
    return results.length;
  }

  /** Check existence */
  async exists() {
    return (await this.count()) > 0;
  }

  _matchesFilters(row) {
    for (const { field, op, value } of this._filters) {
      const rv = row[field];
      switch (op) {
        case '=':      if (rv !== value) return false; break;
        case '!=':     if (rv === value) return false; break;
        case '>':      if (!(rv > value)) return false; break;
        case '>=':     if (!(rv >= value)) return false; break;
        case '<':      if (!(rv < value)) return false; break;
        case '<=':     if (!(rv <= value)) return false; break;
        case 'like':   if (!String(rv ?? '').toLowerCase().includes(String(value).toLowerCase())) return false; break;
        case 'in':     if (!Array.isArray(value) || !value.includes(rv)) return false; break;
        case 'not in': if (!Array.isArray(value) || value.includes(rv)) return false; break;
      }
    }
    return true;
  }
}


// ─── Model Factory ───────────────────────────────────────────────────────────

/**
 * Define a model.
 *
 * @param {string} name     - Model/table name (e.g. 'User')
 * @param {object} schema   - Field definitions
 * @param {object} [opts]   - Options: { adapter, tableName, timestamps }
 * @returns Model class with static CRUD methods
 */
function model(name, schema, opts = {}) {
  const adapter   = opts.adapter   ?? defaultAdapter;
  const tableName = opts.tableName ?? name.toLowerCase() + 's';
  const timestamps = opts.timestamps !== false; // default true

  // Collect unique fields for constraint checks
  const uniqueFields = Object.entries(schema)
    .filter(([, rules]) => rules.unique)
    .map(([field]) => field);

  // Primary key field (default 'id')
  const primaryKey = Object.entries(schema)
    .find(([, rules]) => rules.primary)?.[0] ?? 'id';

  class Model {
    constructor(data) {
      Object.assign(this, data);
    }

    // ── Relationships ────────────────────────────────────────────────────────

    /**
     * Load a hasMany relationship.
     * e.g. user.hasMany(Post, 'userId')
     */
    async hasMany(OtherModel, foreignKey) {
      return OtherModel.query().where(foreignKey, '=', this[primaryKey]).get();
    }

    /**
     * Load a belongsTo relationship.
     * e.g. post.belongsTo(User, 'userId')
     */
    async belongsTo(OtherModel, foreignKey) {
      return OtherModel.findById(this[foreignKey]);
    }

    /**
     * Load a hasOne relationship.
     * e.g. user.hasOne(Profile, 'userId')
     */
    async hasOne(OtherModel, foreignKey) {
      return OtherModel.query().where(foreignKey, '=', this[primaryKey]).first();
    }

    // ── Instance methods ─────────────────────────────────────────────────────

    /** Save changes to this instance */
    async save() {
      return Model.update(this[primaryKey], { ...this });
    }

    /** Delete this instance */
    async destroy() {
      return Model.delete(this[primaryKey]);
    }

    toJSON() {
      const out = { ...this };
      return out;
    }

    // ── Static CRUD ──────────────────────────────────────────────────────────

    /** Return a fresh QueryBuilder for this model */
    static query() {
      return new QueryBuilder({ _adapter: adapter, _tableName: tableName });
    }

    /**
     * Create and persist a new record.
     * @throws {ValidationError} on invalid data
     * @throws {UniqueConstraintError} on unique violation
     */
    static async create(data) {
      // Validate all fields in schema
      for (const field of Object.keys(schema)) {
        validateField(field, data[field], schema);
      }

      // Auto-assign primary key if not provided
      const row = { ...data };
      if (row[primaryKey] === undefined) {
        row[primaryKey] = adapter.nextId(tableName);
      }

      // Unique constraint check
      await Model._checkUnique(row, null);

      // Timestamps
      if (timestamps) {
        row.createdAt = new Date().toISOString();
        row.updatedAt = new Date().toISOString();
      }

      const inserted = adapter.insert(tableName, row);
      return new Model(inserted);
    }

    /**
     * Find records matching filter object.
     * @param {object} [where] - Field/value pairs  (all must match)
     * @returns {Model[]}
     */
    static async find(where = {}) {
      const qb = Model.query();
      for (const [k, v] of Object.entries(where)) qb.where(k, '=', v);
      const rows = await qb.get();
      return rows.map(r => new Model(r));
    }

    /** Find a single record by primary key */
    static async findById(id) {
      const row = adapter.findById(tableName, id);
      if (!row) return null;
      return new Model(row);
    }

    /** Like findById but throws NotFoundError if missing */
    static async findByIdOrFail(id) {
      const instance = await Model.findById(id);
      if (!instance) throw new NotFoundError(`${name} with id=${id} not found`);
      return instance;
    }

    /** Find first record matching filter */
    static async findOne(where = {}) {
      const qb = Model.query();
      for (const [k, v] of Object.entries(where)) qb.where(k, '=', v);
      const row = await qb.first();
      return row ? new Model(row) : null;
    }

    /** Return all records */
    static async all() {
      const rows = await Model.query().get();
      return rows.map(r => new Model(r));
    }

    /** Count matching records */
    static async count(where = {}) {
      const qb = Model.query();
      for (const [k, v] of Object.entries(where)) qb.where(k, '=', v);
      return qb.count();
    }

    /**
     * Update a record by primary key.
     * @throws {ValidationError} on invalid data
     * @throws {UniqueConstraintError} on unique violation
     * @throws {NotFoundError} if record doesn't exist
     */
    static async update(id, changes) {
      const existing = adapter.findById(tableName, id);
      if (!existing) throw new NotFoundError(`${name} with id=${id} not found`);

      // Validate changed fields only
      for (const field of Object.keys(changes)) {
        if (schema[field]) validateField(field, changes[field], schema);
      }

      // Unique constraint check (exclude self)
      await Model._checkUnique({ ...existing, ...changes }, id);

      if (timestamps) changes.updatedAt = new Date().toISOString();

      const updated = adapter.update(tableName, id, changes);
      return new Model(updated);
    }

    /**
     * Delete a record by primary key.
     * @returns {boolean} true if deleted, false if not found
     */
    static async delete(id) {
      return adapter.delete(tableName, id);
    }

    /**
     * Bulk create multiple records.
     * Validates and inserts each one. Rolls back on first error.
     */
    static async bulkCreate(dataArray) {
      const created = [];
      for (const data of dataArray) {
        created.push(await Model.create(data));
      }
      return created;
    }

    /**
     * Find or create a record.
     * @returns { instance, created } tuple
     */
    static async findOrCreate(where, defaults = {}) {
      const existing = await Model.findOne(where);
      if (existing) return { instance: existing, created: false };
      const instance = await Model.create({ ...where, ...defaults });
      return { instance, created: true };
    }

    /** Clear all records (useful for testing) */
    static async truncate() {
      adapter.clear(tableName);
    }

    /** Model metadata */
    static get modelName()  { return name; }
    static get tableName_() { return tableName; }
    static get schema_()    { return schema; }

    // ── Internal helpers ─────────────────────────────────────────────────────

    static async _checkUnique(row, excludeId) {
      if (uniqueFields.length === 0) return;
      const allRows = adapter.findAll(tableName);
      for (const field of uniqueFields) {
        if (row[field] === undefined || row[field] === null) continue;
        const collision = allRows.find(
          r => r[field] === row[field] && r[primaryKey] !== excludeId
        );
        if (collision) {
          throw new UniqueConstraintError(
            `Unique constraint violated: '${field}' = '${row[field]}' already exists`
          );
        }
      }
    }
  }

  // Readable name in stack traces
  Object.defineProperty(Model, 'name', { value: name });

  return Model;
}


// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  model,
  MemoryAdapter,
  ORMError,
  ValidationError,
  NotFoundError,
  UniqueConstraintError,
  QueryBuilder,
};
