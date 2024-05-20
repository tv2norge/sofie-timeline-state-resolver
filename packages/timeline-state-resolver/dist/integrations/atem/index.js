"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtemDevice = void 0;
const _ = require("underscore");
const underScoreDeepExtend = require("underscore-deep-extend");
const device_1 = require("./../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const atem_state_1 = require("atem-state");
const atem_connection_1 = require("atem-connection");
const doOnTime_1 = require("../../devices/doOnTime");
const lib_1 = require("../../lib");
_.mixin({ deepExtend: underScoreDeepExtend(_) });
function deepExtend(destination, ...sources) {
    // @ts-ignore (mixin)
    return _.deepExtend(destination, ...sources);
}
/**
 * This is a wrapper for the Atem Device. Commands to any and all atem devices will be sent through here.
 */
class AtemDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._initialized = false;
        this._connected = false; // note: ideally this should be replaced by this._atem.connected
        this.firstStateAfterMakeReady = true; // note: temprorary for some improved logging
        this._atemStatus = {
            psus: [],
        };
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver)
                this._commandReceiver = deviceOptions.commandReceiver;
            else
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
        }
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.BURST, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'Atem');
    }
    /**
     * Initiates the connection with the ATEM through the atem-connection lib
     * and initiates Atem State lib.
     */
    async init(options) {
        return new Promise((resolve, reject) => {
            // This is where we would do initialization, like connecting to the devices, etc
            this._state = new atem_state_1.AtemState();
            this._atem = new atem_connection_1.BasicAtem();
            this._atem.once('connected', () => {
                // check if state has been initialized:
                this._connected = true;
                this._initialized = true;
                resolve(true);
            });
            this._atem.on('connected', () => {
                const time = this.getCurrentTime();
                if (this._atem.state)
                    this.setState(this._atem.state, time);
                this._connected = true;
                this._connectionChanged();
                this.emit('resetResolver');
            });
            this._atem.on('disconnected', () => {
                this._connected = false;
                this._connectionChanged();
            });
            this._atem.on('error', (e) => this.emit('error', 'Atem', new Error(e)));
            this._atem.on('stateChanged', (state) => this._onAtemStateChanged(state));
            this._atem.connect(options.host, options.port).catch((e) => {
                reject(e);
            });
        });
    }
    /**
     * Safely terminate everything to do with this device such that it can be
     * garbage collected.
     */
    async terminate() {
        this._doOnTime.dispose();
        return new Promise((resolve) => {
            // TODO: implement dispose function in atem-connection
            this._atem
                .disconnect()
                .then(() => {
                resolve(true);
            })
                .catch(() => {
                resolve(false);
            })
                .finally(() => {
                this._atem.destroy().catch(() => null);
                this._atem.removeAllListeners();
            });
        });
    }
    async resyncState() {
        this._doOnTime.clearQueueNowAndAfter(this.getCurrentTime());
        if (this._atem.state)
            this.setState(this._atem.state, this.getCurrentTime());
        return {
            result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok,
        };
    }
    async executeAction(actionId, _payload) {
        switch (actionId) {
            case timeline_state_resolver_types_1.AtemActions.Resync:
                return this.resyncState();
            default:
                return (0, lib_1.actionNotFoundMessage)(actionId);
        }
    }
    /**
     * Prepare device for playout
     * @param okToDestroyStuff If true, may break output
     */
    async makeReady(okToDestroyStuff) {
        if (okToDestroyStuff) {
            await this.resyncState();
        }
    }
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime) {
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(newStateTime);
        this.cleanUpStates(0, newStateTime);
    }
    /**
     * Process a state, diff against previous state and generate commands to
     * be executed at the state's time.
     * @param newState The state to handle
     */
    handleState(newState, newMappings) {
        super.onHandleState(newState, newMappings);
        if (!this._initialized) {
            // before it's initialized don't do anything
            this.emit('warning', 'Atem not initialized yet');
            return;
        }
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldState = (this.getStateBefore(previousStateTime) || { state: atem_connection_1.AtemStateUtil.Create() }).state;
        const convertTrace = (0, lib_1.startTrace)(`device:convertState`, { deviceId: this.deviceId });
        const oldAtemState = oldState;
        const newAtemState = this.convertStateToAtem(newState, newMappings);
        this.emit('timeTrace', (0, lib_1.endTrace)(convertTrace));
        if (this.firstStateAfterMakeReady) {
            // emit a debug message with the states:
            this.firstStateAfterMakeReady = false;
            this.emitDebug(JSON.stringify({
                reason: 'firstStateAfterMakeReady',
                before: (oldAtemState || {}).video,
                after: (newAtemState || {}).video,
            }));
        }
        const diffTrace = (0, lib_1.startTrace)(`device:diffState`, { deviceId: this.deviceId });
        const commandsToAchieveState = this._diffStates(oldAtemState, newAtemState, newMappings);
        this.emit('timeTrace', (0, lib_1.endTrace)(diffTrace));
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newAtemState, newState.time);
    }
    /**
     * Clear any scheduled commands after `clearAfterTime`
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime) {
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    get canConnect() {
        return true;
    }
    get connected() {
        return this._connected;
    }
    /**
     * Convert a timeline state into an Atem state.
     * @param state The state to be converted
     */
    convertStateToAtem(state, newMappings) {
        if (!this._initialized)
            throw Error('convertStateToAtem cannot be used before inititialized');
        // Start out with default state:
        const deviceState = atem_connection_1.AtemStateUtil.Create();
        // Sort layer based on Layer name
        const sortedLayers = _.map(state.layers, (tlObject, layerName) => ({ layerName, tlObject })).sort((a, b) => a.layerName.localeCompare(b.layerName));
        // For every layer, augment the state
        _.each(sortedLayers, ({ tlObject, layerName }) => {
            const content = tlObject.content;
            const mapping = newMappings[layerName];
            if (mapping && mapping.deviceId === this.deviceId && content.deviceType === timeline_state_resolver_types_1.DeviceType.ATEM) {
                if ('index' in mapping.options && mapping.options.index !== undefined && mapping.options.index >= 0) {
                    // index must be 0 or higher
                    switch (mapping.options.mappingType) {
                        case timeline_state_resolver_types_1.MappingAtemType.MixEffect:
                            if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.ME) {
                                const me = atem_connection_1.AtemStateUtil.getMixEffect(deviceState, mapping.options.index);
                                const atemObjKeyers = content.me.upstreamKeyers;
                                const transition = content.me.transition;
                                deepExtend(me, _.omit(content.me, 'upstreamKeyers'));
                                if (this._isAssignableToNextStyle(transition)) {
                                    me.transitionProperties.nextStyle = transition;
                                }
                                if (atemObjKeyers) {
                                    for (const objKeyer of atemObjKeyers) {
                                        const keyer = atem_connection_1.AtemStateUtil.getUpstreamKeyer(me, objKeyer.upstreamKeyerId);
                                        deepExtend(keyer, objKeyer);
                                    }
                                }
                            }
                            break;
                        case timeline_state_resolver_types_1.MappingAtemType.DownStreamKeyer:
                            if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.DSK) {
                                const dsk = atem_connection_1.AtemStateUtil.getDownstreamKeyer(deviceState, mapping.options.index);
                                if (dsk)
                                    deepExtend(dsk, content.dsk);
                            }
                            break;
                        case timeline_state_resolver_types_1.MappingAtemType.SuperSourceBox:
                            if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.SSRC) {
                                const ssrc = atem_connection_1.AtemStateUtil.getSuperSource(deviceState, mapping.options.index);
                                if (ssrc) {
                                    const objBoxes = content.ssrc.boxes;
                                    _.each(objBoxes, (box, i) => {
                                        if (ssrc.boxes[i]) {
                                            deepExtend(ssrc.boxes[i], box);
                                        }
                                        else {
                                            ssrc.boxes[i] = {
                                                ...atem_state_1.Defaults.Video.SuperSourceBox,
                                                ...box,
                                            };
                                        }
                                    });
                                }
                            }
                            break;
                        case timeline_state_resolver_types_1.MappingAtemType.SuperSourceProperties:
                            if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.SSRCPROPS) {
                                const ssrc = atem_connection_1.AtemStateUtil.getSuperSource(deviceState, mapping.options.index);
                                if (!ssrc.properties)
                                    ssrc.properties = { ...atem_state_1.Defaults.Video.SuperSourceProperties };
                                if (ssrc)
                                    deepExtend(ssrc.properties, content.ssrcProps);
                            }
                            break;
                        case timeline_state_resolver_types_1.MappingAtemType.Auxilliary:
                            if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.AUX) {
                                deviceState.video.auxilliaries[mapping.options.index] = content.aux.input;
                            }
                            break;
                        case timeline_state_resolver_types_1.MappingAtemType.MediaPlayer:
                            if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.MEDIAPLAYER) {
                                const ms = atem_connection_1.AtemStateUtil.getMediaPlayer(deviceState, mapping.options.index);
                                if (ms)
                                    deepExtend(ms, content.mediaPlayer);
                            }
                            break;
                        case timeline_state_resolver_types_1.MappingAtemType.AudioChannel:
                            if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.AUDIOCHANNEL) {
                                const chan = deviceState.audio?.channels[mapping.options.index];
                                if (chan && deviceState.audio) {
                                    deviceState.audio.channels[mapping.options.index] = {
                                        ...chan,
                                        ...content.audioChannel,
                                    };
                                }
                            }
                            break;
                        case timeline_state_resolver_types_1.MappingAtemType.AudioRouting:
                            if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.AUDIOROUTING) {
                                // lazily generate the state properties, to make this be opt in per-mapping
                                if (!deviceState.fairlight)
                                    deviceState.fairlight = {
                                        inputs: {},
                                    };
                                if (!deviceState.fairlight.audioRouting)
                                    deviceState.fairlight.audioRouting = {
                                        sources: {},
                                        outputs: {},
                                    };
                                deviceState.fairlight.audioRouting.outputs[mapping.options.index] = {
                                    // readonly props, they won't be diffed
                                    audioOutputId: mapping.options.index,
                                    audioChannelPair: 0,
                                    externalPortType: 0,
                                    internalPortType: 0,
                                    // mutable props
                                    name: `Output ${mapping.options.index}`,
                                    ...content.audioRouting,
                                };
                            }
                            break;
                    }
                }
                if (mapping.options.mappingType === timeline_state_resolver_types_1.MappingAtemType.MacroPlayer) {
                    if (content.type === timeline_state_resolver_types_1.TimelineContentTypeAtem.MACROPLAYER) {
                        const ms = deviceState.macro.macroPlayer;
                        if (ms)
                            deepExtend(ms, content.macroPlayer);
                    }
                }
            }
        });
        return deviceState;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.ATEM;
    }
    get deviceName() {
        return 'Atem ' + this.deviceId;
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    /**
     * Check status and return it with useful messages appended.
     */
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        if (statusCode === device_1.StatusCode.GOOD) {
            if (!this._connected) {
                statusCode = device_1.StatusCode.BAD;
                messages.push(`Atem disconnected`);
            }
        }
        if (statusCode === device_1.StatusCode.GOOD) {
            const psus = this._atemStatus.psus;
            _.each(psus, (psu, i) => {
                if (!psu) {
                    statusCode = device_1.StatusCode.WARNING_MAJOR;
                    messages.push(`Atem PSU ${i + 1} is faulty. The device has ${psus.length} PSU(s) in total.`);
                }
            });
        }
        if (!this._initialized) {
            statusCode = device_1.StatusCode.BAD;
            messages.push(`ATEM device connection not initialized (restart required)`);
        }
        const deviceStatus = {
            statusCode: statusCode,
            messages: messages,
            active: this.isActive,
        };
        return deviceStatus;
    }
    /**
     * Add commands to queue, to be executed at the right time
     */
    _addToQueue(commandsToAchieveState, time) {
        _.each(commandsToAchieveState, (cmd) => {
            // add the new commands to the queue:
            this._doOnTime.queue(time, undefined, async (cmd) => {
                return this._commandReceiver(time, cmd.command, cmd.context, cmd.timelineObjId);
            }, cmd);
        });
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     * @param oldAtemState
     * @param newAtemState
     */
    _diffStates(oldAtemState, newAtemState, mappings) {
        // Ensure the state diffs the correct version
        if (this._atem.state) {
            this._state.version = this._atem.state.info.apiVersion;
        }
        // bump out any auxes that we don't control as they may be used for CC etc.
        const noOfAuxes = Math.max(oldAtemState.video.auxilliaries.length, newAtemState.video.auxilliaries.length);
        const auxMappings = Object.values(mappings)
            .filter((mapping) => mapping.options.mappingType === timeline_state_resolver_types_1.MappingAtemType.Auxilliary)
            .map((mapping) => mapping.options.index);
        for (let i = 0; i < noOfAuxes; i++) {
            if (!auxMappings.includes(i)) {
                oldAtemState.video.auxilliaries[i] = undefined;
                newAtemState.video.auxilliaries[i] = undefined;
            }
        }
        const diffCommands = this._state.diffStates(oldAtemState, newAtemState);
        return diffCommands.map((cmd) => {
            return {
                command: cmd,
                context: null,
                timelineObjId: '', // @todo: implement in Atem-state
            };
        });
    }
    async _defaultCommandReceiver(_time, command, context, timelineObjId) {
        const cwc = {
            context: context,
            command: command,
            timelineObjId: timelineObjId,
        };
        this.emitDebug(cwc);
        return this._atem
            .sendCommand(command)
            .then(() => {
            // @todo: command was acknowledged by atem, how will we check if it did what we wanted?
        })
            .catch((error) => {
            this.emit('commandError', error, cwc);
        });
    }
    _onAtemStateChanged(newState) {
        const psus = newState.info.power || [];
        if (!_.isEqual(this._atemStatus.psus, psus)) {
            this._atemStatus.psus = _.clone(psus);
            this._connectionChanged();
        }
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
    _isAssignableToNextStyle(transition) {
        return (transition !== undefined && transition !== timeline_state_resolver_types_1.AtemTransitionStyle.DUMMY && transition !== timeline_state_resolver_types_1.AtemTransitionStyle.CUT);
    }
}
exports.AtemDevice = AtemDevice;
//# sourceMappingURL=index.js.map