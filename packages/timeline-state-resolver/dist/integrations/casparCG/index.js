"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CasparCGDevice = void 0;
const _ = require("underscore");
const deepMerge = require("deepmerge");
const device_1 = require("../../devices/device");
const casparcg_connection_1 = require("casparcg-connection");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const casparcg_state_1 = require("casparcg-state");
const doOnTime_1 = require("../../devices/doOnTime");
const got_1 = require("got");
const transitionHandler_1 = require("../../devices/transitions/transitionHandler");
const debug_1 = require("debug");
const lib_1 = require("../../lib");
const debug = (0, debug_1.default)('timeline-state-resolver:casparcg');
const MEDIA_RETRY_INTERVAL = 10 * 1000; // default time in ms between checking whether a file needs to be retried loading
/**
 * This class is used to interface with CasparCG installations. It creates
 * device states from timeline states and then diffs these states to generate
 * commands. It depends on the DoOnTime class to execute the commands timely or,
 * optionally, uses the CasparCG command scheduling features.
 */
class CasparCGDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._connected = false;
        this._queueOverflow = false;
        this._transitionHandler = new transitionHandler_1.InternalTransitionHandler();
        this._retryTime = null;
        this._currentState = { channels: {} };
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver)
                this._commandReceiver = deviceOptions.commandReceiver;
            else
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
        }
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.BURST, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'CasparCG');
    }
    /**
     * Initiates the connection with CasparCG through the ccg-connection lib and
     * initializes CasparCG State library.
     */
    async init(initOptions) {
        this.initOptions = initOptions;
        this._ccg = new casparcg_connection_1.BasicCasparCGAPI({
            host: initOptions.host,
            port: initOptions.port,
        });
        this._ccg.on('connect', () => {
            this.makeReady(false) // always make sure timecode is correct, setting it can never do bad
                .catch((e) => this.emit('error', 'casparCG.makeReady', e));
            Promise.resolve()
                .then(async () => {
                if (this.deviceOptions.skipVirginCheck)
                    return false;
                // a "virgin server" was just restarted (so it is cleared & black).
                // Otherwise it was probably just a loss of connection
                const { error, request } = await this._ccg.executeCommand({ command: casparcg_connection_1.Commands.Info, params: {} });
                if (error)
                    return true;
                const response = await request;
                const channelPromises = [];
                const channelLength = response?.data?.['length'] ?? 0;
                // Issue commands
                for (let i = 1; i <= channelLength; i++) {
                    // 1-based index for channels
                    const { error, request } = await this._ccg.executeCommand({
                        command: casparcg_connection_1.Commands.InfoChannel,
                        params: { channel: i },
                    });
                    if (error) {
                        // We can't return here, as that will leave anything in channelPromises as potentially unhandled
                        channelPromises.push(Promise.reject('execute failed'));
                        break;
                    }
                    channelPromises.push(request);
                }
                // Wait for all commands
                const channelResults = await Promise.all(channelPromises);
                // Resync if all channels have no stage object (no possibility of anything playing)
                return !channelResults.find((ch) => ch.data?.['stage']);
            })
                .catch((e) => {
                this.emit('error', 'connect virgin check failed', e);
                // Something failed, force the resync as glitching playback is better than black output
                return true;
            })
                .then((doResync) => {
                // Finally we can report it as connected
                this._connected = true;
                this._connectionChanged();
                if (doResync) {
                    this._currentState = { channels: {} };
                    this.clearStates();
                    this.emit('resetResolver');
                }
            })
                .catch((e) => {
                this.emit('error', 'connect state resync failed', e);
                // Some unknwon error occured, report the connection as failed
                this._connected = false;
                this._connectionChanged();
            });
        });
        this._ccg.on('disconnect', () => {
            this._connected = false;
            this._connectionChanged();
        });
        const { error, request } = await this._ccg.executeCommand({ command: casparcg_connection_1.Commands.Info, params: {} });
        if (error) {
            return false; // todo - should this throw?
        }
        const response = await request;
        if (response?.data[0]) {
            response.data.forEach((obj) => {
                this._currentState.channels[obj.channel] = {
                    channelNo: obj.channel,
                    videoMode: obj.format.toUpperCase(),
                    fps: obj.frameRate,
                    layers: {},
                };
            });
        }
        else {
            return false; // not being able to get channel count is a problem for us
        }
        if (typeof initOptions.retryInterval === 'number' && initOptions.retryInterval >= 0) {
            this._retryTime = initOptions.retryInterval || MEDIA_RETRY_INTERVAL;
            this._retryTimeout = setTimeout(() => this._assertIntendedState(), this._retryTime);
        }
        return true;
    }
    /**
     * Terminates the device safely such that things can be garbage collected.
     */
    async terminate() {
        this._doOnTime.dispose();
        this._transitionHandler.terminate();
        clearTimeout(this._retryTimeout);
        return new Promise((resolve) => {
            if (!this._ccg) {
                resolve(true);
                return;
            }
            else if (!this._ccg.connected) {
                this._ccg.once('disconnect', () => {
                    resolve(true);
                    this._ccg.removeAllListeners();
                });
                this._ccg.disconnect();
            }
            else {
                this._ccg.removeAllListeners();
                resolve(true);
            }
        });
    }
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime) {
        // Clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(newStateTime);
        this.cleanUpStates(0, newStateTime);
    }
    /**
     * Generates an array of CasparCG commands by comparing the newState against the oldState, or the current device state.
     */
    handleState(newState, newMappings) {
        super.onHandleState(newState, newMappings);
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldCasparState = (this.getStateBefore(previousStateTime) || { state: { channels: {} } }).state;
        const convertTrace = (0, lib_1.startTrace)(`device:convertState`, { deviceId: this.deviceId });
        const newCasparState = this.convertStateToCaspar(newState, newMappings);
        this.emit('timeTrace', (0, lib_1.endTrace)(convertTrace));
        const diffTrace = (0, lib_1.startTrace)(`device:diffState`, { deviceId: this.deviceId });
        const commandsToAchieveState = casparcg_state_1.CasparCGState.diffStatesOrderedCommands(oldCasparState, newCasparState, newState.time);
        this.emit('timeTrace', (0, lib_1.endTrace)(diffTrace));
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newCasparState, newState.time);
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
        // Returns connection status
        return this._ccg ? this._ccg.connected : false;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.CASPARCG;
    }
    get deviceName() {
        if (this._ccg) {
            return 'CasparCG ' + this.deviceId + ' ' + this._ccg.host + ':' + this._ccg.port;
        }
        else {
            return 'Uninitialized CasparCG ' + this.deviceId;
        }
    }
    convertObjectToCasparState(mappings, layer, mapping, isForeground) {
        let startTime = layer.instance.originalStart || layer.instance.start;
        if (startTime === 0)
            startTime = 1; // @todo: startTime === 0 will make ccg-state seek to the current time
        const layerProps = layer;
        const content = layer.content;
        let stateLayer = null;
        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeCasparCg.MEDIA) {
            const holdOnFirstFrame = !isForeground || layerProps.isLookahead;
            const loopingPlayTime = content.loop && !content.seek && !content.inPoint && !content.length;
            stateLayer = (0, device_1.literal)({
                id: layer.id,
                layerNo: mapping.layer,
                content: casparcg_state_1.LayerContentType.MEDIA,
                media: content.file,
                playTime: !holdOnFirstFrame && (content.noStarttime || loopingPlayTime) ? null : startTime,
                pauseTime: holdOnFirstFrame ? startTime : content.pauseTime || null,
                playing: !layerProps.isLookahead && (content.playing !== undefined ? content.playing : isForeground),
                looping: content.loop,
                seek: content.seek,
                inPoint: content.inPoint,
                length: content.length,
                channelLayout: content.channelLayout,
                clearOn404: true,
                vfilter: content.videoFilter,
                afilter: content.audioFilter,
            });
            // this.emitDebug(stateLayer)
        }
        else if (content.type === timeline_state_resolver_types_1.TimelineContentTypeCasparCg.IP) {
            stateLayer = (0, device_1.literal)({
                id: layer.id,
                layerNo: mapping.layer,
                content: casparcg_state_1.LayerContentType.MEDIA,
                media: content.uri,
                channelLayout: content.channelLayout,
                playTime: null,
                playing: true,
                seek: 0,
                vfilter: content.videoFilter,
                afilter: content.audioFilter,
            });
        }
        else if (content.type === timeline_state_resolver_types_1.TimelineContentTypeCasparCg.INPUT) {
            stateLayer = (0, device_1.literal)({
                id: layer.id,
                layerNo: mapping.layer,
                content: casparcg_state_1.LayerContentType.INPUT,
                media: 'decklink',
                input: {
                    device: content.device,
                    channelLayout: content.channelLayout,
                    format: content.deviceFormat,
                },
                playing: true,
                playTime: null,
                vfilter: content.videoFilter || content.filter,
                afilter: content.audioFilter,
            });
        }
        else if (content.type === timeline_state_resolver_types_1.TimelineContentTypeCasparCg.TEMPLATE) {
            stateLayer = (0, device_1.literal)({
                id: layer.id,
                layerNo: mapping.layer,
                content: casparcg_state_1.LayerContentType.TEMPLATE,
                media: content.name,
                playTime: startTime || null,
                playing: true,
                templateType: content.templateType || 'html',
                templateData: content.data,
                cgStop: content.useStopCommand,
            });
        }
        else if (content.type === timeline_state_resolver_types_1.TimelineContentTypeCasparCg.HTMLPAGE) {
            stateLayer = (0, device_1.literal)({
                id: layer.id,
                layerNo: mapping.layer,
                content: casparcg_state_1.LayerContentType.HTMLPAGE,
                media: content.url,
                playTime: startTime || null,
                playing: true,
            });
        }
        else if (content.type === timeline_state_resolver_types_1.TimelineContentTypeCasparCg.ROUTE) {
            if (content.mappedLayer) {
                const routeMapping = mappings[content.mappedLayer];
                if (routeMapping && routeMapping.deviceId === this.deviceId) {
                    content.channel = routeMapping.options.channel;
                    content.layer = routeMapping.options.layer;
                }
            }
            stateLayer = (0, device_1.literal)({
                id: layer.id,
                layerNo: mapping.layer,
                content: casparcg_state_1.LayerContentType.ROUTE,
                media: 'route',
                route: {
                    channel: content.channel || 0,
                    layer: content.layer,
                    channelLayout: content.channelLayout,
                },
                mode: content.mode || undefined,
                delay: content.delay || undefined,
                playing: true,
                playTime: null,
                vfilter: content.videoFilter,
                afilter: content.audioFilter,
            });
        }
        else if (content.type === timeline_state_resolver_types_1.TimelineContentTypeCasparCg.RECORD) {
            if (startTime) {
                stateLayer = (0, device_1.literal)({
                    id: layer.id,
                    layerNo: mapping.layer,
                    content: casparcg_state_1.LayerContentType.RECORD,
                    media: content.file,
                    encoderOptions: content.encoderOptions,
                    playing: true,
                    playTime: startTime,
                });
            }
        }
        // if no appropriate layer could be created, make it an empty layer
        if (!stateLayer) {
            const l = {
                id: layer.id,
                layerNo: mapping.layer,
                content: casparcg_state_1.LayerContentType.NOTHING,
                playing: false,
            };
            stateLayer = l;
        } // now it holds that stateLayer is truthy
        const baseContent = content;
        if (baseContent.transitions) {
            // add transitions to the layer obj
            switch (baseContent.type) {
                case timeline_state_resolver_types_1.TimelineContentTypeCasparCg.MEDIA:
                case timeline_state_resolver_types_1.TimelineContentTypeCasparCg.IP:
                case timeline_state_resolver_types_1.TimelineContentTypeCasparCg.TEMPLATE:
                case timeline_state_resolver_types_1.TimelineContentTypeCasparCg.INPUT:
                case timeline_state_resolver_types_1.TimelineContentTypeCasparCg.ROUTE:
                case timeline_state_resolver_types_1.TimelineContentTypeCasparCg.HTMLPAGE: {
                    // create transition object
                    const media = stateLayer.media;
                    const transitions = {};
                    if (baseContent.transitions.inTransition) {
                        transitions.inTransition = new casparcg_state_1.Transition(baseContent.transitions.inTransition);
                    }
                    if (baseContent.transitions.outTransition) {
                        transitions.outTransition = new casparcg_state_1.Transition(baseContent.transitions.outTransition);
                    }
                    // todo - not a fan of this type assertion but think it's ok
                    stateLayer.media = new casparcg_state_1.TransitionObject(media, {
                        inTransition: transitions.inTransition,
                        outTransition: transitions.outTransition,
                    });
                    break;
                }
                default:
                    // create transition using mixer
                    break;
            }
        }
        if ('mixer' in content && content.mixer) {
            // add mixer properties
            // just pass through values here:
            const mixer = {};
            _.each(content.mixer, (value, property) => {
                mixer[property] = value;
            });
            stateLayer.mixer = mixer;
        }
        stateLayer.layerNo = mapping.layer;
        return stateLayer;
    }
    /**
     * Takes a timeline state and returns a CasparCG State that will work with the state lib.
     * @param timelineState The timeline state to generate from.
     */
    convertStateToCaspar(timelineState, mappings) {
        const caspar = {
            channels: {},
        };
        _.each(mappings, (foundMapping, layerName) => {
            if (foundMapping &&
                foundMapping.device === timeline_state_resolver_types_1.DeviceType.CASPARCG &&
                foundMapping.deviceId === this.deviceId &&
                _.has(foundMapping.options, 'channel') &&
                _.has(foundMapping.options, 'layer')) {
                const mapping = foundMapping;
                mapping.options.channel = Number(mapping.options.channel) || 1;
                mapping.options.layer = Number(mapping.options.layer) || 0;
                // create a channel in state if necessary, or reuse existing channel
                const channel = caspar.channels[mapping.options.channel] || { channelNo: mapping.options.channel, layers: {} };
                channel.channelNo = mapping.options.channel;
                channel.fps = this.initOptions ? this.initOptions.fps || 25 : 25;
                caspar.channels[channel.channelNo] = channel;
                let foregroundObj = timelineState.layers[layerName];
                let backgroundObj = _.last(_.filter(timelineState.layers, (obj) => {
                    // Takes the last one, to be consistent with previous behaviour
                    const objExt = obj;
                    return !!objExt.isLookahead && objExt.lookaheadForLayer === layerName;
                }));
                // If lookahead is on the same layer, then ensure objects are treated as such
                if (foregroundObj && foregroundObj.isLookahead) {
                    backgroundObj = foregroundObj;
                    foregroundObj = undefined;
                }
                // create layer of appropriate type
                const foregroundStateLayer = foregroundObj
                    ? this.convertObjectToCasparState(mappings, foregroundObj, mapping.options, true)
                    : undefined;
                const backgroundStateLayer = backgroundObj
                    ? this.convertObjectToCasparState(mappings, backgroundObj, mapping.options, false)
                    : undefined;
                debug(`${layerName} (${mapping.options.channel}-${mapping.options.layer}): FG keys: ${Object.entries(foregroundStateLayer || {})
                    .map((e) => e[0] + ': ' + e[1])
                    .join(', ')}`);
                debug(`${layerName} (${mapping.options.channel}-${mapping.options.layer}): BG keys: ${Object.entries(backgroundStateLayer || {})
                    .map((e) => e[0] + ': ' + e[1])
                    .join(', ')}`);
                const merge = (o1, o2) => {
                    const o = {
                        ...o1,
                    };
                    Object.entries(o2).forEach(([key, value]) => {
                        if (value !== undefined) {
                            o[key] = value;
                        }
                    });
                    return o;
                };
                if (foregroundStateLayer) {
                    const currentTemplateData = channel.layers[mapping.options.layer]
                        ?.templateData;
                    const foregroundTemplateData = foregroundStateLayer?.templateData;
                    channel.layers[mapping.options.layer] = merge(channel.layers[mapping.options.layer], {
                        ...foregroundStateLayer,
                        ...(_.isObject(currentTemplateData) && _.isObject(foregroundTemplateData)
                            ? { templateData: deepMerge(currentTemplateData, foregroundTemplateData) }
                            : {}),
                        nextUp: backgroundStateLayer
                            ? merge((channel.layers[mapping.options.layer] || {}).nextUp, (0, device_1.literal)({
                                ...backgroundStateLayer,
                                auto: false,
                            }))
                            : undefined,
                    });
                }
                else if (backgroundStateLayer) {
                    if (mapping.options.previewWhenNotOnAir) {
                        channel.layers[mapping.options.layer] = merge(channel.layers[mapping.options.layer], {
                            ...channel.layers[mapping.options.layer],
                            ...backgroundStateLayer,
                            playing: false,
                        });
                    }
                    else {
                        channel.layers[mapping.options.layer] = merge(channel.layers[mapping.options.layer], (0, device_1.literal)({
                            id: `${backgroundStateLayer.id}_empty_base`,
                            layerNo: mapping.options.layer,
                            content: casparcg_state_1.LayerContentType.NOTHING,
                            playing: false,
                            nextUp: (0, device_1.literal)({
                                ...backgroundStateLayer,
                                auto: false,
                            }),
                        }));
                    }
                }
            }
        });
        return caspar;
    }
    /**
     * Prepares the physical device for playout. If amcp scheduling is used this
     * tries to sync the timecode. If {@code okToDestroyStuff === true} this clears
     * all channels and resets our states.
     * @param okToDestroyStuff Whether it is OK to restart the device
     */
    async makeReady(okToDestroyStuff) {
        // reset our own state(s):
        if (okToDestroyStuff) {
            await this.clearAllChannels();
        }
    }
    async clearAllChannels() {
        if (!this._ccg.connected) {
            return {
                result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                response: (0, lib_1.t)('Cannot restart CasparCG without a connection'),
            };
        }
        const { error, request } = await this._ccg.executeCommand({ command: casparcg_connection_1.Commands.Info, params: {} });
        if (error) {
            return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error };
        }
        const response = await request;
        if (!response?.data[0]) {
            return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error };
        }
        await Promise.all(response.data.map(async (_, i) => {
            await this._commandReceiver(this.getCurrentTime(), (0, device_1.literal)({
                command: casparcg_connection_1.Commands.Clear,
                params: {
                    channel: i + 1,
                },
            }), 'clearAllChannels', '');
        }));
        this.clearStates();
        this._currentState = { channels: {} };
        response.data.forEach((obj) => {
            this._currentState.channels[obj.channel] = {
                channelNo: obj.channel,
                videoMode: obj.format.toUpperCase(),
                fps: obj.frameRate,
                layers: {},
            };
        });
        this.emit('resetResolver');
        return {
            result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok,
        };
    }
    async executeAction(id) {
        switch (id) {
            case timeline_state_resolver_types_1.CasparCGActions.ClearAllChannels:
                return this.clearAllChannels();
            case timeline_state_resolver_types_1.CasparCGActions.RestartServer:
                return this.restartCasparCG();
            default:
                return {
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                    response: (0, lib_1.t)('Action "{{id}}" not found', { id }),
                };
        }
    }
    /**
     * Attemps to restart casparcg over the HTTP API provided by CasparCG launcher.
     */
    async restartCasparCG() {
        if (!this.initOptions) {
            return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error, response: (0, lib_1.t)('CasparCGDevice._connectionOptions is not set!') };
        }
        if (!this.initOptions.launcherHost) {
            return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error, response: (0, lib_1.t)('CasparCGDevice: config.launcherHost is not set!') };
        }
        if (!this.initOptions.launcherPort) {
            return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error, response: (0, lib_1.t)('CasparCGDevice: config.launcherPort is not set!') };
        }
        if (!this.initOptions.launcherProcess) {
            return {
                result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                response: (0, lib_1.t)('CasparCGDevice: config.launcherProcess is not set!'),
            };
        }
        const url = `http://${this.initOptions?.launcherHost}:${this.initOptions?.launcherPort}/processes/${this.initOptions?.launcherProcess}/restart`;
        return got_1.default
            .post(url, {
            timeout: {
                request: 5000, // Arbitary, long enough for realistic scenarios
            },
        })
            .then((response) => {
            if (response.statusCode === 200) {
                return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok };
            }
            else {
                return {
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                    response: (0, lib_1.t)('Bad reply: [{{statusCode}}] {{body}}', {
                        statusCode: response.statusCode,
                        body: response.body,
                    }),
                };
            }
        })
            .catch((error) => {
            return {
                result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                response: (0, lib_1.t)('{{message}}', {
                    message: error.toString(),
                }),
            };
        });
    }
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        if (statusCode === device_1.StatusCode.GOOD) {
            if (!this._connected) {
                statusCode = device_1.StatusCode.BAD;
                messages.push(`CasparCG disconnected`);
            }
        }
        if (this._queueOverflow) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Command queue overflow: CasparCG server has to be restarted');
        }
        return {
            statusCode: statusCode,
            messages: messages,
            active: this.isActive,
        };
    }
    /**
     * Use either AMCP Command Scheduling or the doOnTime to execute commands at
     * {@code time}.
     * @param commandsToAchieveState Commands to be added to queue
     * @param time Point in time to send commands at
     */
    _addToQueue(commandsToAchieveState, time) {
        _.each(commandsToAchieveState, (cmd) => {
            this._doOnTime.queue(time, undefined, async (c) => {
                return this._commandReceiver(time, c.command, c.cmd.context.context, c.cmd.context.layerId);
            }, { command: { command: cmd.command, params: cmd.params }, cmd: cmd });
        });
    }
    /**
     * Sends a command over a casparcg-connection instance
     * @param time deprecated
     * @param cmd Command to execute
     */
    async _defaultCommandReceiver(time, cmd, context, timelineObjId) {
        // do no retry while we are sending commands, instead always retry closely after:
        if (!context.match(/\[RETRY\]/i)) {
            clearTimeout(this._retryTimeout);
            if (this._retryTime)
                this._retryTimeout = setTimeout(() => this._assertIntendedState(), this._retryTime);
        }
        const cwc = {
            context: context,
            timelineObjId: timelineObjId,
            command: JSON.stringify(cmd),
        };
        this.emitDebug(cwc);
        const { request, error } = await this._ccg.executeCommand(cmd);
        if (error) {
            this.emit('commandError', error, cwc);
        }
        try {
            const response = await request;
            // I forgot what this means.. oh well... todo
            if (!response)
                return;
            this._changeTrackedStateFromCommand(cmd, response, time);
            if (response.responseCode === 504 && !this._queueOverflow) {
                this._queueOverflow = true;
                this._connectionChanged();
            }
            else if (this._queueOverflow) {
                this._queueOverflow = false;
                this._connectionChanged();
            }
            if (response.responseCode >= 400) {
                // this is an error code:
                let errorString = `${response.responseCode} ${cmd.command} ${response.type}: ${response.type}`;
                if (Object.keys(cmd.params).length) {
                    errorString += ' ' + JSON.stringify(cmd.params);
                }
                this.emit('commandError', new Error(errorString), cwc);
            }
        }
        catch (e) {
            // This shouldn't really happen
            this.emit('commandError', Error('Command not sent: ' + e), cwc);
        }
    }
    _changeTrackedStateFromCommand(command, response, time) {
        // Ensure this is for a channel and layer
        if (!('channel' in command.params) || command.params.channel === undefined)
            return;
        if (!('layer' in command.params) || command.params.layer === undefined)
            return;
        if (response.responseCode < 300 && // TODO - maybe we accept every code except 404?
            response.command.match(/Loadbg|Play|Load|Clear|Stop|Resume/i)) {
            const currentExpectedState = this.getState(time);
            if (currentExpectedState) {
                const confirmedState = this._currentState;
                const expectedChannelState = currentExpectedState.state.channels[command.params.channel];
                if (expectedChannelState) {
                    let confirmedChannelState = confirmedState.channels[command.params.channel];
                    if (!confirmedState.channels[command.params.channel]) {
                        confirmedChannelState = confirmedState.channels[command.params.channel] = {
                            channelNo: expectedChannelState.channelNo,
                            fps: expectedChannelState.fps || 0,
                            videoMode: expectedChannelState.videoMode || null,
                            layers: {},
                        };
                    }
                    // copy into the trackedState
                    switch (command.command) {
                        case casparcg_connection_1.Commands.Play:
                        case casparcg_connection_1.Commands.Load:
                            if (!('clip' in command.params) && !confirmedChannelState.layers[command.params.layer]?.nextUp) {
                                // Ignore, no clip was loaded in confirmedChannelState
                            }
                            else {
                                // a play/load command without parameters (channel/layer) is only succesful if the nextUp worked
                                // a play/load command with params can always be accepted
                                confirmedChannelState.layers[command.params.layer] = {
                                    ...expectedChannelState.layers[command.params.layer],
                                    nextUp: undefined, // a play command always clears nextUp
                                };
                            }
                            break;
                        case casparcg_connection_1.Commands.Loadbg:
                            // only loadbg can set nextUp and nextUp can only be set by loadbg
                            confirmedChannelState.layers[command.params.layer] = {
                                ...confirmedChannelState.layers[command.params.layer],
                                nextUp: expectedChannelState.layers[command.params.layer]?.nextUp,
                            };
                            break;
                        case casparcg_connection_1.Commands.Stop:
                            if (confirmedChannelState.layers[command.params.layer]?.nextUp?.auto) {
                                // auto next + stop means bg -> fg => nextUp cleared
                                confirmedChannelState.layers[command.params.layer] = {
                                    ...expectedChannelState.layers[command.params.layer],
                                    nextUp: undefined, // auto next + stop means bg -> fg => nextUp cleared
                                };
                            }
                            else {
                                // stop does not affect nextup
                                confirmedChannelState.layers[command.params.layer] = {
                                    ...expectedChannelState.layers[command.params.layer],
                                    nextUp: confirmedChannelState.layers[command.params.layer]?.nextUp,
                                };
                            }
                            break;
                        case casparcg_connection_1.Commands.Resume:
                            // resume does not affect nextup
                            confirmedChannelState.layers[command.params.layer] = {
                                ...expectedChannelState.layers[command.params.layer],
                                nextUp: confirmedChannelState.layers[command.params.layer]?.nextUp,
                            };
                            break;
                        case casparcg_connection_1.Commands.Clear:
                            // Remove both the background and foreground
                            delete confirmedChannelState.layers[command.params.layer];
                            break;
                        default: {
                            // Never hit
                            // const _a: never = command.params.name
                            break;
                        }
                    }
                }
            }
        }
    }
    /**
     * This function takes the current timeline-state, and diffs it with the known
     * CasparCG state. If any media has failed to load, it will create a diff with
     * the intended (timeline) state and that command will be executed.
     */
    _assertIntendedState() {
        if (this._retryTime) {
            this._retryTimeout = setTimeout(() => this._assertIntendedState(), this._retryTime);
        }
        const tlState = this.getState(this.getCurrentTime());
        if (!tlState)
            return; // no state implies any state is correct
        const ccgState = tlState.state;
        const diff = casparcg_state_1.CasparCGState.diffStates(this._currentState, ccgState, this.getCurrentTime());
        const cmd = [];
        for (const layer of diff) {
            // filter out media commands
            for (let i = 0; i < layer.cmds.length; i++) {
                if (
                // todo - shall we pass decklinks etc. as well?
                layer.cmds[i].command === casparcg_connection_1.Commands.Loadbg ||
                    layer.cmds[i].command === casparcg_connection_1.Commands.Load ||
                    (layer.cmds[i].command === casparcg_connection_1.Commands.Play && 'clip' in layer.cmds[i].params)) {
                    layer.cmds[i].context.context += ' [RETRY]';
                    cmd.push(layer.cmds[i]);
                }
            }
        }
        if (cmd.length > 0) {
            this._addToQueue(cmd, this.getCurrentTime());
        }
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
}
exports.CasparCGDevice = CasparCGDevice;
//# sourceMappingURL=index.js.map