"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuantelDevice = exports.QuantelCommandType = void 0;
const _ = require("underscore");
const device_1 = require("./../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("../../devices/doOnTime");
const tv_automation_quantel_gateway_client_1 = require("tv-automation-quantel-gateway-client");
const lib_1 = require("../../lib");
const connection_1 = require("./connection");
const types_1 = require("./types");
Object.defineProperty(exports, "QuantelCommandType", { enumerable: true, get: function () { return types_1.QuantelCommandType; } });
const IDEAL_PREPARE_TIME = 1000;
const PREPARE_TIME_WAIT = 50;
/**
 * This class is used to interface with a Quantel-gateway,
 * https://github.com/nrkno/tv-automation-quantel-gateway
 *
 * This device behaves a little bit different than the others, because a play-command is
 * a two-step rocket.
 * This is why the commands generated by the state-diff is not one-to-one related to the
 * actual commands sent to the Quantel-gateway.
 */
class QuantelDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._disconnectedSince = undefined;
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver)
                this._commandReceiver = deviceOptions.commandReceiver;
            else
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
        }
        this._quantel = new tv_automation_quantel_gateway_client_1.QuantelGateway();
        this._quantel.on('error', (e) => this.emit('error', 'Quantel.QuantelGateway', e));
        this._quantelManager = new connection_1.QuantelManager(this._quantel, () => this.getCurrentTime(), {
            allowCloneClips: deviceOptions.options?.allowCloneClips,
        });
        this._quantelManager.on('info', (x) => this.emit('info', `Quantel: ${typeof x === 'string' ? x : JSON.stringify(x)}`));
        this._quantelManager.on('warning', (x) => this.emit('warning', `Quantel: ${typeof x === 'string' ? x : JSON.stringify(x)}`));
        this._quantelManager.on('error', (e) => this.emit('error', 'Quantel: ', e));
        this._quantelManager.on('debug', (...args) => this.emitDebug(...args));
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.IN_ORDER, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'Quantel');
        this._doOnTimeBurst = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.BURST, this._deviceOptions);
        this.handleDoOnTime(this._doOnTimeBurst, 'Quantel.burst');
    }
    async init(initOptions) {
        this._initOptions = initOptions;
        const ISAUrlMaster = this._initOptions.ISAUrlMaster || this._initOptions['ISAUrl']; // tmp: ISAUrl for backwards compatibility, to be removed later
        if (!this._initOptions.gatewayUrl)
            throw new Error('Quantel bad connection option: gatewayUrl');
        if (!ISAUrlMaster)
            throw new Error('Quantel bad connection option: ISAUrlMaster');
        if (!this._initOptions.serverId)
            throw new Error('Quantel bad connection option: serverId');
        const isaURLs = [];
        if (ISAUrlMaster)
            isaURLs.push(ISAUrlMaster);
        if (this._initOptions.ISAUrlBackup)
            isaURLs.push(this._initOptions.ISAUrlBackup);
        await this._quantel.init(this._initOptions.gatewayUrl, isaURLs, this._initOptions.zoneId, this._initOptions.serverId);
        this._quantel.monitorServerStatus((connected) => {
            if (!this._disconnectedSince && connected === false && initOptions.suppressDisconnectTime) {
                this._disconnectedSince = Date.now();
                // trigger another update after debounce
                setTimeout(() => {
                    if (!this._quantel.connected) {
                        this._connectionChanged();
                    }
                }, initOptions.suppressDisconnectTime);
            }
            else if (connected === true) {
                this._disconnectedSince = undefined;
            }
            this._connectionChanged();
        });
        return true;
    }
    /**
     * Terminates the device safely such that things can be garbage collected.
     */
    async terminate() {
        this._quantel.dispose();
        this._doOnTime.dispose();
        return true;
    }
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime) {
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(newStateTime);
        this.cleanUpStates(0, newStateTime);
    }
    /**
     * Generates an array of Quantel commands by comparing the newState against the oldState, or the current device state.
     */
    handleState(newState, newMappings) {
        super.onHandleState(newState, newMappings);
        // check if initialized:
        if (!this._quantel.initialized) {
            this.emit('warning', 'Quantel not initialized yet');
            return;
        }
        this._quantel.setMonitoredPorts(this._getMappedPorts(newMappings));
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldQuantelState = (this.getStateBefore(previousStateTime) || { state: { time: 0, port: {} } })
            .state;
        const convertTrace = (0, lib_1.startTrace)(`device:convertState`, { deviceId: this.deviceId });
        const newQuantelState = this.convertStateToQuantel(newState, newMappings);
        this.emit('timeTrace', (0, lib_1.endTrace)(convertTrace));
        // let oldQuantelState = this.convertStateToQuantel(oldState)
        const diffTrace = (0, lib_1.startTrace)(`device:diffState`, { deviceId: this.deviceId });
        const commandsToAchieveState = this._diffStates(oldQuantelState, newQuantelState, newState.time);
        this.emit('timeTrace', (0, lib_1.endTrace)(diffTrace));
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue
        this._addToQueue(commandsToAchieveState);
        // store the new state, for later use:
        this.setState(newQuantelState, newState.time);
    }
    /**
     * Attempts to restart the gateway
     */
    async restartGateway() {
        if (this._quantel.connected) {
            return this._quantel.kill();
        }
        else {
            throw new Error('Quantel Gateway not connected');
        }
    }
    async executeAction(actionId, _payload) {
        switch (actionId) {
            case timeline_state_resolver_types_1.QuantelActions.RestartGateway:
                try {
                    await this.restartGateway();
                    return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok };
                }
                catch {
                    return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error };
                }
            case timeline_state_resolver_types_1.QuantelActions.ClearStates:
                this.clearStates();
                return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok };
            default:
                return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok, response: (0, lib_1.t)('Action "{{id}}" not found', { actionId }) };
        }
    }
    /**
     * Clear any scheduled commands after this time
     * @param clearAfterTime
     */
    clearFuture(clearAfterTime) {
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    get canConnect() {
        return true;
    }
    get connected() {
        return this._quantel.connected;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.QUANTEL;
    }
    get deviceName() {
        try {
            return `Quantel ${this._quantel.ISAUrl}/${this._quantel.zoneId}/${this._quantel.serverId}`;
        }
        catch (e) {
            return `Quantel device (uninitialized)`;
        }
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    _getMappedPorts(mappings) {
        const ports = {};
        _.each(mappings, (mapping) => {
            if (mapping &&
                mapping.device === timeline_state_resolver_types_1.DeviceType.QUANTEL &&
                mapping.deviceId === this.deviceId &&
                _.has(mapping.options, 'portId') &&
                _.has(mapping.options, 'channelId')) {
                const qMapping = mapping;
                if (!ports[qMapping.options.portId]) {
                    ports[qMapping.options.portId] = {
                        mode: qMapping.options.mode || timeline_state_resolver_types_1.QuantelControlMode.QUALITY,
                        channels: [],
                    };
                }
                ports[qMapping.options.portId].channels = _.sortBy(_.uniq(ports[qMapping.options.portId].channels.concat([qMapping.options.channelId])));
            }
        });
        return ports;
    }
    /**
     * Takes a timeline state and returns a Quantel State that will work with the state lib.
     * @param timelineState The timeline state to generate from.
     */
    convertStateToQuantel(timelineState, mappings) {
        const state = {
            time: timelineState.time,
            port: {},
        };
        // create ports from mappings:
        _.each(this._getMappedPorts(mappings), (port, portId) => {
            state.port[portId] = {
                channels: port.channels,
                timelineObjId: '',
                mode: port.mode,
                lookahead: false,
            };
        });
        _.each(timelineState.layers, (layer, layerName) => {
            const layerExt = layer;
            let foundMapping = mappings[layerName];
            let isLookahead = false;
            if (!foundMapping && layerExt.isLookahead && layerExt.lookaheadForLayer) {
                foundMapping = mappings[layerExt.lookaheadForLayer];
                isLookahead = true;
            }
            if (foundMapping &&
                foundMapping.device === timeline_state_resolver_types_1.DeviceType.QUANTEL &&
                foundMapping.deviceId === this.deviceId &&
                _.has(foundMapping.options, 'portId') &&
                _.has(foundMapping.options, 'channelId')) {
                const mapping = foundMapping;
                if (!mapping)
                    throw new Error(`Mapping "${layerName}" not found`);
                const port = state.port[mapping.options.portId];
                if (!port)
                    throw new Error(`Port "${mapping.options.portId}" not found`);
                const content = layer.content;
                if (content && (content.title || content.guid)) {
                    // Note on lookaheads:
                    // If there is ONLY a lookahead on a port, it'll be treated as a "paused (real) clip"
                    // If there is a lookahead alongside the a real clip, its fragments will be preloaded
                    if (isLookahead) {
                        port.lookaheadClip = {
                            title: content.title,
                            guid: content.guid,
                            timelineObjId: layer.id,
                        };
                    }
                    if (isLookahead && port.clip) {
                        // There is already a non-lookahead on the port
                        // Do nothing more with this then
                    }
                    else {
                        const startTime = layer.instance.originalStart || layer.instance.start;
                        port.timelineObjId = layer.id;
                        port.notOnAir = content.notOnAir || isLookahead;
                        port.outTransition = content.outTransition;
                        port.lookahead = isLookahead;
                        port.clip = {
                            title: content.title,
                            guid: content.guid,
                            // clipId // set later
                            pauseTime: content.pauseTime,
                            playing: isLookahead ? false : content.playing ?? true,
                            inPoint: content.inPoint,
                            length: content.length,
                            playTime: (content.noStarttime || isLookahead ? null : startTime) || null,
                        };
                    }
                }
            }
        });
        return state;
    }
    /**
     * Prepares the physical device for playout.
     * @param okToDestroyStuff Whether it is OK to do things that affects playout visibly
     */
    async makeReady(okToDestroyStuff) {
        if (okToDestroyStuff) {
            // release and re-claim all ports:
            // TODO
        }
        // reset our own state(s):
        if (okToDestroyStuff) {
            this.clearStates();
        }
    }
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        const suppressServerDownWarning = Date.now() < (this._disconnectedSince ?? 0) + (this._initOptions?.suppressDisconnectTime ?? 0);
        if (!this._quantel.connected && !suppressServerDownWarning) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not connected');
        }
        if (this._quantel.statusMessage && !suppressServerDownWarning) {
            statusCode = device_1.StatusCode.BAD;
            messages.push(this._quantel.statusMessage);
        }
        if (!this._quantel.initialized) {
            statusCode = device_1.StatusCode.BAD;
            messages.push(`Quantel device connection not initialized (restart required)`);
        }
        return {
            statusCode: statusCode,
            messages: messages,
            active: this.isActive,
        };
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    _diffStates(oldState, newState, time) {
        const highPrioCommands = [];
        const lowPrioCommands = [];
        const addCommand = (command, lowPriority) => {
            ;
            (lowPriority ? lowPrioCommands : highPrioCommands).push(command);
        };
        const seenClips = {};
        const loadFragments = (portId, port, clip, timelineObjId, isPreloading) => {
            // Only load identical fragments once:
            const clipIdentifier = `${portId}:${clip.clipId}_${clip.guid}_${clip.title}`;
            if (!seenClips[clipIdentifier]) {
                seenClips[clipIdentifier] = true;
                addCommand({
                    type: types_1.QuantelCommandType.LOADCLIPFRAGMENTS,
                    time: prepareTime,
                    portId: portId,
                    timelineObjId: timelineObjId,
                    fromLookahead: isPreloading || port.lookahead,
                    clip: clip,
                    timeOfPlay: time,
                    allowedToPrepareJump: !isPreloading,
                }, isPreloading || port.lookahead);
            }
        };
        /** The time of when to run "preparation" commands */
        let prepareTime = Math.min(time, Math.max(time - IDEAL_PREPARE_TIME, oldState.time + PREPARE_TIME_WAIT // earliset possible prepareTime
        ));
        if (prepareTime < this.getCurrentTime()) {
            // Only to not emit an unnessesary slowCommand event
            prepareTime = this.getCurrentTime();
        }
        if (time < prepareTime) {
            prepareTime = time - 10;
        }
        const lookaheadPreloadClips = [];
        _.each(newState.port, (newPort, portId) => {
            const oldPort = oldState.port[portId];
            if (!oldPort || !_.isEqual(newPort.channels, oldPort.channels)) {
                const channel = newPort.channels[0];
                if (channel !== undefined) {
                    // todo: support for multiple channels
                    addCommand({
                        type: types_1.QuantelCommandType.SETUPPORT,
                        time: prepareTime,
                        portId: portId,
                        timelineObjId: newPort.timelineObjId,
                        channel: channel,
                    }, newPort.lookahead);
                }
            }
            if (!oldPort || !_.isEqual(newPort.clip, oldPort.clip)) {
                if (newPort.clip) {
                    // Load (and play) the clip:
                    let transition;
                    if (oldPort && !oldPort.notOnAir && newPort.notOnAir) {
                        // When the previous content was on-air, we use the out-transition (so that mix-effects look good).
                        // But when the previous content wasn't on-air, we don't wan't to use the out-transition (for example; when cuing previews)
                        transition = oldPort.outTransition;
                    }
                    loadFragments(portId, newPort, newPort.clip, newPort.timelineObjId, false);
                    if (newPort.clip.playing) {
                        addCommand({
                            type: types_1.QuantelCommandType.PLAYCLIP,
                            time: time,
                            portId: portId,
                            timelineObjId: newPort.timelineObjId,
                            fromLookahead: newPort.lookahead,
                            clip: newPort.clip,
                            mode: newPort.mode,
                            transition: transition,
                        }, newPort.lookahead);
                    }
                    else {
                        addCommand({
                            type: types_1.QuantelCommandType.PAUSECLIP,
                            time: time,
                            portId: portId,
                            timelineObjId: newPort.timelineObjId,
                            fromLookahead: newPort.lookahead,
                            clip: newPort.clip,
                            mode: newPort.mode,
                            transition: transition,
                        }, newPort.lookahead);
                    }
                }
                else {
                    addCommand({
                        type: types_1.QuantelCommandType.CLEARCLIP,
                        time: time,
                        portId: portId,
                        timelineObjId: newPort.timelineObjId,
                        fromLookahead: newPort.lookahead,
                        transition: oldPort && oldPort.outTransition,
                    }, newPort.lookahead);
                }
            }
            if (!oldPort || !_.isEqual(newPort.lookaheadClip, oldPort.lookaheadClip)) {
                if (newPort.lookaheadClip &&
                    (!newPort.clip ||
                        newPort.lookaheadClip.clipId !== newPort.clip.clipId ||
                        newPort.lookaheadClip.title !== newPort.clip.title ||
                        newPort.lookaheadClip.guid !== newPort.clip.guid)) {
                    // Also preload lookaheads later:
                    lookaheadPreloadClips.push({
                        portId: portId,
                        port: newPort,
                        clip: {
                            ...newPort.lookaheadClip,
                            playTime: 0,
                            playing: false,
                        },
                        timelineObjId: newPort.lookaheadClip.timelineObjId,
                    });
                }
            }
        });
        _.each(oldState.port, (oldPort, portId) => {
            const newPort = newState.port[portId];
            if (!newPort) {
                // removed port
                addCommand({
                    type: types_1.QuantelCommandType.RELEASEPORT,
                    time: prepareTime,
                    portId: portId,
                    timelineObjId: oldPort.timelineObjId,
                    fromLookahead: oldPort.lookahead,
                }, oldPort.lookahead);
            }
        });
        // console.log('lookaheadPreloadClips', lookaheadPreloadClips)
        // Lookaheads to preload:
        _.each(lookaheadPreloadClips, (lookaheadPreloadClip) => {
            // Preloads of lookaheads are handled last, to ensure that any load-fragments of high-prio clips are done first.
            loadFragments(lookaheadPreloadClip.portId, lookaheadPreloadClip.port, lookaheadPreloadClip.clip, lookaheadPreloadClip.timelineObjId, true);
        });
        const allCommands = highPrioCommands.concat(lowPrioCommands);
        allCommands.sort((a, b) => {
            // Release ports should always be done first:
            if (a.type === types_1.QuantelCommandType.RELEASEPORT && b.type !== types_1.QuantelCommandType.RELEASEPORT)
                return -1;
            if (a.type !== types_1.QuantelCommandType.RELEASEPORT && b.type === types_1.QuantelCommandType.RELEASEPORT)
                return 1;
            return 0;
        });
        return allCommands;
    }
    async _doCommand(command, context, timlineObjId) {
        const time = this.getCurrentTime();
        return this._commandReceiver(time, command, context, timlineObjId);
    }
    /**
     * Add commands to queue, to be executed at the right time
     */
    _addToQueue(commandsToAchieveState) {
        _.each(commandsToAchieveState, (cmd) => {
            this._doOnTime.queue(cmd.time, cmd.portId, async (c) => {
                return this._doCommand(c.cmd, c.cmd.type + '_' + c.cmd.timelineObjId, c.cmd.timelineObjId);
            }, { cmd: cmd });
            this._doOnTimeBurst.queue(cmd.time, undefined, async (c) => {
                if ((c.cmd.type === types_1.QuantelCommandType.PLAYCLIP || c.cmd.type === types_1.QuantelCommandType.PAUSECLIP) &&
                    !c.cmd.fromLookahead) {
                    this._quantelManager.clearAllWaitWithPort(c.cmd.portId);
                }
                return Promise.resolve();
            }, { cmd: cmd });
        });
    }
    /**
     * Sends commands to the Quantel ISA server
     * @param time deprecated
     * @param cmd Command to execute
     */
    async _defaultCommandReceiver(_time, cmd, context, timelineObjId) {
        const cwc = {
            context: context,
            timelineObjId: timelineObjId,
            command: cmd,
        };
        this.emitDebug(cwc);
        try {
            const cmdType = cmd.type;
            if (cmd.type === types_1.QuantelCommandType.SETUPPORT) {
                await this._quantelManager.setupPort(cmd);
            }
            else if (cmd.type === types_1.QuantelCommandType.RELEASEPORT) {
                await this._quantelManager.releasePort(cmd);
            }
            else if (cmd.type === types_1.QuantelCommandType.LOADCLIPFRAGMENTS) {
                await this._quantelManager.tryLoadClipFragments(cmd);
            }
            else if (cmd.type === types_1.QuantelCommandType.PLAYCLIP) {
                await this._quantelManager.playClip(cmd);
            }
            else if (cmd.type === types_1.QuantelCommandType.PAUSECLIP) {
                await this._quantelManager.pauseClip(cmd);
            }
            else if (cmd.type === types_1.QuantelCommandType.CLEARCLIP) {
                await this._quantelManager.clearClip(cmd);
                this.getCurrentTime();
            }
            else {
                throw new Error(`Unsupported command type "${cmdType}"`);
            }
        }
        catch (e) {
            const error = e;
            let errorString = error && error.message ? error.message : error.toString();
            if (error?.stack) {
                errorString += error.stack;
            }
            this.emit('commandError', new Error(errorString), cwc);
        }
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
}
exports.QuantelDevice = QuantelDevice;
//# sourceMappingURL=index.js.map