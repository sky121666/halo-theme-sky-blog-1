function emit(level, scope, ...args) {
  const logger = window.SkyDebug;
  if (!logger?.enabled?.()) return;
  logger[level]?.(scope, ...args);
}

export const skyDebug = Object.freeze({
  enabled() {
    return window.SkyDebug?.enabled?.() === true;
  },
  log(scope, ...args) {
    emit("log", scope, ...args);
  },
  warn(scope, ...args) {
    emit("warn", scope, ...args);
  },
  error(scope, ...args) {
    emit("error", scope, ...args);
  },
  event(scope, name, detail = {}) {
    emit("event", scope, name, detail);
  },
});
