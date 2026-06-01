/**
 * Output formatters for log entries
 */

const LEVEL_COLORS = {
  DEBUG: '\x1b[36m',  // Cyan
  INFO:  '\x1b[32m',  // Green
  WARN:  '\x1b[33m',  // Yellow
  ERROR: '\x1b[31m',  // Red
};
const RESET = '\x1b[0m';
const DIM   = '\x1b[2m';
const BOLD  = '\x1b[1m';

/**
 * Pretty-print formatter — human-readable with optional colors.
 * @param {object} entry
 * @param {object} options
 * @param {boolean} [options.colors=true]
 */
export function prettyFormatter(entry, options = {}) {
  const { colors = true } = options;

  const ts    = entry.timestamp;
  const level = entry.level.padEnd(5);
  const msg   = entry.message;
  const meta  = entry.metadata;

  if (!colors) {
    let line = `[${ts}] [${level}] ${msg}`;
    if (meta && Object.keys(meta).length > 0) {
      line += `\n  ${JSON.stringify(meta, null, 2).split('\n').join('\n  ')}`;
    }
    return line;
  }

  const color = LEVEL_COLORS[entry.level] || '';
  let line = `${DIM}[${ts}]${RESET} ${color}${BOLD}[${level}]${RESET} ${msg}`;

  if (meta && Object.keys(meta).length > 0) {
    const metaStr = JSON.stringify(meta, null, 2)
      .split('\n')
      .map((l, i) => (i === 0 ? l : `  ${l}`))
      .join('\n');
    line += ` ${DIM}${metaStr}${RESET}`;
  }

  return line;
}

/**
 * JSON formatter — machine-readable, one line per entry.
 * @param {object} entry
 */
export function jsonFormatter(entry) {
  return JSON.stringify(entry);
}

export const FORMATTERS = {
  pretty: prettyFormatter,
  json:   jsonFormatter,
};
