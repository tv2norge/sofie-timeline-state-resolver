"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceWithState = exports.Device = exports.StatusCode = exports.literal = void 0;
const _ = require("underscore");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
Object.defineProperty(exports, "StatusCode", { enumerable: true, get: function () { return timeline_state_resolver_types_1.StatusCode; } });
const eventemitter3_1 = require("eventemitter3");
const lib_1 = require("../lib");
function literal(o) {
    return o;
}
exports.literal = literal;
/**
 * Base class for all Devices to inherit from. Defines the API that the conductor
 * class will use.
 */
class Device extends eventemitter3_1.EventEmitter {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super();
        this._currentTimeDiff = 0;
        this._currentTimeUpdated = 0;
        this.useDirectTime = false;
        this._reportAllCommands = false;
        this._isActive = true;
        this._deviceId = deviceId;
        this._deviceOptions = deviceOptions;
        this.debugLogging = deviceOptions.debug ?? true; // Default to true to keep backwards compatibility
        this.debugState = deviceOptions.debugState ?? false;
        this._instanceId = Math.floor(Math.random() * 10000);
        this._startTime = Date.now();
        this._reportAllCommands = !!deviceOptions.reportAllCommands;
        if (process.env.JEST_WORKER_ID !== undefined) {
            // running in Jest test environment.
            // Because Jest does a lot of funky stuff with the timing, we have to pull the time directly.
            this.useDirectTime = true;
            // Hack around the function mangling done by threadedClass
            const getCurrentTimeTmp = getCurrentTime;
            if (getCurrentTimeTmp && getCurrentTimeTmp.inner) {
                getCurrentTime = getCurrentTimeTmp.inner;
            }
        }
        if (getCurrentTime) {
            this._getCurrentTime = getCurrentTime;
        }
        this._updateCurrentTime();
    }
    async terminate() {
        return Promise.resolve(true);
    }
    getCurrentTime() {
        if (this.useDirectTime) {
            // Used when running in test
            // @ts-ignore
            return this._getCurrentTime();
        }
        if (Date.now() - this._currentTimeUpdated > 5 * 60 * 1000) {
            this._updateCurrentTime();
        }
        return Date.now() - this._currentTimeDiff;
    }
    /** To be called by children first in .handleState */
    onHandleState(_newState, mappings) {
        this.updateIsActive(mappings);
    }
    /**
     * The makeReady method could be triggered at a time before broadcast
     * Whenever we know that the user want's to make sure things are ready for broadcast
     * The exact implementation differ between different devices
     * @param okToDestroyStuff If true, the device may do things that might affect the output (temporarily)
     */
    async makeReady(_okToDestroyStuff, _activeRundownId) {
        // This method should be overwritten by child
        return Promise.resolve();
    }
    /**
     * The standDown event could be triggered at a time after broadcast
     * The exact implementation differ between different devices
     * @param okToDestroyStuff If true, the device may do things that might affect the output (temporarily)
     */
    async standDown(_okToDestroyStuff) {
        // This method should be overwritten by child
        return Promise.resolve();
    }
    setDebugLogging(debug) {
        this.debugLogging = debug;
    }
    emitDebug(...args) {
        if (this.debugLogging) {
            this.emit('debug', ...args);
        }
    }
    setDebugState(debug) {
        this.debugState = debug;
    }
    emitDebugState(state) {
        if (this.debugState) {
            this.emit('debugState', state);
        }
    }
    get deviceId() {
        return this._deviceId;
    }
    get deviceOptions() {
        return this._deviceOptions;
    }
    get supportsExpectedPlayoutItems() {
        return false;
    }
    handleExpectedPlayoutItems(_expectedPlayoutItems) {
        // When receiving a new list of playoutItems.
        // by default, do nothing
    }
    get isActive() {
        return this._isActive;
    }
    async executeAction(_actionId, _payload) {
        return {
            result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
            response: (0, lib_1.t)('Device does not implement an action handler'),
        };
    }
    _updateCurrentTime() {
        if (this._getCurrentTime) {
            const startTime = Date.now();
            Promise.resolve(this._getCurrentTime())
                .then((parentTime) => {
                const endTime = Date.now();
                const clientTime = Math.round((startTime + endTime) / 2);
                this._currentTimeDiff = clientTime - parentTime;
                this._currentTimeUpdated = endTime;
            })
                .catch((err) => {
                this.emit('error', 'device._updateCurrentTime', err);
            });
        }
    }
    get instanceId() {
        return this._instanceId;
    }
    get startTime() {
        return this._startTime;
    }
    handleDoOnTime(doOnTime, deviceType) {
        doOnTime.on('error', (e) => this.emit('error', `${deviceType}.doOnTime`, e));
        doOnTime.on('slowCommand', (msg) => this.emit('slowCommand', this.deviceName + ': ' + msg));
        doOnTime.on('slowSentCommand', (info) => this.emit('slowSentCommand', info));
        doOnTime.on('slowFulfilledCommand', (info) => this.emit('slowFulfilledCommand', info));
        doOnTime.on('commandReport', (commandReport) => {
            if (this._reportAllCommands) {
                this.emit('commandReport', commandReport);
            }
            this.emit('timeTrace', {
                measurement: 'device:commandSendDelay',
                tags: {
                    deviceId: this.deviceId,
                },
                start: commandReport.plannedSend,
                ended: commandReport.send,
                duration: commandReport.send - commandReport.plannedSend,
            });
            this.emit('timeTrace', {
                measurement: 'device:commandFulfillDelay',
                tags: {
                    deviceId: this.deviceId,
                },
                start: commandReport.send,
                ended: commandReport.fullfilled,
                duration: commandReport.fullfilled - commandReport.send,
            });
        });
    }
    updateIsActive(mappings) {
        // If there are no mappings assigned to this device, it is considered inactive
        const ownMappings = {};
        let isActive = false;
        _.each(mappings, (mapping, layerId) => {
            if (mapping.deviceId === this.deviceId) {
                isActive = true;
                ownMappings[layerId] = mapping;
            }
        });
        this._isActive = isActive;
    }
}
exports.Device = Device;
/**
 * Basic class that devices with state tracking can inherit from. Defines some
 * extra convenience methods for tracking state while inheriting all other methods
 * from the Device class.
 */
