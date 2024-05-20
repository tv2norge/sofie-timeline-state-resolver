"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriCasterDevice = void 0;
const _ = require("underscore");
const device_1 = require("./../../devices/device");
const doOnTime_1 = require("../../devices/doOnTime");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const triCasterStateDiffer_1 = require("./triCasterStateDiffer");
const triCasterConnection_1 = require("./triCasterConnection");
const DEFAULT_PORT = 5951;
class TriCasterDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._connected = false;
        this._initialized = false;
        this._isTerminating = false;
        this._sendCommand = (commandWithContext) => {
            this.emitDebug(commandWithContext);
            return this._connection?.send(commandWithContext.command);
        };
        this._doOnTime = new doOnTime_1.DoOnTime(() => this.getCurrentTime(), doOnTime_1.SendMode.BURST, this._deviceOptions);
        this._doOnTime.on('error', (e) => this.emit('error', 'TriCasterDevice.doOnTime', e));
        this._doOnTime.on('slowCommand', (msg) => this.emit('slowCommand', this.deviceName + ': ' + msg));
        this._doOnTime.on('slowSentCommand', (info) => this.emit('slowSentCommand', info));
        this._doOnTime.on('slowFulfilledCommand', (info) => this.emit('slowFulfilledCommand', info));
    }
    async init(options) {
        const initPromise = new Promise((resolve) => {
            this._resolveInitPromise = resolve;
        });
        this._connection = new triCasterConnection_1.TriCasterConnection(options.host, options.port ?? DEFAULT_PORT);
        this._connection.on('connected', (info, shortcutStateXml) => {
            this._stateDiffer = new triCasterStateDiffer_1.TriCasterStateDiffer(info);
            this._setInitialState(shortcutStateXml);
            this._setConnected(true);
            this._initialized = true;
            this._resolveInitPromise(true);
            this.emit('info', `Connected to TriCaster ${info.productModel}, session: ${info.sessionName}`);
        });
        this._connection.on('disconnected', (reason) => {
            if (!this._isTerminating) {
                this.emit('warning', `TriCaster disconected due to: ${reason}`);
            }
            this._setConnected(false);
        });
        this._connection.on('error', (reason) => {
            this.emit('error', 'TriCasterConnection', reason);
        });
        this._connection.connect();
        return initPromise;
    }
    _setInitialState(shortcutStateXml) {
        if (!this._stateDiffer) {
            throw new Error('State Differ not available');
        }
        const time = this.getCurrentTime();
        const state = this._stateDiffer.shortcutStateConverter.getTriCasterStateFromShortcutState(shortcutStateXml);
        this.setState(state, time);
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
    _setConnected(connected) {
        if (this._connected !== connected) {
            this._connected = connected;
            this._connectionChanged();
        }
    }
    /** Called by the Conductor a bit before handleState is called */
    prepareForHandleState(newStateTime) {
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(newStateTime);
        this.cleanUpStates(0, newStateTime);
    }
    handleState(newState, newMappings) {
        const triCasterMappings = this.filterTriCasterMappings(newMappings);
        super.onHandleState(newState, newMappings);
        if (!this._initialized || !this._stateDiffer) {
            // before it's initialized don't do anything
            this.emit('warning', 'TriCaster not initialized yet');
            return;
        }
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldState = this.getStateBefore(previousStateTime)?.state ?? this._stateDiffer.getDefaultState(triCasterMappings);
        const newTriCasterState = this._stateDiffer.timelineStateConverter.getTriCasterStateFromTimelineState(newState, triCasterMappings);
        const commandsToAchieveState = this._stateDiffer.getCommandsToAchieveState(newTriCasterState, oldState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newTriCasterState, newState.time);
    }
    filterTriCasterMappings(newMappings) {
        return Object.entries(newMappings).reduce((accumulator, [layerName, mapping]) => {
            if (mapping.device === timeline_state_resolver_types_1.DeviceType.TRICASTER && mapping.deviceId === this.deviceId) {
                accumulator[layerName] = mapping;
            }
            return accumulator;
        }, {});
    }
    clearFuture(clearAfterTime) {
        // Clear any scheduled commands after this time
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    async terminate() {
        this._isTerminating = true;
        this._doOnTime.dispose();
        this._connection?.close();
        return Promise.resolve(true);
    }
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        if (!this._connected) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not connected');
        }
        return {
            statusCode: statusCode,
            messages: messages,
            active: this.isActive,
        };
    }
    async makeReady(okToDestroyStuff) {
        if (okToDestroyStuff) {
            // do something?
        }
    }
    get canConnect() {
        return true;
    }
    get connected() {
        return this._connected;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.TRICASTER;
    }
    get deviceName() {
        return 'TriCaster ' + this.deviceId;
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    _addToQueue(commandsToAchieveState, time) {
        _.each(commandsToAchieveState, (cmd) => {
            this._doOnTime.queue(time, undefined, async (cmd) => this._sendCommand(cmd), cmd);
        });
    }
}
exports.TriCasterDevice = TriCasterDevice;
//# sourceMappingURL=index.js.map