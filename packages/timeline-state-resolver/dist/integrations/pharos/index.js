"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharosDevice = void 0;
const _ = require("underscore");
const device_1 = require("./../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("../../devices/doOnTime");
const connection_1 = require("./connection");
const lib_1 = require("../../lib");
/**
 * This is a wrapper for a Pharos-devices,
 * https://www.pharoscontrols.com/downloads/documentation/application-notes/
 */
class PharosDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver)
                this._commandReceiver = deviceOptions.commandReceiver;
            else
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
        }
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.BURST, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'Pharos');
        this._pharos = new connection_1.Pharos();
        this._pharos.on('error', (e) => this.emit('error', 'Pharos', e));
        this._pharos.on('connected', () => {
            this._connectionChanged();
        });
        this._pharos.on('disconnected', () => {
            this._connectionChanged();
        });
    }
    /**
     * Initiates the connection with Pharos through the PharosAPI.
     */
    async init(initOptions) {
        return new Promise((resolve, reject) => {
            // This is where we would do initialization, like connecting to the devices, etc
            this._pharos
                .connect(initOptions)
                .then(async () => {
                return this._pharos.getProjectInfo();
            })
                .then((systemInfo) => {
                this._pharosProjectInfo = systemInfo;
            })
                .then(() => resolve(true))
                .catch((e) => reject(e));
        });
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
        // Handle this new state, at the point in time specified
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldPharosState = (this.getStateBefore(previousStateTime) || { state: { time: 0, layers: {}, nextEvents: [] } }).state;
        const newPharosState = this.convertStateToPharos(newState);
        const commandsToAchieveState = this._diffStates(oldPharosState, newPharosState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newPharosState, newState.time);
    }
    clearFuture(clearAfterTime) {
        // Clear any scheduled commands after this time
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    async terminate() {
        this._doOnTime.dispose();
        return this._pharos.dispose().then(() => {
            return true;
        });
    }
    get canConnect() {
        return true;
    }
    get connected() {
        return this._pharos.connected;
    }
    convertStateToPharos(state) {
        return state;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.PHAROS;
    }
    get deviceName() {
        return 'Pharos ' + this.deviceId + (this._pharosProjectInfo ? ', ' + this._pharosProjectInfo.name : '');
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    async makeReady(_okToDestroyStuff) {
        return Promise.resolve();
    }
    async executeAction(actionId, _payload) {
        switch (actionId) {
            default:
                return (0, lib_1.actionNotFoundMessage)(actionId);
        }
    }
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        if (!this._pharos.connected) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not connected');
        }
        return {
            statusCode: statusCode,
            messages: messages,
            active: this.isActive,
        };
    }
    /**
     * Add commands to queue, to be executed at the right time
     */
    _addToQueue(commandsToAchieveState, time) {
        _.each(commandsToAchieveState, (cmd) => {
            // add the new commands to the queue:
            this._doOnTime.queue(time, undefined, async (cmd) => {
                return this._commandReceiver(time, cmd, cmd.context, cmd.timelineObjId);
            }, cmd);
        });
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    _diffStates(oldPharosState, newPharosState) {
        const commands = [];
        const stoppedLayers = {};
        const stopLayer = (oldLayer, reason) => {
            if (stoppedLayers[oldLayer.id])
                return; // don't send several remove commands for the same object
            if (oldLayer.content.noRelease)
                return; // override: don't stop / release
            stoppedLayers[oldLayer.id] = true;
            if (oldLayer.content.type === timeline_state_resolver_types_1.TimelineContentTypePharos.SCENE) {
                if (!reason)
                    reason = 'removed scene';
                commands.push({
                    content: {
                        args: [oldLayer.content.scene, oldLayer.content.fade],
                        fcn: async (scene, fade) => this._pharos.releaseScene(scene, fade),
                    },
                    context: `${reason}: ${oldLayer.id} ${oldLayer.content.scene}`,
                    timelineObjId: oldLayer.id,
                });
            }
            else if (oldLayer.content.type === timeline_state_resolver_types_1.TimelineContentTypePharos.TIMELINE) {
                if (!reason)
                    reason = 'removed timeline';
                commands.push({
                    content: {
                        args: [oldLayer.content.timeline, oldLayer.content.fade],
                        fcn: async (timeline, fade) => this._pharos.releaseTimeline(timeline, fade),
                    },
                    context: `${reason}: ${oldLayer.id} ${oldLayer.content.timeline}`,
                    timelineObjId: oldLayer.id,
                });
            }
        };
        const modifyTimelinePlay = (newLayer, oldLayer) => {
            if (newLayer.content.type === timeline_state_resolver_types_1.TimelineContentTypePharos.TIMELINE) {
                if ((newLayer.content.pause || false) !==
                    oldLayer?.content?.pause ||
                    false) {
                    if (newLayer.content.pause) {
                        commands.push({
                            content: {
                                args: [newLayer.content.timeline],
                                fcn: async (timeline) => this._pharos.pauseTimeline(timeline),
                            },
                            context: `pause timeline: ${newLayer.id} ${newLayer.content.timeline}`,
                            timelineObjId: newLayer.id,
                        });
                    }
                    else {
                        commands.push({
                            content: {
                                args: [newLayer.content.timeline],
                                fcn: async (timeline) => this._pharos.resumeTimeline(timeline),
                            },
                            context: `resume timeline: ${newLayer.id} ${newLayer.content.timeline}`,
                            timelineObjId: newLayer.id,
                        });
                    }
                }
                if ((newLayer.content.rate || null) !==
                    (oldLayer?.content?.rate || null)) {
                    commands.push({
                        content: {
                            args: [newLayer.content.timeline, newLayer.content.rate],
                            fcn: async (timeline, rate) => this._pharos.setTimelineRate(timeline, rate),
                        },
                        context: `pause timeline: ${newLayer.id} ${newLayer.content.timeline}: ${newLayer.content.rate}`,
                        timelineObjId: newLayer.id,
                    });
                }
                // @todo: support pause / setTimelinePosition
            }
        };
        const startLayer = (newLayer, reason) => {
            if (!newLayer.content.stopped) {
                if (newLayer.content.type === timeline_state_resolver_types_1.TimelineContentTypePharos.SCENE) {
                    if (!reason)
                        reason = 'added scene';
                    commands.push({
                        content: {
                            args: [newLayer.content.scene],
                            fcn: async (scene) => this._pharos.startScene(scene),
                        },
                        context: `${reason}: ${newLayer.id} ${newLayer.content.scene}`,
                        timelineObjId: newLayer.id,
                    });
                }
                else if (newLayer.content.type === timeline_state_resolver_types_1.TimelineContentTypePharos.TIMELINE) {
                    if (!reason)
                        reason = 'added timeline';
                    commands.push({
                        content: {
                            args: [newLayer.content.timeline],
                            fcn: async (timeline) => this._pharos.startTimeline(timeline),
                        },
                        context: `${reason}: ${newLayer.id} ${newLayer.content.timeline}`,
                        timelineObjId: newLayer.id,
                    });
                    modifyTimelinePlay(newLayer);
                }
            }
            else {
                // Item is set to "stopped"
                stopLayer(newLayer);
            }
        };
        const isPharosObject = (obj) => {
            return !!obj && obj.content.deviceType === timeline_state_resolver_types_1.DeviceType.PHAROS;
        };
        // Added / Changed things:
        _.each(newPharosState.layers, (newLayer, layerKey) => {
            const oldPharosObj0 = oldPharosState.layers[layerKey];
            const oldPharosObj = isPharosObject(oldPharosObj0) ? oldPharosObj0 : undefined;
            const pharosObj = isPharosObject(newLayer)
                ? newLayer
                : undefined;
            if (!pharosObj) {
                if (oldPharosObj) {
                    stopLayer(oldPharosObj);
                }
            }
            else if (!oldPharosObj || !isPharosObject(oldPharosObj)) {
                // item is new
                startLayer(pharosObj);
            }
            else {
                // item is not new, but maybe it has changed:
                if (pharosObj.content.type !== oldPharosObj.content.type || // item has changed type!
                    (pharosObj.content.stopped || false) !== (oldPharosObj.content.stopped || false) // item has stopped / unstopped
                ) {
                    if (!oldPharosObj.content.stopped) {
                        // If it was stopped before, we don't have to stop it now:
                        stopLayer(oldPharosObj);
                    }
                    startLayer(pharosObj);
                }
                else {
                    if (pharosObj.content.type === timeline_state_resolver_types_1.TimelineContentTypePharos.SCENE) {
                        if (pharosObj.content.scene !== oldPharosObj.content.scene) {
                            // scene has changed
                            stopLayer(oldPharosObj, 'scene changed from');
                            startLayer(pharosObj, 'scene changed to');
                        }
                    }
                    else if (pharosObj.content.type === timeline_state_resolver_types_1.TimelineContentTypePharos.TIMELINE) {
                        if (pharosObj.content.timeline !== oldPharosObj.content.timeline) {
                            // timeline has changed
                            stopLayer(oldPharosObj, 'timeline changed from');
                            startLayer(pharosObj, 'timeline changed to');
                        }
                        else {
                            modifyTimelinePlay(pharosObj, oldPharosObj);
                        }
                    }
                }
            }
        });
        // Removed things
        _.each(oldPharosState.layers, (oldLayer, layerKey) => {
            const newLayer = newPharosState.layers[layerKey];
            if (!newLayer && isPharosObject(oldLayer)) {
                // removed item
                stopLayer(oldLayer);
            }
        });
        return commands;
    }
    async _defaultCommandReceiver(_time, cmd, context, timelineObjId) {
        // emit the command to debug:
        const cwc = {
            context: context,
            command: {
                // commandName: cmd.content.args,
                args: cmd.content.args,
                // content: cmd.content
            },
            timelineObjId: timelineObjId,
        };
        this.emitDebug(cwc);
        // execute the command here
        try {
            await cmd.content.fcn(...cmd.content.args);
        }
        catch (e) {
            this.emit('commandError', e, cwc);
        }
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
}
exports.PharosDevice = PharosDevice;
//# sourceMappingURL=index.js.map