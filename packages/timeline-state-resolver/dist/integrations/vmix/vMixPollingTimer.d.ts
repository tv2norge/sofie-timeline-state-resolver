import { EventEmitter } from 'eventemitter3';
export type TimerEvents = {
    tick: [];
};
/**
 * A timer that once started, ticks in intevals
 * Allows the next tick to be postponed
 */
export declare class VMixPollingTimer extends EventEmitter<TimerEvents> {
    private readonly pollIntervalMs;
    private pollTimeout;
    constructor(pollIntervalMs: number);
    start(): void;
    /**
     * Pauses ticking until `temporaryTimeoutMs` passes
     * @param temporaryTimeoutMs Time the next tick will execute after
     */
    postponeNextTick(temporaryTimeoutMs: number): void;
    stop(): void;
    private clearTimeout;
    private tick;
}
//# sourceMappingURL=vMixPollingTimer.d.ts.map