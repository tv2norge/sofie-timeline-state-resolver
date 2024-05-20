"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiOSCMessageDevice = void 0;
const _ = require("underscore");
const device_1 = require("../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("../../devices/doOnTime");
const deviceConnection_1 = require("./deviceConnection");
/**
 * This is a generic wrapper for any osc-enabled device.
 */
class MultiOSCMessageDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._connections = {};
        this._commandQueue = [];
        if (deviceOptions.options) {
            deviceOptions.options.connections.forEach(({ connectionId }) => {
                const connection = new deviceConnection_1.OSCConnection();
                connection.on('error', (err) => this.emit('error', 'Error in MultiOSC connection ' + connectionId, err));
                connection.on('debug', (...args) => this.emit('debug', 'from connection ' + connectionId, ...args));
                this._connections[connectionId] = connection;
            });
        }
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.BURST, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'OSC');
    }
    async init(initOptions) {
        for (const connOptions of initOptions.connections) {
            const conn = this._connections[connOptions.connectionId];
            if (!conn) {
                this.emit('error', 'Could not initialise device', new Error('Connection ' + connOptions.connectionId + ' not initialised'));
                continue;
            }
            await conn.connect({
                ...connOptions,
                oscSender: this._deviceOptions?.oscSenders?.[connOptions.connectionId] || undefined,
            });
        }
        return Promise.resolve(true); // This device doesn't have any initialization procedure
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
        // Transform timeline states into device states
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldOSCState = (this.getStateBefore(previousStateTime) || { state: {} }).state;
        const newOSCState = this.convertStateToOSCMessage(newState, newMappings);
        // Generate commands necessary to transition to the new state
        const commandsToAchieveState = this._diffStates(oldOSCState, newOSCState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newOSCState, newState.time);
    }
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime) {
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    async terminate() {
        this._doOnTime.dispose();
        return Promise.resolve(true);
    }
    getStatus() {
        const status = {
            statusCode: device_1.StatusCode.GOOD,
            messages: [],
            active: this.isActive,
        };
        for (const conn of Object.values(this._connections)) {
            if (!conn.connected) {
                status.statusCode = device_1.StatusCode.BAD;
                status.messages.push(`${conn.connectionId} is disconnected`);
            }
        }
        return status;
    }
    async makeReady(_okToDestroyStuff) {
        return Promise.resolve();
    }
    get canConnect() {
        return false;
    }
    get connected() {
        return false;
    }
    /**
     * Transform the timeline state into a device state, which is in this case also
     * a timeline state.
     * @param state
     */
    convertStateToOSCMessage(state, mappings) {
        const addrToOSCMessage = Object.fromEntries(Object.keys(this._connections).map((id) => [id, {}]));
        const addrToPriority = Object.fromEntries(Object.keys(this._connections).map((id) => [id, {}]));
        _.each(state.layers, (layer) => {
            const mapping = mappings[layer.layer];
            if (!mapping || !addrToOSCMessage[mapping.options.connectionId])
                return;
            if (layer.content.deviceType === timeline_state_resolver_types_1.DeviceType.OSC) {
                const content = {
                    ...layer.content,
                    connectionId: mapping.options.connectionId,
                    fromTlObject: layer.id,
                };
                if ((addrToOSCMessage[mapping.options.connectionId][content.path] &&
                    addrToPriority[mapping.options.connectionId][content.path] <= (layer.priority || 0)) ||
                    !addrToOSCMessage[mapping.options.connectionId][content.path]) {
                    addrToOSCMessage[mapping.options.connectionId][content.path] = content;
                    addrToPriority[mapping.options.connectionId][content.path] = layer.priority || 0;
                }
            }
        });
        return addrToOSCMessage;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.MULTI_OSC;
    }
    get deviceName() {
        return 'OSC ' + this.deviceId;
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    /**
     * Add commands to queue, to be executed at the right time
     */
    _addToQueue(commandsToAchieveState, time) {
        _.each(commandsToAchieveState, (cmd) => {
            this._doOnTime.queue(time, undefined, async (cmd) => {
                if (cmd.commandName === 'added' || cmd.commandName === 'changed') {
                    return this._addAndProcessQueue(cmd);
                }
                else {
                    return null;
                }
            }, cmd);
        });
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     * @param oldOscSendState The assumed current state
     * @param newOscSendState The desired state of the device
     */
    _diffStates(oldOscSendState, newOscSendState) {
        // in this oscSend class, let's just cheat:
        const commands = [];
        for (const connectionId of Object.keys(this._connections)) {
            _.each(newOscSendState[connectionId], (newCommandContent, address) => {
                const oldLayer = oldOscSendState[connectionId]?.[address];
                if (!oldLayer) {
                    // added!
                    commands.push({
                        commandName: 'added',
                        context: `added: ${newCommandContent.fromTlObject}`,
                        connectionId: newCommandContent.connectionId,
                        timelineObjId: newCommandContent.fromTlObject,
                        content: newCommandContent,
                    });
                }
                else {
                    // changed?
                    if (!_.isEqual(oldLayer, newCommandContent)) {
                        // changed!
                        commands.push({
                            commandName: 'changed',
                            context: `changed: ${newCommandContent.fromTlObject}`,
                            connectionId: newCommandContent.connectionId,
                            timelineObjId: newCommandContent.fromTlObject,
                            content: newCommandContent,
                        });
                    }
                }
            });
            // removed
            _.each(oldOscSendState[connectionId], (oldCommandContent, address) => {
                const newLayer = newOscSendState[connectionId]?.[address];
                if (!newLayer) {
                    // removed!
                    commands.push({
                        commandName: 'removed',
                        context: `removed: ${oldCommandContent.fromTlObject}`,
                        connectionId: oldCommandContent.connectionId,
                        timelineObjId: oldCommandContent.fromTlObject,
                        content: oldCommandContent,
                    });
                }
            });
        }
        return commands;
    }
    async _addAndProcessQueue(cmd) {
        this._commandQueue.push(cmd);
        await this._processQueue();
    }
    async _processQueue() {
        if (this._commandQueueTimer)
            return;
        const nextCommand = this._commandQueue.shift();
        if (!nextCommand)
            return;
        try {
            this._connections[nextCommand.connectionId]?.sendOsc({
                address: nextCommand.content.path,
                args: nextCommand.content.values,
            });
        }
        catch (e) {
            this.emit('commandError', new Error('Command failed: ' + e), { ...nextCommand, command: nextCommand });
        }
        this._commandQueueTimer = setTimeout(() => {
            this._commandQueueTimer = undefined;
            this._processQueue().catch((e) => this.emit('error', 'Error in processing queue', e));
        }, this.deviceOptions.options?.timeBetweenCommands || 0);
    }
}
exports.MultiOSCMessageDevice = MultiOSCMessageDevice;
//# sourceMappingURL=index.js.map