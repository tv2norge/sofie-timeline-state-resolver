"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanasonicPtzDevice = void 0;
const _ = require("underscore");
const device_1 = require("../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("../../devices/doOnTime");
const connection_1 = require("./connection");
const PROBE_INTERVAL = 10 * 1000; // Probe every 10s
const COMMAND_PRIORITY = {
    presetSpeed: 0,
    zoomSpeed: 1,
    zoom: 2,
    presetMem: 3,
};
/**
 * A wrapper for panasonic ptz cameras. Maps timeline states to device states and
 * executes commands to achieve such states. Depends on PanasonicPTZAPI class for
 * connection with the physical device.
 */
class PanasonicPtzDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._connected = false;
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver) {
                this._commandReceiver = deviceOptions.commandReceiver;
            }
            else {
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
            }
        }
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.BURST, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'PanasonicPTZ');
        if (!deviceOptions.options || !deviceOptions.options.host) {
            this._device = undefined;
            return;
        }
        // set up connection class
        this._device = new connection_1.PanasonicPtzHttpInterface(deviceOptions.options.host, deviceOptions.options.port, deviceOptions.options.https);
        this._device.on('error', (msg) => {
            if (msg.code === 'ECONNREFUSED')
                return; // ignore, since we catch this in connection logic
            this.emit('error', 'PanasonicPtzHttpInterface', msg);
        });
        this._device.on('disconnected', () => {
            this._setConnected(false);
        });
        this._device.on('debug', (...args) => {
            this.emitDebug('Panasonic PTZ', ...args);
        });
    }
    /**
     * Initiates the device: set up ping for connection logic.
     */
    async init(_initOptions) {
        if (!this._device) {
            return Promise.reject('There are no cameras set up for this device');
        }
        return new Promise((resolve, reject) => {
            this._pingInterval = setInterval(() => {
                if (!this._device) {
                    this.emit('error', `init() interval`, new Error(`Device handler for "${this.deviceId}" not defined`));
                    return;
                }
                this._device
                    .ping()
                    .then((result) => {
                    this._setConnected(!!result);
                })
                    .catch(() => {
                    this._setConnected(false);
                });
            }, PROBE_INTERVAL);
            if (!this._device) {
                throw new Error(`Device handler for "${this.deviceId}" not defined`);
            }
            this._device
                .ping()
                .then((result) => {
                this._setConnected(!!result);
                resolve(true);
            })
                .catch((e) => {
                reject(e);
            });
        });
    }
    /**
     * Converts a timeline state into a device state.
     * @param state
     */
    convertStateToPtz(state, mappings) {
        // convert the timeline state into something we can use
        const ptzState = this._getDefaultState();
        _.each(state.layers, (tlObject, layerName) => {
            const mapping = mappings[layerName];
            if (mapping &&
                mapping.device === timeline_state_resolver_types_1.DeviceType.PANASONIC_PTZ &&
                mapping.deviceId === this.deviceId &&
                tlObject.content.deviceType === timeline_state_resolver_types_1.DeviceType.PANASONIC_PTZ) {
                if (mapping.options.mappingType === timeline_state_resolver_types_1.MappingPanasonicPTZType.PresetMem &&
                    tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.PRESET) {
                    ptzState.preset = {
                        value: tlObject.content.preset,
                        timelineObjId: tlObject.id,
                    };
                }
                else if (mapping.options.mappingType === timeline_state_resolver_types_1.MappingPanasonicPTZType.PresetSpeed &&
                    tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.SPEED) {
                    ptzState.speed = {
                        value: tlObject.content.speed,
                        timelineObjId: tlObject.id,
                    };
                }
                else if (mapping.options.mappingType === timeline_state_resolver_types_1.MappingPanasonicPTZType.ZoomSpeed &&
                    tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.ZOOM_SPEED) {
                    ptzState.zoomSpeed = {
                        value: tlObject.content.zoomSpeed,
                        timelineObjId: tlObject.id,
                    };
                }
                else if (mapping.options.mappingType === timeline_state_resolver_types_1.MappingPanasonicPTZType.Zoom &&
                    tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.ZOOM) {
                    ptzState.zoom = {
                        value: tlObject.content.zoom,
                        timelineObjId: tlObject.id,
                    };
                }
            }
        });
        return ptzState;
    }
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime) {
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(newStateTime);
        this.cleanUpStates(0, newStateTime);
    }
    /**
     * Handles a new state such that the device will be in that state at a specific point
     * in time.
     * @param newState
     */
    handleState(newState, newMappings) {
        super.onHandleState(newState, newMappings);
        // Create device states
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldPtzState = (this.getStateBefore(previousStateTime) || { state: this._getDefaultState() }).state;
        const newPtzState = this.convertStateToPtz(newState, newMappings);
        // Generate commands needed to reach new state
        const commandsToAchieveState = this._diffStates(oldPtzState, newPtzState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newPtzState, newState.time);
    }
    clearFuture(clearAfterTime) {
        // Clear any scheduled commands after this time
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    async terminate() {
        if (this._pingInterval)
            clearInterval(this._pingInterval);
        if (this._device) {
            this._device.dispose();
        }
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
    _getDefaultState() {
        return {
            // preset: undefined,
            // speed: undefined,
            zoomSpeed: {
                value: 0,
                timelineObjId: 'default',
            },
            // zoom: undefined
        };
    }
    async _defaultCommandReceiver(_time, cmd, context, timelineObjId) {
        const cwc = {
            context: context,
            command: cmd,
            timelineObjId: timelineObjId,
        };
        try {
            if (this._device) {
                if (cmd.type === timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.PRESET) {
                    // recall preset
                    if (cmd.preset !== undefined) {
                        const res = await this._device.recallPreset(cmd.preset);
                        this.emitDebug(`Panasonic PTZ result: ${res}`);
                    }
                    else
                        throw new Error(`Bad parameter: preset`);
                }
                else if (cmd.type === timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.SPEED) {
                    // set speed
                    if (cmd.speed !== undefined) {
                        const res = await this._device.setSpeed(cmd.speed);
                        this.emitDebug(`Panasonic PTZ result: ${res}`);
                    }
                    else
                        throw new Error(`Bad parameter: speed`);
                }
                else if (cmd.type === timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.ZOOM_SPEED) {
                    // set zoom speed
                    if (cmd.zoomSpeed !== undefined) {
                        // scale -1 - 0 - +1 range to 01 - 50 - 99 range
                        const res = await this._device.setZoomSpeed(cmd.zoomSpeed * 49 + 50);
                        this.emitDebug(`Panasonic PTZ result: ${res}`);
                    }
                    else
                        throw new Error(`Bad parameter: zoomSpeed`);
                }
                else if (cmd.type === timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.ZOOM) {
                    // set zoom
                    if (cmd.zoom !== undefined) {
                        // scale 0 - +1 range to 555h - FFFh range
                        const res = await this._device.setZoom(cmd.zoom * 0xaaa + 0x555);
                        this.emitDebug(`Panasonic PTZ result: ${res}`);
                    }
                    else
                        throw new Error(`Bad parameter: zoom`);
                }
                else
                    throw new Error(`PTZ: Unknown type: "${cmd.type}"`);
            }
            else
                throw new Error(`PTZ device not set up`);
        }
        catch (e) {
            this.emit('commandError', e, cwc);
        }
    }
    /**
     * Add commands to queue, to be executed at the right time
     */
    _addToQueue(commandsToAchieveState, time) {
        const sortedCommandsToAchieveState = commandsToAchieveState.sort((a, b) => COMMAND_PRIORITY[a.command.type] - COMMAND_PRIORITY[b.command.type]);
        _.each(sortedCommandsToAchieveState, (cmd) => {
            // add the new commands to the queue:
            this._doOnTime.queue(time, undefined, async (cmd) => {
                return this._commandReceiver(time, cmd.command, cmd.context, cmd.timelineObjId);
            }, cmd);
        });
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    _diffStates(oldPtzState, newPtzState) {
        const commands = [];
        const addCommands = (newNode, oldValue) => {
            if (newNode.preset &&
                this.getValue(newNode.preset) !== this.getValue(oldValue.preset) &&
                this.getValue(newNode.preset) !== undefined) {
                commands.push({
                    command: {
                        type: timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.PRESET,
                        preset: this.getValue(newNode.preset),
                    },
                    context: `preset differ (${this.getValue(newNode.preset)}, ${this.getValue(oldValue.preset)})`,
                    timelineObjId: newNode.preset.timelineObjId,
                });
            }
            if (newNode.speed &&
                this.getValue(newNode.speed) !== this.getValue(oldValue.speed) &&
                this.getValue(newNode.speed) !== undefined) {
                commands.push({
                    command: {
                        type: timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.SPEED,
                        speed: this.getValue(newNode.speed),
                    },
                    context: `speed differ (${this.getValue(newNode.speed)}, ${this.getValue(oldValue.speed)})`,
                    timelineObjId: newNode.speed.timelineObjId,
                });
            }
            if (newNode.zoomSpeed &&
                this.getValue(newNode.zoomSpeed) !== this.getValue(oldValue.zoomSpeed) &&
                this.getValue(newNode.zoomSpeed) !== undefined) {
                commands.push({
                    command: {
                        type: timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.ZOOM_SPEED,
                        speed: this.getValue(newNode.zoomSpeed),
                    },
                    context: `zoom speed differ (${this.getValue(newNode.zoomSpeed)}, ${this.getValue(oldValue.zoomSpeed)})`,
                    timelineObjId: newNode.zoomSpeed.timelineObjId,
                });
            }
            if (newNode.zoom &&
                this.getValue(newNode.zoom) !== this.getValue(oldValue.zoom) &&
                this.getValue(newNode.zoom) !== undefined) {
                commands.push({
                    command: {
                        type: timeline_state_resolver_types_1.TimelineContentTypePanasonicPtz.ZOOM,
                        zoom: this.getValue(newNode.zoom),
                    },
                    context: `zoom differ (${this.getValue(newNode.zoom)}, ${this.getValue(oldValue.zoom)})`,
                    timelineObjId: newNode.zoom.timelineObjId,
                });
            }
        };
        if (!_.isEqual(newPtzState, oldPtzState)) {
            addCommands(newPtzState, oldPtzState);
        }
        return commands;
    }
    get canConnect() {
        return true;
    }
    get connected() {
        return this._connected;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.PANASONIC_PTZ;
    }
    get deviceName() {
        return 'Panasonic PTZ ' + this.deviceId;
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    _setConnected(connected) {
        if (this._connected !== connected) {
            this._connected = connected;
            this._connectionChanged();
        }
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
    getValue(a) {
        if (a)
            return a.value;
        return undefined;
    }
}
exports.PanasonicPtzDevice = PanasonicPtzDevice;
//# sourceMappingURL=index.js.map