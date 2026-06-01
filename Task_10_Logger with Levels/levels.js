/**
 * Log level definitions and utilities
 */

export const LEVELS = {
  DEBUG: 0,
  INFO:  1,
  WARN:  2,
  ERROR: 3,
  SILENT: 4,
};

export const LEVEL_NAMES = Object.fromEntries(
  Object.entries(LEVELS).map(([k, v]) => [v, k])
);

export function parseLevel(level) {
  if (typeof level === 'number') {
    if (LEVEL_NAMES[level] !== undefined) return level;
    throw new Error(`Unknown log level number: ${level}`);
  }
  const upper = String(level).toUpperCase();
  if (LEVELS[upper] !== undefined) return LEVELS[upper];
  throw new Error(`Unknown log level: "${level}". Valid levels: ${Object.keys(LEVELS).join(', ')}`);
}
