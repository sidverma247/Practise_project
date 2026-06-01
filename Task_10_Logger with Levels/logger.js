/**
 * Logger — core class
 */

import { LEVELS, LEVEL_NAMES, parseLevel } from './levels.js';
import { ConsoleTransport }                from './transports.js';

export class Logger {
  /**
   * @param {object} options
   * @param {string|number} [options.level='DEBUG']   - Minimum log level
   * @param {string}        [options.name]            - Logger name / namespace
   * @param {object}        [options.defaultMeta]     - Metadata merged into every entry
   * @param {Array}         [options.transports]      - Transport instances
   */
  constructor(options = {}) {
    this._level      = parseLevel(options.level ?? 'DEBUG');
    this.name        = options.name || null;
    this.defaultMeta = options.defaultMeta || {};
    this.transports  = options.transports ?? [new ConsoleTransport()];
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  setLevel(level) {
    this._level = parseLevel(level);
    return this;
  }

  getLevel() {
    return LEVEL_NAMES[this._level];
  }

  addTransport(transport) {
    this.transports.push(transport);
    return this;
  }

  removeTransport(transport) {
    this.transports = this.transports.filter(t => t !== transport);
    return this;
  }

  /**
   * Create a child logger that inherits transports but can have its own
   * name / level / defaultMeta (merged with parent's).
   */
  child(options = {}) {
    const merged = {
      level:       options.level ?? this.getLevel(),
      name:        options.name  ?? this.name,
      defaultMeta: { ...this.defaultMeta, ...(options.defaultMeta || {}) },
      transports:  this.transports,   // share parent transports
    };
    return new Logger(merged);
  }

  // ── Core log method ────────────────────────────────────────────────────────

  log(level, message, metadata = {}) {
    const numericLevel = parseLevel(level);
    if (numericLevel < this._level) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level:     LEVEL_NAMES[numericLevel],
      message:   String(message),
      metadata:  { ...this.defaultMeta, ...metadata },
      ...(this.name ? { name: this.name } : {}),
    };

    for (const transport of this.transports) {
      transport.log(entry);
    }

    return entry;  // handy for tests
  }

  // ── Convenience methods ────────────────────────────────────────────────────

  debug(message, metadata = {}) { return this.log('DEBUG', message, metadata); }
  info (message, metadata = {}) { return this.log('INFO',  message, metadata); }
  warn (message, metadata = {}) { return this.log('WARN',  message, metadata); }
  error(message, metadata = {}) { return this.log('ERROR', message, metadata); }
}
