"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceInstanceWrapper = void 0;
const EventEmitter = require("eventemitter3");
const lib_1 = require("../lib");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const stateHandler_1 = require("./stateHandler");
const devices_1 = require("./devices");
/**
 * Top level container for setting up and interacting with any device integrations
 */
class DeviceInstanceWrapper extends EventEmitter {
    constructor(id, time, config, getCurrentTime) {
        super();
        this.config = config;
        this.getCurrentTime = getCurrentTime;
        this._isActive = false;
        this._logDebug = false;
        this._logDebugStates = false;
        const deviceSpecs = devices_1.DevicesDict[config.type];
        if (!deviceSpecs) {
            throw new Error('Could not find device of type ' + config.type);
        }
        this._device = new deviceSpecs.deviceClass();
        this._deviceId = id;
        this._deviceType = config.type;
        this._deviceName = deviceSpecs.deviceName(id, config);
        this._startTime = time;
        this._setupDeviceEventHandlers();
        this._stateHandler = new stateHandler_1.StateHandler({
            deviceId: id,
            logger: {
                debug: (...args) => this.emit('debug', ...args),
                info: (info) => this.emit('info', info),
                warn: (warn) => this.emit('warning', warn),
                error: (context, e) => this.emit('error', context, e),
            },
            emitTimeTrace: (trace) => this.emit('timeTrace', trace),
            reportStateChangeMeasurement: (report) => {
                report.commands.forEach((cReport) => {
                    if (cReport.executeDelay && cReport.executeDelay > (this.config.limitSlowSentCommand || 40)) {
                        this.emit('slowSentCommand', {
                            added: report.added,
                            prepareTime: 0,
                            plannedSend: report.scheduled,
                            send: report.executed || 0,
                            queueId: '',
                            args: cReport.args,
                            sendDelay: cReport.executeDelay,
                            addedDelay: 0,
                            internalDelay: 0,
                        });
                    }
                    if (cReport.fulfilledDelay && cReport.fulfilledDelay > (this.config.limitSlowFulfilledCommand || 100)) {
                        this.emit('slowFulfilledCommand', {
                            added: report.added,
                            prepareTime: 0,
                            plannedSend: report.scheduled,
                            send: report.executed || 0,
                            queueId: '',
                            args: cReport.args,
                            fullfilled: cReport.fulfilled || 0,
                            fulfilledDelay: cReport.fulfilledDelay,
                        });
                    }
                    this.emit('commandReport', {
                        plannedSend: report.scheduled,
                        queueId: '',
                        added: report.added,
                        prepareTime: 0,
                        send: cReport.executed,
                        fullfilled: cReport.fulfilled || 0,
                        args: cReport.args,
                    });
                });
            },
            getCurrentTime: this.getCurrentTime,
        }, {
            executionType: deviceSpecs.executionMode(config.options),
        }, this._device);
    }
    async initDevice(_activeRundownPlaylistId) {
        return this._device.init(this.config.options);
    }
    async terminate() {
        await this._stateHandler.terminate();
        return this._device.terminate();
    }
    async executeAction(id, payload) {
        const action = this._device.actions[id];
        if (!action) {
            return {
                result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                response: (0, lib_1.t)('Action "{{id}}" not found', { id }),
            };
        }
        return action(id, payload);
    }
    async makeReady(okToDestroyStuff) {
        if (this._device.makeReady) {
            return this._device.makeReady(okToDestroyStuff);
        }
    }
    async standDown() {
        if (this._device.standDown) {
            return this._device.standDown();
        }
    }
    /** @deprecated - just here for API compatiblity with the old class */
    prepareForHandleState() {
        //
    }
    handleState(newState, newMappings) {
        this._stateHandler.handleState(newState, newMappings).catch((e) => {
            this.emit('error', 'Error while handling state', e);
        });
        this._isActive = Object.keys(newMappings).length > 0;
    }
    clearFuture(t) {
        this._stateHandler.clearFutureAfterTimestamp(t);
    }
    getDetails() {
        return {
            deviceId: this._deviceId,
            deviceType: this._deviceType,
            deviceName: this._deviceName,
            instanceId: this._instanceId,
            startTime: this._startTime,
            supportsExpectedPlayoutItems: false,
            canConnect: devices_1.DevicesDict[this.config.type].canConnect,
        };
    }
    handleExpectedPlayoutItems(_expectedPlayoutItems) {
        // do nothing yet, as this isn't implemented.
    }
    getStatus() {
        return { ...this._device.getStatus(), active: this._isActive };
    }
    setDebugLogging(value) {
        this._logDebug = value;
    }
    setDebugState(value) {
        this._logDebugStates = value;
    }
    // @todo - should some of these be moved over to a context object?
    _setupDeviceEventHandlers() {
        this._device.on('info', (info) => {
            this.emit('info', info);
        });
        this._device.on('warning', (warning) => {
            this.emit('warning', warning);
        });
        this._device.on('error', (context, err) => {
            this.emit('error', context, err);
        });
        this._device.on('debug', (...debug) => {
            if (this._logDebug) {
                this.emit('debug', ...debug);
            }
        });
        this._device.on('debugState', (state) => {
            if (this._logDebugStates) {
                this.emit('debugState', state);
            }
        });
        /** The connection status has changed */
        this._device.on('connectionChanged', () => {
            this.emit('connectionChanged', this.getStatus());
        });
        /** A message to the resolver that something has happened that warrants a reset of the resolver (to re-run it again) */
        this._device.on('resetResolver', () => {
            this.emit('resetResolver');
        });
        /** Something went wrong when executing a command  */
        this._device.on('commandError', (error, context) => {
            this.emit('commandError', error, context);
        });
        /** Update a MediaObject  */
        this._device.on('updateMediaObject', (collectionId, docId, doc) => {
            this.emit('updateMediaObject', collectionId, docId, doc);
        });
        /** Clear a MediaObjects collection */
        this._device.on('clearMediaObjects', (collectionId) => {
            this.emit('clearMediaObjects', collectionId);
        });
        this._device.on('timeTrace', (trace) => {
            this.emit('timeTrace', trace);
        });
    }
}
exports.DeviceInstanceWrapper = DeviceInstanceWrapper;
//# sourceMappingURL=DeviceInstance.js.map