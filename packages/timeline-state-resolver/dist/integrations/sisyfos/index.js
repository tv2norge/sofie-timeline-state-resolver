"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SisyfosMessageDevice = void 0;
const _ = require("underscore");
const device_1 = require("./../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("../../devices/doOnTime");
const connection_1 = require("./connection");
const debug_1 = require("debug");
const lib_1 = require("../../lib");
const debug = (0, debug_1.default)('timeline-state-resolver:sisyfos');
/**
 * This is a generic wrapper for any osc-enabled device.
 */
class SisyfosMessageDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._resyncing = false;
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver)
                this._commandReceiver = deviceOptions.commandReceiver;
            else
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
        }
        this._sisyfos = new connection_1.SisyfosApi();
        this._sisyfos.on('error', (e) => this.emit('error', 'Sisyfos', e));
        this._sisyfos.on('connected', () => {
            this._connectionChanged();
        });
        this._sisyfos.on('disconnected', () => {
            this._connectionChanged();
        });
        this._sisyfos.on('mixerOnline', (onlineStatus) => {
            this._sisyfos.setMixerOnline(onlineStatus);
            this._connectionChanged();
        });
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.BURST, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'Sisyfos');
    }
    async init(initOptions) {
        this._sisyfos.once('initialized', () => {
            this.setState(this.getDeviceState(false), this.getCurrentTime());
            this.emit('resetResolver');
        });
        return this._sisyfos.connect(initOptions.host, initOptions.port).then(() => true);
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
        if (!this._sisyfos.state) {
            this.emit('warning', 'Sisyfos State not initialized yet');
            return;
        }
        // Transform timeline states into device states
        const convertTrace = (0, lib_1.startTrace)(`device:convertState`, { deviceId: this.deviceId });
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldSisyfosState = (this.getStateBefore(previousStateTime) || { state: { channels: {}, resync: false } }).state;
        this.emit('timeTrace', (0, lib_1.endTrace)(convertTrace));
        const diffTrace = (0, lib_1.startTrace)(`device:diffState`, { deviceId: this.deviceId });
        const newSisyfosState = this.convertStateToSisyfosState(newState, newMappings);
        this.emit('timeTrace', (0, lib_1.endTrace)(diffTrace));
        this._handleStateInner(oldSisyfosState, newSisyfosState, previousStateTime, newState.time);
    }
    _handleStateInner(oldSisyfosState, newSisyfosState, previousStateTime, newTime) {
        // Generate commands necessary to transition to the new state
        const commandsToAchieveState = this._diffStates(oldSisyfosState, newSisyfosState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newTime);
        // store the new state, for later use:
        this.setState(newSisyfosState, newTime);
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
        this._sisyfos.dispose();
        this._sisyfos.removeAllListeners();
        return Promise.resolve(true);
    }
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        if (!this._sisyfos.connected) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not connected');
        }
        if (!this._sisyfos.state && !this._resyncing) {
            statusCode = device_1.StatusCode.BAD;
            messages.push(`Sisyfos device connection not initialized (restart required)`);
        }
        if (!this._sisyfos.mixerOnline) {
            statusCode = device_1.StatusCode.BAD;
            messages.push(`Sisyfos has no connection to Audiomixer`);
        }
        return {
            statusCode: statusCode,
            messages: messages,
            active: this.isActive,
        };
    }
    async makeReady(okToDestroyStuff) {
        if (okToDestroyStuff)
            return this._makeReadyInner(okToDestroyStuff);
    }
    async _makeReadyInner(resync) {
        if (resync) {
            this._resyncing = true;
            // If state is still not reinitialised afer 5 seconds, we may have a problem.
            setTimeout(() => (this._resyncing = false), 5000);
        }
        this._doOnTime.clearQueueNowAndAfter(this.getCurrentTime());
        this._sisyfos.reInitialize();
        this._sisyfos.on('initialized', () => {
            if (resync) {
                this._resyncing = false;
                const targetState = this.getState(this.getCurrentTime());
                if (targetState) {
                    this._handleStateInner(this.getDeviceState(false), targetState.state, targetState.time, this.getCurrentTime());
                }
            }
            else {
                this.setState(this.getDeviceState(false), this.getCurrentTime());
                this.emit('resetResolver');
            }
        });
        return Promise.resolve();
    }
    async executeAction(actionId, _payload) {
        switch (actionId) {
            case timeline_state_resolver_types_1.SisyfosActions.Reinit:
                return this._makeReadyInner()
                    .then(() => ({
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok,
                }))
                    .catch(() => ({
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                }));
            default:
                return (0, lib_1.actionNotFoundMessage)(actionId);
        }
    }
    get canConnect() {
        return true;
    }
    get connected() {
        return this._sisyfos.connected;
    }
    getDeviceState(isDefaultState = true, mappings) {
        let deviceStateFromAPI = this._sisyfos.state;
        const deviceState = {
            channels: {},
            resync: false,
        };
        if (!deviceStateFromAPI)
            deviceStateFromAPI = deviceState;
        const channels = mappings
            ? Object.values(mappings || {})
                .filter((m) => m.options.mappingType === timeline_state_resolver_types_1.MappingSisyfosType.Channel)
                .map((m) => m.options.channel)
            : Object.keys(deviceStateFromAPI.channels);
        for (const ch of channels) {
            const channelFromAPI = deviceStateFromAPI.channels[ch];
            let channel = {
                ...channelFromAPI,
                tlObjIds: [],
            };
            if (isDefaultState) {
                // reset values for default state
                channel = {
                    ...channel,
                    ...this.getDefaultStateChannel(),
                };
            }
            deviceState.channels[ch] = channel;
        }
        return deviceState;
    }
    getDefaultStateChannel() {
        return {
            faderLevel: 0.75,
            pgmOn: 0,
            pstOn: 0,
            label: '',
            visible: true,
            tlObjIds: [],
        };
    }
    /**
     * Transform the timeline state into a device state, which is in this case also
     * a timeline state.
     * @param state
     */
    convertStateToSisyfosState(state, mappings) {
        const deviceState = this.getDeviceState(true, mappings);
        // Set labels to layer names
        for (const mapping of Object.values(mappings)) {
            const sisyfosMapping = mapping;
            if (sisyfosMapping.options.mappingType !== timeline_state_resolver_types_1.MappingSisyfosType.Channel)
                continue;
            if (!sisyfosMapping.options.setLabelToLayerName)
                continue;
            if (!sisyfosMapping.layerName)
                continue;
            let channel = deviceState.channels[sisyfosMapping.options.channel];
            if (!channel) {
                channel = this.getDefaultStateChannel();
            }
            channel.label = sisyfosMapping.layerName;
            deviceState.channels[sisyfosMapping.options.channel] = channel;
        }
        // Preparation: put all channels that comes from the state in an array:
        const newChannels = [];
        _.each(state.layers, (tlObject, layerName) => {
            const layer = tlObject;
            let foundMapping = mappings[layerName];
            const content = tlObject.content;
            // Allow resync without valid channel mapping
            if ('resync' in content && content.resync !== undefined) {
                deviceState.resync = deviceState.resync || content.resync;
            }
            // Allow retrigger without valid channel mapping
            if ('triggerValue' in content && content.triggerValue !== undefined) {
                deviceState.triggerValue = content.triggerValue;
            }
            // if the tlObj is specifies to load to PST the original Layer is used to resolve the mapping
            if (!foundMapping && layer.isLookahead && layer.lookaheadForLayer) {
                foundMapping = mappings[layer.lookaheadForLayer];
            }
            if (foundMapping && foundMapping.deviceId === this.deviceId) {
                // @ts-ignore backwards-compatibility:
                if (!foundMapping.mappingType)
                    foundMapping.mappingType = timeline_state_resolver_types_1.MappingSisyfosType.CHANNEL;
                // @ts-ignore backwards-compatibility:
                if (content.type === 'sisyfos')
                    content.type = timeline_state_resolver_types_1.TimelineContentTypeSisyfos.CHANNEL;
                debug(`Mapping ${foundMapping.layerName}: ${foundMapping.options.mappingType}, ${foundMapping.options.channel || foundMapping.options.label}`);
                if (foundMapping.options.mappingType === timeline_state_resolver_types_1.MappingSisyfosType.Channel &&
                    content.type === timeline_state_resolver_types_1.TimelineContentTypeSisyfos.CHANNEL) {
                    newChannels.push({
                        ...content,
                        channel: foundMapping.options.channel,
                        overridePriority: content.overridePriority || 0,
                        isLookahead: layer.isLookahead || false,
                        tlObjId: layer.id,
                    });
                    deviceState.resync = deviceState.resync || content.resync || false;
                }
                else if (foundMapping.options.mappingType === timeline_state_resolver_types_1.MappingSisyfosType.ChannelByLabel &&
                    content.type === timeline_state_resolver_types_1.TimelineContentTypeSisyfos.CHANNEL) {
                    const ch = this._sisyfos.getChannelByLabel(foundMapping.options.label);
                    debug(`Channel by label ${foundMapping.options.label}(${ch}): ${content.isPgm}`);
                    if (ch === undefined)
                        return;
                    newChannels.push({
                        ...content,
                        channel: ch,
                        overridePriority: content.overridePriority || 0,
                        isLookahead: layer.isLookahead || false,
                        tlObjId: layer.id,
                    });
                    deviceState.resync = deviceState.resync || content.resync || false;
                }
                else if (foundMapping.options.mappingType === timeline_state_resolver_types_1.MappingSisyfosType.Channels &&
                    content.type === timeline_state_resolver_types_1.TimelineContentTypeSisyfos.CHANNELS) {
                    _.each(content.channels, (channel) => {
                        const referencedMapping = mappings[channel.mappedLayer];
                        if (referencedMapping && referencedMapping.options.mappingType === timeline_state_resolver_types_1.MappingSisyfosType.Channel) {
                            newChannels.push({
                                ...channel,
                                channel: referencedMapping.options.channel,
                                overridePriority: content.overridePriority || 0,
                                isLookahead: layer.isLookahead || false,
                                tlObjId: layer.id,
                            });
                        }
                        else if (referencedMapping &&
                            referencedMapping.options.mappingType === timeline_state_resolver_types_1.MappingSisyfosType.ChannelByLabel) {
                            const ch = this._sisyfos.getChannelByLabel(referencedMapping.options.label);
                            debug(`Channel by label ${referencedMapping.options.label}(${ch}): ${channel.isPgm}`);
                            if (ch === undefined)
                                return;
                            newChannels.push({
                                ...channel,
                                channel: ch,
                                overridePriority: content.overridePriority || 0,
                                isLookahead: layer.isLookahead || false,
                                tlObjId: layer.id,
                            });
                        }
                    });
                    deviceState.resync = deviceState.resync || content.resync || false;
                }
            }
        });
        // Sort by overridePriority, so that those with highest overridePriority will be applied last
        _.each(_.sortBy(newChannels, (channel) => channel.overridePriority), (newChannel) => {
            if (!deviceState.channels[newChannel.channel]) {
                deviceState.channels[newChannel.channel] = this.getDefaultStateChannel();
            }
            const channel = deviceState.channels[newChannel.channel];
            if (newChannel.isPgm !== undefined) {
                if (newChannel.isLookahead) {
                    channel.pstOn = newChannel.isPgm || 0;
                }
                else {
                    channel.pgmOn = newChannel.isPgm || 0;
                }
            }
            if (newChannel.faderLevel !== undefined)
                channel.faderLevel = newChannel.faderLevel;
            if (newChannel.label !== undefined && newChannel.label !== '')
                channel.label = newChannel.label;
            if (newChannel.visible !== undefined)
                channel.visible = newChannel.visible;
            if (newChannel.fadeTime !== undefined)
                channel.fadeTime = newChannel.fadeTime;
            channel.tlObjIds.push(newChannel.tlObjId);
        });
        return deviceState;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.SISYFOS;
    }
    get deviceName() {
        return 'Sisyfos ' + this.deviceId;
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    /**
     * add the new commands to the queue:
     * @param commandsToAchieveState
     * @param time
     */
    _addToQueue(commandsToAchieveState, time) {
        _.each(commandsToAchieveState, (cmd) => {
            this._doOnTime.queue(time, undefined, async (cmd) => {
                return this._commandReceiver(time, cmd.content, cmd.context, cmd.timelineObjId);
            }, cmd);
        });
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    _diffStates(oldOscSendState, newOscSendState) {
        const commands = [];
        if (newOscSendState.resync && !oldOscSendState.resync) {
            commands.push({
                context: `Resyncing with Sisyfos`,
                content: {
                    type: connection_1.SisyfosCommandType.RESYNC,
                },
                timelineObjId: '',
            });
        }
        _.each(newOscSendState.channels, (newChannel, index) => {
            const oldChannel = oldOscSendState.channels[index];
            if (newOscSendState.triggerValue && newOscSendState.triggerValue !== oldOscSendState.triggerValue) {
                // || (!oldChannel && Number(index) >= 0)) {
                // push commands for everything
                debug('reset channel ' + index);
                commands.push({
                    context: `Channel ${index} reset`,
                    content: {
                        type: connection_1.SisyfosCommandType.SET_CHANNEL,
                        channel: Number(index),
                        values: newChannel,
                    },
                    timelineObjId: newChannel.tlObjIds[0] || '',
                });
                return;
            }
            if (oldChannel && oldChannel.pgmOn !== newChannel.pgmOn) {
                debug(`Channel ${index} pgm goes from "${oldChannel.pgmOn}" to "${newChannel.pgmOn}"`);
                const values = [newChannel.pgmOn];
                if (newChannel.fadeTime) {
                    values.push(newChannel.fadeTime);
                }
                commands.push({
                    context: `Channel ${index} pgm goes from "${oldChannel.pgmOn}" to "${newChannel.pgmOn}"`,
                    content: {
                        type: connection_1.SisyfosCommandType.TOGGLE_PGM,
                        channel: Number(index),
                        values,
                    },
                    timelineObjId: newChannel.tlObjIds[0] || '',
                });
            }
            if (oldChannel && oldChannel.pstOn !== newChannel.pstOn) {
                debug(`Channel ${index} pst goes from "${oldChannel.pstOn}" to "${newChannel.pstOn}"`);
                commands.push({
                    context: `Channel ${index} pst goes from "${oldChannel.pstOn}" to "${newChannel.pstOn}"`,
                    content: {
                        type: connection_1.SisyfosCommandType.TOGGLE_PST,
                        channel: Number(index),
                        value: newChannel.pstOn,
                    },
                    timelineObjId: newChannel.tlObjIds[0] || '',
                });
            }
            if (oldChannel && oldChannel.faderLevel !== newChannel.faderLevel) {
                debug(`change faderLevel ${index}: "${newChannel.faderLevel}"`);
                commands.push({
                    context: 'faderLevel change',
                    content: {
                        type: connection_1.SisyfosCommandType.SET_FADER,
                        channel: Number(index),
                        value: newChannel.faderLevel,
                    },
                    timelineObjId: newChannel.tlObjIds[0] || '',
                });
            }
            newChannel.label = newChannel.label || (oldChannel ? oldChannel.label : '');
            if (oldChannel && newChannel.label !== '' && oldChannel.label !== newChannel.label) {
                debug(`set label on fader ${index}: "${newChannel.label}"`);
                commands.push({
                    context: 'set label on fader',
                    content: {
                        type: connection_1.SisyfosCommandType.LABEL,
                        channel: Number(index),
                        value: newChannel.label,
                    },
                    timelineObjId: newChannel.tlObjIds[0] || '',
                });
            }
            if (oldChannel && oldChannel.visible !== newChannel.visible) {
                debug(`Channel ${index} Visibility goes from "${oldChannel.visible}" to "${newChannel.visible}"`);
                commands.push({
                    context: `Channel ${index} Visibility goes from "${oldChannel.visible}" to "${newChannel.visible}"`,
                    content: {
                        type: connection_1.SisyfosCommandType.VISIBLE,
                        channel: Number(index),
                        value: newChannel.visible,
                    },
                    timelineObjId: newChannel.tlObjIds[0] || '',
                });
            }
        });
        return commands;
    }
    async _defaultCommandReceiver(_time, cmd, context, timelineObjId) {
        const cwc = {
            context: context,
            command: cmd,
            timelineObjId: timelineObjId,
        };
        this.emitDebug(cwc);
        if (cmd.type === connection_1.SisyfosCommandType.RESYNC) {
            return this._makeReadyInner(true);
        }
        else {
            try {
                this._sisyfos.send(cmd);
                return Promise.resolve();
            }
            catch (e) {
                return Promise.reject(e);
            }
        }
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
}
exports.SisyfosMessageDevice = SisyfosMessageDevice;
//# sourceMappingURL=index.js.map