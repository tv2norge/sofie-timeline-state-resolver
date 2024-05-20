"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Measurement = void 0;
class Measurement {
    constructor(scheduled) {
        this._commandExecutions = new Map();
        this._added = Date.now();
        this._scheduled = scheduled;
    }
    executeState() {
        this._stateExecution = Date.now();
        this._stateDelay = this._stateExecution - this._scheduled;
    }
    executeCommand(command) {
        this._commandExecutions.set(command, {
            args: JSON.stringify(command),
            executed: Date.now(),
            executeDelay: Date.now() - this._scheduled,
        });
    }
    finishedCommandExecution(command) {
        const execution = this._commandExecutions.get(command);
        if (execution) {
            this._commandExecutions.set(command, {
                ...execution,
                fulfilled: Date.now(),
                fulfilledDelay: Date.now() - execution.executed,
            });
        }
    }
    report() {
        return {
            added: this._added,
            prepareTime: this._scheduled - this._added,
            scheduled: this._scheduled,
            executed: this._stateExecution,
            executionDelay: this._stateDelay,
            commands: Array.from(this._commandExecutions.values()),
        };
    }
}
exports.Measurement = Measurement;
//# sourceMappingURL=measure.js.map