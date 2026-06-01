/**
 * EventEmitter — publish/subscribe system
 * Supports: one-time listeners, wildcards, async handlers, error handling
 */
export default class EventEmitter {
  constructor() {
    this._listeners = new Map();
    this._errorHandler = null;
  }

  _getOrCreate(event) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    return this._listeners.get(event);
  }

  /**
   * Convert a wildcard pattern to a RegExp.
   * "**"     → matches any string (any depth)
   * "user.*" → matches "user.foo" but NOT "user.foo.bar"
   * "*.x"    → matches "foo.x" but NOT "foo.bar.x"
   */
  _patternToRegex(pattern) {
    // Split on ** first so we can handle it separately
    const parts = pattern.split('**');
    const regexStr = parts
      .map(part =>
        // Escape regex special chars, then replace single * with [^.]+ (non-dot segment)
        part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')
      )
      .join('.*'); // ** becomes .*
    return new RegExp(`^${regexStr}$`);
  }

  _matchingSets(emittedEvent) {
    const results = [];
    const seen = new Set();

    for (const [registeredEvent, listeners] of this._listeners.entries()) {
      if (seen.has(registeredEvent)) continue;

      let match = false;

      if (registeredEvent === emittedEvent) {
        match = true;
      } else if (registeredEvent.includes('*')) {
        match = this._patternToRegex(registeredEvent).test(emittedEvent);
      } else if (emittedEvent.includes('*')) {
        match = this._patternToRegex(emittedEvent).test(registeredEvent);
      }

      if (match) {
        seen.add(registeredEvent);
        results.push({ key: registeredEvent, listeners });
      }
    }
    return results;
  }

  on(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    this._getOrCreate(event).add({ handler, once: false });
    return this;
  }

  once(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    this._getOrCreate(event).add({ handler, once: true });
    return this;
  }

  off(event, handler) {
    const listeners = this._listeners.get(event);
    if (!listeners) return this;
    for (const entry of listeners) {
      if (entry.handler === handler) { listeners.delete(entry); break; }
    }
    if (listeners.size === 0) this._listeners.delete(event);
    return this;
  }

  async emit(event, ...args) {
    const matchingSets = this._matchingSets(event);
    const promises = [];

    for (const { key, listeners } of matchingSets) {
      const toRemove = [];
      for (const entry of listeners) {
        if (entry.once) toRemove.push(entry);
        promises.push(
          Promise.resolve()
            .then(() => entry.handler(...args))
            .catch(err => {
              if (this._errorHandler) this._errorHandler(err, event, entry.handler);
              else throw err;
            })
        );
      }
      for (const entry of toRemove) listeners.delete(entry);
      if (listeners.size === 0) this._listeners.delete(key);
    }

    await Promise.all(promises);
  }

  onError(handler) { this._errorHandler = handler; return this; }

  removeAllListeners(event) {
    event ? this._listeners.delete(event) : this._listeners.clear();
    return this;
  }

  listenerCount(event) { return this._listeners.get(event)?.size ?? 0; }
  eventNames() { return [...this._listeners.keys()]; }
}
