"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetricsDevice = void 0;
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const device_1 = require("../../devices/device");
const net_1 = require("net");
const _ = require("underscore");
const doOnTime_1 = require("../../devices/doOnTime");
const TELEMETRICS_NAME = 'Telemetrics';
const TELEMETRICS_COMMAND_PREFIX = 'P0C';
const DEFAULT_SOCKET_PORT = 5000;
const TIMEOUT_IN_MS = 2000;
/**
 * Connects to a Telemetrics Device on port 5000 using a TCP socket.
 * This class uses a fire and forget approach.
 */
class TelemetricsDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this.statusCode = timeline_state_resolver_types_1.StatusCode.UNKNOWN;
        this.doOnTime = new doOnTime_1.DoOnTime(() => this.getCurrentTime());
        this.handleDoOnTime(this.doOnTime, 'telemetrics');
    }
    get canConnect() {
        return true;
    }
    clearFuture(_clearAfterTime) {
        // No state to handle - we use a fire and forget approach
    }
    get connected() {
        return this.statusCode === timeline_state_resolver_types_1.StatusCode.GOOD;
    }
    get deviceName() {
        return `${TELEMETRICS_NAME} ${this.deviceId}`;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.TELEMETRICS;
    }
    getStatus() {
        const messages = [];
        switch (this.statusCode) {
            case timeline_state_resolver_types_1.StatusCode.GOOD:
                this.errorMessage = '';
                messages.push('Connected');
                break;
            case timeline_state_resolver_types_1.StatusCode.BAD:
                messages.push('No connection');
                break;
            case timeline_state_resolver_types_1.StatusCode.UNKNOWN:
                this.errorMessage = '';
                messages.push('Not initialized');
                break;
        }
        if (this.errorMessage) {
            messages.push(this.errorMessage);
        }
        return {
            statusCode: this.statusCode,
            messages,
            active: this.isActive,
        };
    }
    handleState(newState, mappings) {
        super.onHandleState(newState, mappings);
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldState = this.getStateBefore(previousStateTime)?.state ?? { presetShotIdentifiers: [] };
        const newTelemetricsState = this.findNewTelemetricsState(newState);
        this.doOnTime.clearQueueNowAndAfter(previousStateTime);
        this.setState(newTelemetricsState, newState.time);
        const presetIdentifiersToSend = this.filterNewPresetIdentifiersFromOld(newTelemetricsState, oldState);
        presetIdentifiersToSend.forEach((presetShotIdentifier) => this.queueCommand(presetShotIdentifier, newState));
    }
    findNewTelemetricsState(newState) {
        const newTelemetricsState = { presetShotIdentifiers: [] };
        newTelemetricsState.presetShotIdentifiers = _.map(newState.layers, (timelineObject, _layerName) => {
            const telemetricsContent = timelineObject.content;
            return telemetricsContent.presetShotIdentifiers;
        }).flat();
        return newTelemetricsState;
    }
    filterNewPresetIdentifiersFromOld(newState, oldState) {
        return newState.presetShotIdentifiers.filter((preset) => !oldState.presetShotIdentifiers.includes(preset));
    }
    queueCommand(presetShotIdentifier, newState) {
        const command = `${TELEMETRICS_COMMAND_PREFIX}${presetShotIdentifier}\r`;
        this.doOnTime.queue(newState.time, undefined, () => this.socket.write(command));
    }
    async init(options) {
        const initPromise = new Promise((resolve) => {
            this.resolveInitPromise = resolve;
        });
        this.connectToDevice(options.host, options.port ?? DEFAULT_SOCKET_PORT);
        return initPromise;
    }
    connectToDevice(host, port) {
        if (!this.socket || this.socket.destroyed) {
            this.setupSocket(host, port);
        }
        this.socket.connect(port, host);
    }
    setupSocket(host, port) {
        this.socket = new net_1.Socket();
        this.socket.on('data', (data) => {
            this.emit('debug', `${this.deviceName} received data: ${data.toString()}`);
        });
        this.socket.on('error', (error) => {
            this.updateStatus(timeline_state_resolver_types_1.StatusCode.BAD, error);
        });
        this.socket.on('close', (hadError) => {
            this.doOnTime.dispose();
            if (hadError) {
                this.updateStatus(timeline_state_resolver_types_1.StatusCode.BAD);
                this.reconnect(host, port);
            }
            else {
                this.updateStatus(timeline_state_resolver_types_1.StatusCode.UNKNOWN);
            }
        });
        this.socket.on('connect', () => {
            this.emit('debug', 'Successfully connected to device');
            this.updateStatus(timeline_state_resolver_types_1.StatusCode.GOOD);
            this.resolveInitPromise(true);
        });
    }
    updateStatus(statusCode, error) {
        this.statusCode = statusCode;
        if (error) {
            this.errorMessage = error.message;
        }
        this.emit('connectionChanged', this.getStatus());
    }
    reconnect(host, port) {
        if (this.retryConnectionTimer) {
            return;
        }
        this.retryConnectionTimer = setTimeout(() => {
            this.emit('debug', 'Reconnecting...');
            clearTimeout(this.retryConnectionTimer);
            this.retryConnectionTimer = undefined;
            this.connectToDevice(host, port);
        }, TIMEOUT_IN_MS);
    }
    prepareForHandleState(newStateTime) {
        this.doOnTime.clearQueueNowAndAfter(newStateTime);
        this.cleanUpStates(0, newStateTime);
    }
    async terminate() {
        this.doOnTime.dispose();
        if (this.retryConnectionTimer) {
            clearTimeout(this.retryConnectionTimer);
            this.retryConnectionTimer = undefined;
        }
        this.socket?.destroy();
        return true;
    }
}
exports.TelemetricsDevice = TelemetricsDevice;
//# sourceMappingURL=index.js.map