class DeviceWithState extends Device {
    constructor() {
        super(...arguments);
        this._states = {};
        this._setStateCount = 0;
    }
    /**
     * Get the last known state before a point time. Useful for creating device
     * diffs.
     * @param time
     */
    getStateBefore(time) {
        let foundTime = 0;
        let foundState = null;
        _.each(this._states, (state, stateTimeStr) => {
            const stateTime = parseFloat(stateTimeStr);
            if (stateTime > foundTime && stateTime < time) {
                foundState = state;
                foundTime = stateTime;
            }
        });
        if (foundState) {
            return {
                state: foundState,
                time: foundTime,
            };
        }
        return null;
    }
    /**
     * Get the last known state at a point in time. Useful for creating device
     * diffs.
     *
     * @todo is this literally the same as "getStateBefore(time + 1)"?
     *
     * @param time
     */
    getState(time) {
        if (time === undefined) {
            time = this.getCurrentTime();
        }
        let foundTime = 0;
        let foundState = null;
        _.each(this._states, (state, stateTimeStr) => {
            const stateTime = parseFloat(stateTimeStr);
            if (stateTime > foundTime && stateTime <= time) {
                foundState = state;
                foundTime = stateTime;
            }
        });
        if (foundState) {
            return {
                state: foundState,
                time: foundTime,
            };
        }
        return null;
    }
    /**
     * Saves a state on a certain time point. Overwrites any previous state
     * saved at the same time. Removes any state after this time point.
     * @param state
     * @param time
     */
    setState(state, time) {
        if (!time)
            throw new Error('setState: falsy time');
        this.cleanUpStates(0, time); // remove states after this time, as they are not relevant anymore
        this._states[time + ''] = state;
        this._setStateCount++;
        if (this._setStateCount > 10) {
            this._setStateCount = 0;
            // Clean up old states:
            const stateBeforeNow = this.getStateBefore(this.getCurrentTime());
            if (stateBeforeNow && stateBeforeNow.time) {
                this.cleanUpStates(stateBeforeNow.time - 1, 0);
            }
        }
    }
    /**
     * Sets a windows outside of which all states will be removed.
     * @param removeBeforeTime
     * @param removeAfterTime
     */
    cleanUpStates(removeBeforeTime, removeAfterTime) {
        _.each(_.keys(this._states), (stateTimeStr) => {
            const stateTime = parseFloat(stateTimeStr);
            if ((removeBeforeTime && stateTime <= removeBeforeTime) ||
                (removeAfterTime && stateTime >= removeAfterTime) ||
                !stateTime) {
                delete this._states[stateTime];
            }
        });
    }
    /**
     * Removes all states
     */
    clearStates() {
        _.each(_.keys(this._states), (time) => {
            delete this._states[time];
        });
    }
}
exports.DeviceWithState = DeviceWithState;
//# sourceMappingURL=device.js.map