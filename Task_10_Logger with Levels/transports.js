/**
 * Transports — destinations for log output.
 * Each transport receives a pre-formatted string and the raw entry.
 */

import fs   from 'fs';
import path from 'path';
import { prettyFormatter, jsonFormatter } from './formatters.js';
import { parseLevel, LEVELS } from './levels.js';

// ─────────────────────────────────────────────────────────────────────────────
// Base Transport
// ─────────────────────────────────────────────────────────────────────────────

export class BaseTransport {
  constructor(options = {}) {
    this.level     = options.level !== undefined ? parseLevel(options.level) : LEVELS.DEBUG;
    this.formatter = options.formatter || prettyFormatter;
    this.formatOptions = options.formatOptions || {};
  }

  /** Returns true when this transport should handle the entry */
  accepts(entry) {
    return LEVELS[entry.level] >= this.level;
  }

  format(entry) {
    return this.formatter(entry, this.formatOptions);
  }

  /** Override in subclasses */
  write(_formatted, _entry) {
    throw new Error('Transport.write() not implemented');
  }

  /** Called by Logger for each entry */
  log(entry) {
    if (!this.accepts(entry)) return;
    const formatted = this.format(entry);
    this.write(formatted, entry);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Console Transport
// ─────────────────────────────────────────────────────────────────────────────

export class ConsoleTransport extends BaseTransport {
  constructor(options = {}) {
    super({
      formatter: options.formatter || prettyFormatter,
      ...options,
    });

    // Map levels → console methods
    this._methods = {
      DEBUG: console.debug,
      INFO:  console.info,
      WARN:  console.warn,
      ERROR: console.error,
    };
  }

  write(formatted, entry) {
    const fn = this._methods[entry.level] || console.log;
    fn(formatted);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File Transport
// ─────────────────────────────────────────────────────────────────────────────

export class FileTransport extends BaseTransport {
  /**
   * @param {object} options
   * @param {string}  options.filename        - Path to log file
   * @param {boolean} [options.rotate=false]  - Enable daily rotation
   * @param {number}  [options.maxSize]       - Max file size in bytes before rotation
   * @param {number}  [options.maxFiles=7]    - Max rotated files to keep
   * @param {string}  [options.level]
   * @param {Function}[options.formatter]     - Defaults to JSON
   */
  constructor(options = {}) {
    if (!options.filename) throw new Error('FileTransport requires a "filename" option');

    super({
      formatter: options.formatter || jsonFormatter,
      ...options,
    });

    this.filename  = path.resolve(options.filename);
    this.rotate    = options.rotate    ?? false;
    this.maxSize   = options.maxSize   || null;
    this.maxFiles  = options.maxFiles  || 7;

    this._stream   = null;
    this._currentSize = 0;
    this._openStream();
  }

  _resolveFilename() {
    if (!this.rotate) return this.filename;
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const ext  = path.extname(this.filename);
    const base = this.filename.slice(0, -ext.length || undefined);
    return `${base}-${date}${ext}`;
  }

  _openStream() {
    const file = this._resolveFilename();
    const dir  = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this._stream = fs.createWriteStream(file, { flags: 'a', encoding: 'utf8' });
    this._stream.on('error', (err) => {
      console.error(`[FileTransport] Stream error for "${file}":`, err);
    });

    // Track current size for maxSize rotation
    try {
      this._currentSize = fs.statSync(file).size;
    } catch {
      this._currentSize = 0;
    }
  }

  _rotateBySizeIfNeeded(bytesAboutToWrite) {
    if (!this.maxSize || this._currentSize + bytesAboutToWrite <= this.maxSize) return;

    // Close current stream
    this._stream.end();

    // Rename existing file with timestamp suffix
    const ts  = Date.now();
    const ext = path.extname(this.filename);
    const base = this.filename.slice(0, -ext.length || undefined);
    const rotated = `${base}.${ts}${ext}`;
    try { fs.renameSync(this.filename, rotated); } catch { /* ignore */ }

    // Clean up old files beyond maxFiles
    this._cleanOldFiles(base, ext);

    // Re-open
    this._openStream();
  }

  _cleanOldFiles(base, ext) {
    const dir  = path.dirname(base);
    const name = path.basename(base);
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith(name) && f.endsWith(ext) && f !== path.basename(this.filename))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      files.slice(this.maxFiles - 1).forEach(f => {
        try { fs.unlinkSync(path.join(dir, f.name)); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
  }

  write(formatted, _entry) {
    const line  = formatted + '\n';
    const bytes = Buffer.byteLength(line, 'utf8');

    // Rotate BEFORE writing if adding this line would exceed maxSize
    // (only rotate when file already has content)
    if (this.maxSize && this._currentSize > 0 && this._currentSize + bytes > this.maxSize) {
      this._stream.end();
      const ext  = path.extname(this.filename);
      const base = this.filename.slice(0, -ext.length || undefined);
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      try { fs.renameSync(this.filename, `${base}.${suffix}${ext}`); } catch { /* ignore */ }
      this._cleanOldFiles(base, ext);
      this._openStream();
    }

    this._stream.write(line);
    this._currentSize += bytes;
  }

  /** Gracefully close the write stream */
  close() {
    return new Promise((resolve) => this._stream.end(resolve));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory Transport (useful for testing)
// ─────────────────────────────────────────────────────────────────────────────

export class MemoryTransport extends BaseTransport {
  constructor(options = {}) {
    super(options);
    this.entries = [];
    this.lines   = [];
  }

  write(formatted, entry) {
    this.entries.push(entry);
    this.lines.push(formatted);
  }

  clear() {
    this.entries = [];
    this.lines   = [];
  }
}
