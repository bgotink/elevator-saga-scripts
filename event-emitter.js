import * as log from './log';

const kListeners = Symbol('listeners');

function hasListeners(eventEmitter, event) {
  return !!eventEmitter[kListeners][event];
}

function getListeners(eventEmitter, event) {
  if (!hasListeners(eventEmitter, event)) {
    eventEmitter[kListeners][event] = [];
  }

  return eventEmitter[kListeners][event];
}

export default class EventEmitter {
  constructor() {
    this[kListeners] = {};
  }

  on(event, listener) {
    getListeners(this, event).push(listener);
  }

  off(event, listener) {
    if (!hasListeners(this, event)) {
      return;
    }

    const listeners = getListeners(this, event);
    const idx = listeners.indexOf(listener);

    if (idx !== -1) {
      listeners.splice(idx, 1);
    }
  }

  fire(event, ...args) {
    if (!hasListeners(this, event)) {
      return;
    }

    getListeners(this, event).forEach(listener => {
      try {
        listener(...args);
      } catch (e) {
        this.handleError(event, e);
      }
    });
  }

  handleError(event, e) {
    log.error `Error while firing ${event}: ${e && e.stack ? e.stack : e}`;
  }
}
