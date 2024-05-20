"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateHandler = void 0;
const lib_1 = require("../lib");
const measure_1 = require("./measure");
const CLOCK_INTERVAL = 20;
class StateHandler {
    constructor(context, config, device) {
        this.context = context;
        this.config = config;
        this.stateQueue = [];
        this._executingStateChange = false;
        this.logger = context.logger;
        this.convertTimelineStateToDeviceState = (s, m) => device.convertTimelineStateToDeviceState(s, m);
        this.diffDeviceStates = (o, n, m) => device.diffStates(o, n, m);
        this.executeCommand = async (c) => device.sendCommand(c);
        this.setCurrentState(undefined).catch((e) => {
            this.logger.error('Error while creating new StateHandler', e);
        });
        this.clock = setInterval(() => {
            context
                .getCurrentTime()
                .then((t) => {
                // main clock to check if next state needs to be sent out
                for (const state of this.stateQueue) {
                    const nextTime = Math.max(0, state?.state.time - t);
                    if (nextTime > CLOCK_INTERVAL)
                        break;
                    // schedule any states between now and the next tick
                    setTimeout(() => {
                        if (!this._executingStateChange && this.stateQueue[0] === state) {
                            // if this is the next state, execute it
                            this.executeNextStateChange().catch((e) => {
                                this.logger.error('Error while executing next state change', e);
                            });
                        }
                    }, nextTime);
                }
            })
                .catch((e) => {
                this.logger.error('Error in main StateHandler loop', e);
            });
        }, CLOCK_INTERVAL);
    }
    async terminate() {
        clearInterval(this.clock);
        this.stateQueue = [];
    }
    async clearFutureStates() {
        this.stateQueue = [];
    }
    async handleState(state, mappings) {
        const nextState = this.stateQueue[0];
        const trace = (0, lib_1.startTrace)('device:convertTimelineStateToDeviceState', { deviceId: this.context.deviceId });
        const deviceState = this.convertTimelineStateToDeviceState(state, mappings);
        this.context.emitTimeTrace((0, lib_1.endTrace)(trace));
        this.stateQueue = [
            ...this.stateQueue.filter((s) => s.state.time < state.time),
            {
                deviceState,
                state,
                mappings,
                measurement: new measure_1.Measurement(state.time),
            },
        ];
        if (nextState !== this.stateQueue[0]) {
            // the next state changed
            if (nextState)
                nextState.commands = undefined;
            this.calculateNextStateChange().catch((e) => {
                this.logger.error('Error while calculating next state change', e);
            });
        }
    }
    async setCurrentState(state) {
        this.currentState = {
            commands: [],
            deviceState: state,
            state: this.currentState?.state || { time: await this.context.getCurrentTime(), layers: {}, nextEvents: [] },
            mappings: this.currentState?.mappings || {},
        };
        await this.calculateNextStateChange();
    }
    clearFutureAfterTimestamp(t) {
        this.stateQueue = this.stateQueue.filter((s) => s.state.time <= t);
    }
    async calculateNextStateChange() {
        if (!this.currentState)
            return; // a change is currently being executed, we'll be called again once it's done
        const nextState = this.stateQueue[0];
        if (!nextState)
            return;
        try {
            const trace = (0, lib_1.startTrace)('device:diffDeviceStates', { deviceId: this.context.deviceId });
            nextState.commands = this.diffDeviceStates(this.currentState?.deviceState, nextState.deviceState, nextState.mappings);
            this.context.emitTimeTrace((0, lib_1.endTrace)(trace));
        }
        catch (e) {
            // todo - log an error
            this.logger.error('diffDeviceState failed, t = ' + nextState.state.time, e);
            // we don't want to get stuck, so we should act as if this can be executed anyway
            nextState.commands = [];
        }
        if (nextState.state.time <= (await this.context.getCurrentTime()) && this.currentState) {
            await this.executeNextStateChange();
        }
    }
    async executeNextStateChange() {
        if (!this.stateQueue[0] || this._executingStateChange) {
            // there is no next to execute - or we are currently executing something
            return;
        }
        this._executingStateChange = true;
        if (!this.stateQueue[0].commands) {
            await this.calculateNextStateChange();
        }
        const newState = this.stateQueue.shift();
        if (!newState || !newState.commands) {
            // this should not be possible given our previous guard?
            return;
        }
        newState.measurement?.executeState();
        this.currentState = undefined;
        if (this.config.executionType === 'salvo') {
            Promise.allSettled(newState.commands.map(async (command) => {
                newState.measurement?.executeCommand(command);
                return this.executeCommand(command).then(() => {
                    newState.measurement?.finishedCommandExecution(command);
                    return command;
                });
            }))
                .then(() => {
                if (newState.measurement)
                    this.context.reportStateChangeMeasurement(newState.measurement.report());
            })
                .catch((e) => {
                this.logger.error('Error while executing next state change', e);
            });
        }
        else {
            const execAll = async () => {
                for (const command of newState.commands || []) {
                    newState.measurement?.executeCommand(command);
                    await this.executeCommand(command).catch((e) => {
                        this.logger.error('Error while executing command', e);
                    });
                    newState.measurement?.finishedCommandExecution(command);
                }
            };
            execAll()
                .then(() => {
                if (newState.measurement)
                    this.context.reportStateChangeMeasurement(newState.measurement.report());
            })
                .catch((e) => {
                this.logger.error('Error while executing next state change', e);
            });
        }
        this.currentState = newState;
        this._executingStateChange = false;
        this.calculateNextStateChange().catch((e) => {
            this.logger.error('Error while executing next state change', e);
        });
    }
}
exports.StateHandler = StateHandler;
//# sourceMappingURL=stateHandler.js.map