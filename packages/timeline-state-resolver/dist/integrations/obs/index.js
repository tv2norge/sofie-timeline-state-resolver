"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBSState = exports.OBSDevice = void 0;
const _ = require("underscore");
const underScoreDeepExtend = require("underscore-deep-extend");
const device_1 = require("./../../devices/device");
const doOnTime_1 = require("../../devices/doOnTime");
const OBSWebSocket = require("obs-websocket-js");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
_.mixin({ deepExtend: underScoreDeepExtend(_) });
function deepExtend(destination, ...sources) {
    // @ts-ignore (mixin)
    return _.deepExtend(destination, ...sources);
}
const RETRY_TIMEOUT = 5000; // ms
/**
 * This is a OBSDevice, it sends commands when it feels like it
 */
class OBSDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, options) {
        super(deviceId, deviceOptions, options);
        this._connected = false;
        this._authenticated = false;
        this._initialized = false;
        this._setDisconnected = false; // set to true if disconnect() has been called (then do not trye to reconnect)
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
        }, doOnTime_1.SendMode.IN_ORDER, this._deviceOptions);
        this._doOnTime.on('error', (e) => this.emit('error', 'OBS.doOnTime', e));
        this._doOnTime.on('slowCommand', (msg) => this.emit('slowCommand', this.deviceName + ': ' + msg));
        this._doOnTime.on('slowSentCommand', (info) => this.emit('slowSentCommand', info));
        this._doOnTime.on('slowFulfilledCommand', (info) => this.emit('slowFulfilledCommand', info));
    }
    async init(options) {
        this._options = options;
        this._obs = new OBSWebSocket();
        this._obs.on('AuthenticationFailure', () => {
            this._setConnected(true, false);
        });
        this._obs.on('AuthenticationSuccess', () => {
            this._initialized = true;
            this._setConnected(true, true);
            this.emit('resetResolver');
        });
        this._obs.on('ConnectionClosed', () => {
            this._setConnected(false);
            this._triggerRetryConnection();
        });
        this._obs.on('error', (e) => this.emit('error', 'OBS', e));
        return this._connect().then((connected) => {
            if (!connected) {
                this._triggerRetryConnection();
            }
            return connected;
        });
    }
    async _connect() {
        return this._obs
            .connect({
            address: `${this._options.host}:${this._options.port}`,
            password: this._options.password,
        })
            .then(() => {
            // connected
            const time = this.getCurrentTime();
            const state = this._getDefaultState();
            this.setState(state, time);
            this._setConnected(true, this._authenticated);
            return true;
        })
            .catch((err) => {
            // connection error
            this.emit('error', 'OBS', err);
            this._setConnected(false);
            return false;
        });
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
    _setConnected(connected, authenticated = false) {
        if (this._connected !== connected || this._authenticated !== authenticated) {
            this._connected = connected;
            this._authenticated = authenticated;
            this._connectionChanged();
            if (!this._authenticated) {
                this._initialized = false;
            }
        }
    }
    _triggerRetryConnection() {
        if (!this._retryConnectTimeout) {
            this._retryConnectTimeout = setTimeout(() => {
                this._retryConnection();
            }, RETRY_TIMEOUT);
        }
    }
    _retryConnection() {
        if (this._retryConnectTimeout) {
            clearTimeout(this._retryConnectTimeout);
            this._retryConnectTimeout = undefined;
        }
        if (!this.connected && !this._setDisconnected) {
            this._connect()
                .then((connected) => {
                if (!connected) {
                    this._triggerRetryConnection();
                }
            })
                .catch((err) => {
                this.emit('error', 'OBS retryConnection', err);
            });
        }
    }
    _getDefaultState() {
        return {
            currentScene: undefined,
            previewScene: undefined,
            currentTransition: undefined,
            muted: {},
            recording: undefined,
            streaming: undefined,
            scenes: {},
            sources: {},
        };
    }
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime) {
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(newStateTime);
        this.cleanUpStates(0, newStateTime);
    }
    handleState(newState, newMappings) {
        super.onHandleState(newState, newMappings);
        if (!this._initialized) {
            // before it's initialized don't do anything
            this.emit('warning', 'OBS not initialized yet');
            return;
        }
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldState = (this.getStateBefore(previousStateTime) || {
            state: this._getDefaultState(),
        }).state;
        const newOBSState = this.convertStateToOBS(newState, newMappings);
        const commandsToAchieveState = this._diffStates(oldState, newOBSState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newOBSState, newState.time);
    }
    clearFuture(clearAfterTime) {
        // Clear any scheduled commands after this time
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    async terminate() {
        this._setDisconnected = true;
        this._doOnTime.dispose();
        this._obs.disconnect();
        return true;
    }
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        if (!this._connected) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not connected');
        }
        else if (!this._authenticated) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not authenticated');
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
        return !this._connected && !this._retryConnectTimeout && !this._setDisconnected;
    }
    get connected() {
        return this._connected;
    }
    convertStateToOBS(state, mappings) {
        if (!this._initialized) {
            throw Error('convertStateToOBS cannot be used before inititialized');
        }
        const deviceState = this._getDefaultState();
        // Sort layer based on Mapping type (to make sure audio is after inputs) and Layer name
        const sortedLayers = _.sortBy(_.map(state.layers, (tlObject, layerName) => {
            const tlObjectExt = tlObject;
            let mapping = mappings[layerName];
            if (!mapping && tlObjectExt.isLookahead && tlObjectExt.lookaheadForLayer) {
                mapping = mappings[tlObjectExt.lookaheadForLayer];
            }
            return {
                layerName,
                tlObject,
                mapping,
            };
        }).sort((a, b) => a.layerName.localeCompare(b.layerName)), (o) => o.mapping?.options?.mappingType);
        _.each(sortedLayers, ({ tlObject, mapping }) => {
            if (mapping && tlObject.content.deviceType === timeline_state_resolver_types_1.DeviceType.OBS) {
                switch (mapping.options.mappingType) {
                    case timeline_state_resolver_types_1.MappingObsType.CurrentScene:
                        if (tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypeOBS.CURRENT_SCENE) {
                            if (tlObject.isLookahead) {
                                deviceState.previewScene = tlObject.content.sceneName;
                            }
                            else {
                                deviceState.currentScene = tlObject.content.sceneName;
                            }
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingObsType.CurrentTransition:
                        if (tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypeOBS.CURRENT_TRANSITION) {
                            if (tlObject.isLookahead) {
                                // CurrentTransiton can't be looked ahead, same below
                                break;
                            }
                            deviceState.currentTransition = tlObject.content.transitionName;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingObsType.Recording:
                        if (tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypeOBS.RECORDING) {
                            if (tlObject.isLookahead) {
                                // CurrentTransiton can't be looked ahead, same below
                                break;
                            }
                            deviceState.recording = tlObject.content.on;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingObsType.Streaming:
                        if (tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypeOBS.STREAMING) {
                            if (tlObject.isLookahead) {
                                // CurrentTransiton can't be looked ahead, same below
                                break;
                            }
                            deviceState.streaming = tlObject.content.on;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingObsType.Mute:
                        if (tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypeOBS.MUTE) {
                            if (tlObject.isLookahead) {
                                // CurrentTransiton can't be looked ahead, same below
                                break;
                            }
                            const source = mapping.options.source;
                            deviceState.muted[source] = tlObject.content.mute;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingObsType.SceneItemRender:
                        if (tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypeOBS.SCENE_ITEM_RENDER) {
                            if (tlObject.isLookahead) {
                                // CurrentTransiton can't be looked ahead, same below
                                break;
                            }
                            const source = mapping.options.source;
                            const sceneName = mapping.options.sceneName;
                            deepExtend(deviceState.scenes, {
                                [sceneName]: {
                                    sceneItems: {
                                        [source]: {
                                            render: tlObject.content.on,
                                        },
                                    },
                                },
                            });
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingObsType.SourceSettings:
                        if (tlObject.content.type === timeline_state_resolver_types_1.TimelineContentTypeOBS.SOURCE_SETTINGS) {
                            if (tlObject.isLookahead) {
                                // CurrentTransiton can't be looked ahead, same below
                                break;
                            }
                            const source = mapping.options.source;
                            deepExtend(deviceState.sources, {
                                [source]: {
                                    sourceType: tlObject.content.sourceType,
                                    sourceSettings: tlObject.content.sourceSettings,
                                },
                            });
                        }
                        break;
                }
            }
        });
        return deviceState;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.OBS;
    }
    get deviceName() {
        return 'OBS ' + this.deviceId;
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    _addToQueue(commandsToAchieveState, time) {
        _.each(commandsToAchieveState, (cmd) => {
            // add the new commands to the queue:
            this._doOnTime.queue(time, undefined, async (cmd) => {
                return this._commandReceiver(time, cmd, cmd.context, cmd.timelineId);
            }, cmd);
        });
    }
    _resolveCurrentSceneState(oldState, newState) {
        const commands = [];
        const oldCurrentScene = oldState.currentScene;
        const newCurrentScene = newState.currentScene;
        if (newCurrentScene !== undefined) {
            if (oldCurrentScene !== newCurrentScene) {
                commands.push({
                    command: {
                        requestName: timeline_state_resolver_types_1.OBSRequest.SET_CURRENT_SCENE,
                        args: {
                            'scene-name': newCurrentScene,
                        },
                    },
                    context: `currentScene changed from "${oldCurrentScene}" to "${newCurrentScene}"`,
                    timelineId: '',
                });
            }
        }
        const oldPreviewScene = oldState.previewScene;
        const newPreviewScene = newState.previewScene;
        if (newPreviewScene !== undefined) {
            if (oldPreviewScene !== newPreviewScene) {
                commands.push({
                    command: {
                        requestName: timeline_state_resolver_types_1.OBSRequest.SET_PREVIEW_SCENE,
                        args: {
                            'scene-name': newPreviewScene,
                        },
                    },
                    context: `previewScene changed from "${oldPreviewScene}" to "${newPreviewScene}"`,
                    timelineId: '',
                });
            }
        }
        return commands;
    }
    _resolveCurrentTransitionState(oldState, newState) {
        const commands = [];
        const oldCurrentTransition = oldState.currentTransition;
        const newCurrentTransition = newState.currentTransition;
        if (newCurrentTransition !== undefined) {
            if (oldCurrentTransition !== newCurrentTransition) {
                commands.push({
                    command: {
                        requestName: timeline_state_resolver_types_1.OBSRequest.SET_CURRENT_TRANSITION,
                        args: {
                            'transition-name': newCurrentTransition,
                        },
                    },
                    context: 'currentTransition changed',
                    timelineId: '',
                });
            }
        }
        return commands;
    }
    _resolveRecordingStreaming(oldState, newState) {
        const commands = [];
        const oldRecording = oldState.recording;
        const newRecording = newState.recording;
        if (newRecording !== undefined) {
            if (oldRecording !== newRecording) {
                commands.push({
                    command: {
                        requestName: newRecording ? timeline_state_resolver_types_1.OBSRequest.START_RECORDING : timeline_state_resolver_types_1.OBSRequest.STOP_RECORDING,
                        args: {},
                    },
                    context: 'recording changed',
                    timelineId: '',
                });
            }
        }
        const oldStreaming = oldState.streaming;
        const newStreaming = newState.streaming;
        if (newStreaming !== undefined) {
            if (oldStreaming !== newStreaming) {
                commands.push({
                    command: {
                        requestName: newStreaming ? timeline_state_resolver_types_1.OBSRequest.START_STREAMING : timeline_state_resolver_types_1.OBSRequest.STOP_STREAMING,
                        args: {},
                    },
                    context: 'streaming changed',
                    timelineId: '',
                });
            }
        }
        return commands;
    }
    _resolveMute(oldState, newState) {
        const commands = [];
        const oldMuted = oldState.muted;
        const newMuted = newState.muted;
        Object.keys(newMuted).forEach((source) => {
            if (newMuted[source] !== oldMuted[source]) {
                commands.push({
                    command: {
                        requestName: timeline_state_resolver_types_1.OBSRequest.SET_MUTE,
                        args: {
                            source: source,
                            mute: newMuted[source],
                        },
                    },
                    context: `mute ${source} changed`,
                    timelineId: '',
                });
            }
        });
        return commands;
    }
    _resolveScenes(oldState, newState) {
        const commands = [];
        const oldScenes = oldState.scenes;
        const newScenes = newState.scenes;
        Object.entries(newScenes).forEach(([sceneName, scene]) => {
            Object.entries(scene.sceneItems).forEach(([source, newSceneItemProperties]) => {
                const oldSceneItemProperties = oldScenes[sceneName]?.sceneItems[source];
                if (oldSceneItemProperties === undefined ||
                    newSceneItemProperties.render !== oldSceneItemProperties.render) {
                    commands.push({
                        command: {
                            requestName: timeline_state_resolver_types_1.OBSRequest.SET_SCENE_ITEM_RENDEER,
                            args: {
                                'scene-name': sceneName,
                                source: source,
                                render: newSceneItemProperties.render,
                            },
                        },
                        context: `scene ${sceneName} item ${source} changed render`,
                        timelineId: '',
                    });
                }
            });
        });
        return commands;
    }
    _resolveSourceSettings(oldState, newState) {
        const commands = [];
        const oldSources = oldState.sources;
        const newSources = newState.sources;
        Object.entries(newSources).forEach(([sourceName, source]) => {
            if (!_.isEqual(source.sourceSettings, oldSources[sourceName]?.sourceSettings)) {
                commands.push({
                    command: {
                        requestName: timeline_state_resolver_types_1.OBSRequest.SET_SOURCE_SETTINGS,
                        args: {
                            sourceName: sourceName,
                            sourceSettings: source.sourceSettings,
                        },
                    },
                    context: `source ${sourceName} changed settings`,
                    timelineId: '',
                });
            }
        });
        return commands;
    }
    _diffStates(oldState, newState) {
        const commands = [
            ...this._resolveCurrentSceneState(oldState, newState),
            ...this._resolveCurrentTransitionState(oldState, newState),
            ...this._resolveRecordingStreaming(oldState, newState),
            ...this._resolveMute(oldState, newState),
            ...this._resolveScenes(oldState, newState),
            ...this._resolveSourceSettings(oldState, newState),
        ];
        return commands;
    }
    async _defaultCommandReceiver(_time, cmd, context, timelineObjId) {
        const cwc = {
            context: context,
            command: cmd,
            timelineObjId: timelineObjId,
        };
        this.emitDebug(cwc);
        return this._obs.send(cmd.command.requestName, cmd.command.args).catch((error) => {
            this.emit('commandError', error, cwc);
        });
    }
}
exports.OBSDevice = OBSDevice;
class OBSState {
}
exports.OBSState = OBSState;
//# sourceMappingURL=index.js.map