/**
 * @module logger
 * A lightweight, configurable logging library with multiple levels,
 * formatters, and transports.
 *
 * Quick start:
 *   import { createLogger } from './src/index.js';
 *   const logger = createLogger({ level: 'INFO' });
 *   logger.info('Hello world', { userId: 42 });
 */

export { Logger }                                     from './logger.js';
export { LEVELS, LEVEL_NAMES, parseLevel }            from './levels.js';
export { prettyFormatter, jsonFormatter, FORMATTERS } from './formatters.js';
export {
  BaseTransport,
  ConsoleTransport,
  FileTransport,
  MemoryTransport,
}                                                     from './transports.js';

import { Logger }           from './logger.js';
import { FORMATTERS }       from './formatters.js';
import { ConsoleTransport, FileTransport } from './transports.js';

/**
 * Factory helper — creates a Logger with sensible defaults.
 *
 * @param {object} [options]
 * @param {string} [options.level='INFO']
 * @param {'pretty'|'json'} [options.format='pretty']
 * @param {boolean} [options.colors=true]
 * @param {string}  [options.filename]        — if given, adds a FileTransport too
 * @param {boolean} [options.fileRotate=false]
 * @param {number}  [options.fileMaxSize]
 * @param {string}  [options.name]
 * @param {object}  [options.defaultMeta]
 * @returns {Logger}
 */
export function createLogger(options = {}) {
  const {
    level       = 'INFO',
    format      = 'pretty',
    colors      = true,
    filename,
    fileRotate  = false,
    fileMaxSize,
    name,
    defaultMeta,
  } = options;

  const fmt = FORMATTERS[format] ?? FORMATTERS.pretty;

  const transports = [
    new ConsoleTransport({
      formatter: fmt,
      formatOptions: { colors },
    }),
  ];

  if (filename) {
    transports.push(new FileTransport({
      filename,
      rotate:  fileRotate,
      maxSize: fileMaxSize,
    }));
  }

  return new Logger({ level, name, defaultMeta, transports });
}
