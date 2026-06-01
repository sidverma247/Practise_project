'use strict';

const fs = require('fs');
const path = require('path');

/**
 * ConfigManager — A robust JSON configuration manager.
 *
 * Features:
 *  - Nested key access via dot-notation  (e.g. 'database.host')
 *  - Environment-variable interpolation  (e.g. "${DB_HOST}")
 *  - JSON-Schema-style validation
 *  - Immutable snapshots / rollback
 */
class ConfigManager {
  /**
   * @param {object} [options]
   * @param {object} [options.env]            – env source (defaults to process.env)
   * @param {boolean} [options.interpolate]   – enable env interpolation (default true)
   * @param {boolean} [options.strict]        – throw on missing env vars (default false)
   */
  constructor(options = {}) {
    this._data     = {};
    this._snapshots = [];
    this._env       = options.env        ?? process.env;
    this._interpolate = options.interpolate !== false;   // default true
    this._strict    = options.strict     ?? false;
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  /**
   * Load configuration from a JSON file.
   * @param {string} filePath – absolute or relative path to a .json file
   * @param {object} [opts]
   * @param {boolean} [opts.merge] – merge into existing config instead of replacing
   * @returns {ConfigManager} this (for chaining)
   */
  load(filePath, { merge = false } = {}) {
    const resolved = path.resolve(filePath);

    if (!fs.existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }

    let raw;
    try {
      raw = fs.readFileSync(resolved, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read config file "${resolved}": ${err.message}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON in "${resolved}": ${err.message}`);
    }

    if (merge) {
      this._data = this._deepMerge(this._data, parsed);
    } else {
      this._data = parsed;
    }

    return this;
  }

  /**
   * Load configuration from a plain object (useful for testing / programmatic use).
   * @param {object} obj
   * @param {object} [opts]
   * @param {boolean} [opts.merge]
   * @returns {ConfigManager} this
   */
  loadObject(obj, { merge = false } = {}) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new TypeError('loadObject expects a plain object');
    }
    if (merge) {
      this._data = this._deepMerge(this._data, obj);
    } else {
      this._data = this._deepClone(obj);
    }
    return this;
  }

  // ─── Get / Set / Delete ─────────────────────────────────────────────────────

  /**
   * Retrieve a value by dot-notation key.
   * Environment-variable placeholders are interpolated before returning.
   *
   * @param {string} keyPath   – e.g. 'database.host'
   * @param {*}      [def]     – default value when key is missing
   * @returns {*}
   */
  get(keyPath, def) {
    const value = this._getByPath(this._data, this._parsePath(keyPath));

    if (value === undefined) return def;

    // Interpolate strings (and recurse into objects/arrays)
    return this._interpolate ? this._interpolateValue(value) : value;
  }

  /**
   * Set a value at the given dot-notation key path.
   * Intermediate objects are created automatically.
   *
   * @param {string} keyPath
   * @param {*}      value
   * @returns {ConfigManager} this
   */
  set(keyPath, value) {
    this._setByPath(this._data, this._parsePath(keyPath), value);
    return this;
  }

  /**
   * Delete a key (and its subtree) from the configuration.
   * @param {string} keyPath
   * @returns {boolean} true if key existed and was removed
   */
  delete(keyPath) {
    const parts = this._parsePath(keyPath);
    const parent = this._getByPath(this._data, parts.slice(0, -1));
    const last   = parts[parts.length - 1];

    if (parent && typeof parent === 'object' && last in parent) {
      delete parent[last];
      return true;
    }
    return false;
  }

  /**
   * Returns true if the key exists (even if its value is null/undefined).
   * @param {string} keyPath
   */
  has(keyPath) {
    const parts  = this._parsePath(keyPath);
    const parent = this._getByPath(this._data, parts.slice(0, -1));
    return parent !== undefined && typeof parent === 'object' &&
           parts[parts.length - 1] in parent;
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validate the current config against a simple JSON-Schema-style schema.
   *
   * Supported schema keywords:
   *   type, required, properties, additionalProperties,
   *   minimum, maximum, minLength, maxLength, pattern, enum
   *
   * @param {object} schema
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(schema) {
    const errors = [];
    this._validateNode(this._data, schema, '', errors);
    return { valid: errors.length === 0, errors };
  }

  // ─── Snapshots ──────────────────────────────────────────────────────────────

  /** Save a snapshot of the current configuration. */
  snapshot() {
    this._snapshots.push(this._deepClone(this._data));
    return this;
  }

  /** Roll back to the most recent snapshot. */
  rollback() {
    if (this._snapshots.length === 0) {
      throw new Error('No snapshot available to roll back to');
    }
    this._data = this._snapshots.pop();
    return this;
  }

  // ─── Serialisation ──────────────────────────────────────────────────────────

  /** Return the raw config object (no interpolation). */
  toObject() {
    return this._deepClone(this._data);
  }

  /** Return pretty-printed JSON of the raw config. */
  toJSON(space = 2) {
    return JSON.stringify(this._data, null, space);
  }

  /**
   * Write the current config to a file.
   * @param {string} filePath
   */
  save(filePath) {
    fs.writeFileSync(path.resolve(filePath), this.toJSON(), 'utf8');
    return this;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  _parsePath(keyPath) {
    if (typeof keyPath !== 'string' || keyPath.trim() === '') {
      throw new TypeError('keyPath must be a non-empty string');
    }
    return keyPath.split('.');
  }

  _getByPath(obj, parts) {
    let cur = obj;
    for (const part of parts) {
      if (cur === undefined || cur === null || typeof cur !== 'object') return undefined;
      cur = cur[part];
    }
    return cur;
  }

  _setByPath(obj, parts, value) {
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (cur[part] === undefined || typeof cur[part] !== 'object') {
        cur[part] = {};
      }
      cur = cur[part];
    }
    cur[parts[parts.length - 1]] = value;
  }

  _interpolateValue(value) {
    if (typeof value === 'string') return this._interpolateString(value);
    if (Array.isArray(value))     return value.map(v => this._interpolateValue(v));
    if (value && typeof value === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this._interpolateValue(v);
      }
      return result;
    }
    return value;
  }

  _interpolateString(str) {
    return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const envValue = this._env[varName];
      if (envValue !== undefined) return envValue;
      if (this._strict) throw new Error(`Environment variable "${varName}" is not defined`);
      return match; // leave placeholder intact when not strict
    });
  }

  _validateNode(value, schema, path, errors) {
    if (!schema || typeof schema !== 'object') return;

    const label = path || 'root';

    // type
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some(t => this._checkType(value, t))) {
        errors.push(`"${label}": expected type ${types.join('|')}, got ${this._typeOf(value)}`);
        return; // no point checking sub-rules on wrong type
      }
    }

    // enum
    if (schema.enum) {
      if (!schema.enum.includes(value)) {
        errors.push(`"${label}": enum violation — value must be one of [${schema.enum.join(', ')}]`);
      }
    }

    // string keywords
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`"${label}": length ${value.length} is below minLength ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`"${label}": length ${value.length} exceeds maxLength ${schema.maxLength}`);
      }
      if (schema.pattern) {
        const re = new RegExp(schema.pattern);
        if (!re.test(value)) {
          errors.push(`"${label}": value does not match pattern /${schema.pattern}/`);
        }
      }
    }

    // number keywords
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`"${label}": ${value} is below minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`"${label}": ${value} exceeds maximum ${schema.maximum}`);
      }
    }

    // object keywords
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // required
      if (Array.isArray(schema.required)) {
        for (const key of schema.required) {
          if (!(key in value)) {
            errors.push(`"${label}": missing required property "${key}"`);
          }
        }
      }
      // properties
      if (schema.properties) {
        for (const [key, subSchema] of Object.entries(schema.properties)) {
          if (key in value) {
            this._validateNode(value[key], subSchema, path ? `${path}.${key}` : key, errors);
          }
        }
      }
      // additionalProperties
      if (schema.additionalProperties === false && schema.properties) {
        const allowed = new Set(Object.keys(schema.properties));
        for (const key of Object.keys(value)) {
          if (!allowed.has(key)) {
            errors.push(`"${label}": additional property "${key}" is not allowed`);
          }
        }
      }
    }

    // array keywords
    if (Array.isArray(value) && schema.items) {
      value.forEach((item, i) => {
        this._validateNode(item, schema.items, `${label}[${i}]`, errors);
      });
    }
  }

  _checkType(value, type) {
    switch (type) {
      case 'string':  return typeof value === 'string';
      case 'number':  return typeof value === 'number' && !Number.isNaN(value);
      case 'integer': return Number.isInteger(value);
      case 'boolean': return typeof value === 'boolean';
      case 'array':   return Array.isArray(value);
      case 'object':  return value !== null && typeof value === 'object' && !Array.isArray(value);
      case 'null':    return value === null;
      default:        return true;
    }
  }

  _typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  _deepMerge(target, source) {
    const output = Object.assign({}, target);
    for (const key of Object.keys(source)) {
      if (
        source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
        target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
      ) {
        output[key] = this._deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }
}

module.exports = ConfigManager;
