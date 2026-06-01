'use strict';

const ConfigManager = require('./ConfigManager');

/**
 * Factory helper – creates a pre-configured ConfigManager instance.
 *
 * @param {object} [options] – forwarded to ConfigManager constructor
 * @returns {ConfigManager}
 */
function createConfig(options = {}) {
  return new ConfigManager(options);
}

module.exports = { ConfigManager, createConfig };
