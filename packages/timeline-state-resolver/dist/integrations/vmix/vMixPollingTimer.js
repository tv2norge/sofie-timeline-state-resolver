"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMixPollingTimer = void 0;
const eventemitter3_1 = require("eventemitter3");
/**
 * A timer that once started, ticks in intevals
 * Allows the next tick to be postponed
 */
class VMixPollingTimer extends eventemitter3_1.EventEmitter {
    constructor(pollIntervalMs) {
        super();
        this.pollIntervalMs = pollIntervalMs;
        this.pollTimeout = null;
        if (pollIntervalMs <= 0)
            throw Error('Poll interval needs to be > 0');
    }
    start() {
        this.clearTimeout();
        this.pollTimeout = setTimeout(() => this.tick(), this.pollIntervalMs);
    }
    /**
     * Pauses ticking until `temporaryTimeoutMs` passes
     * @param temporaryTimeoutMs Time the next tick will execute after
     */
    postponeNextTick(temporaryTimeoutMs) {
        this.clearTimeout();
        this.pollTimeout = setTimeout(() => this.tick(), temporaryTimeoutMs);
    }
    stop() {
        this.clearTimeout();
    }
    clearTimeout() {
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = null;
        }
    }
    tick() {
        this.emit('tick');
        this.start();
    }
}
exports.VMixPollingTimer = VMixPollingTimer;
//# sourceMappingURL=vMixPollingTimer.js.map