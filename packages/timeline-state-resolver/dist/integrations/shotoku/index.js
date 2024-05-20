"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotokuDevice = void 0;
const _ = require("underscore");
const device_1 = require("./../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("../../devices/doOnTime");
const connection_1 = require("./connection");
const lib_1 = require("../../lib");
/**
 * This is a generic wrapper for any osc-enabled device.
 */
class ShotokuDevice extends device_1.DeviceWithState {
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
        this._shotoku = new connection_1.ShotokuAPI();
        this._shotoku.on('error', (info, e) => this.emit(e, info));
        this.handleDoOnTime(this._doOnTime, 'OSC');
    }
    async init(initOptions) {
        try {
            await this._shotoku.connect(initOptions.host, initOptions.port);
        }
        catch (e) {
            return false;
        }
        return true;
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
        const oldState = (this.getStateBefore(previousStateTime) || { state: { shots: {}, sequences: {} } }).state;
        const convertTrace = (0, lib_1.startTrace)(`device:convertState`, { deviceId: this.deviceId });
        const newShotokuState = this.convertStateToShotokuShots(newState);
        this.emit('timeTrace', (0, lib_1.endTrace)(convertTrace));
        // Generate commands necessary to transition to the new state
        const diffTrace = (0, lib_1.startTrace)(`device:diffState`, { deviceId: this.deviceId });
        const commandsToAchieveState = this._diffStates(oldState, newShotokuState);
        this.emit('timeTrace', (0, lib_1.endTrace)(diffTrace));
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newShotokuState, newState.time);
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
        await this._shotoku.dispose();
        return Promise.resolve(true);
    }
    getStatus() {
        return {
            statusCode: this._shotoku.connected ? device_1.StatusCode.GOOD : device_1.StatusCode.BAD,
            messages: [],
            active: this.isActive,
        };
    }
    async makeReady(_okToDestroyStuff) {
        return Promise.resolve(); // TODO - enforce current state?
    }
    get canConnect() {
        return true; // TODO?
    }
    get connected() {
        return this._shotoku.connected;
    }
    /**
     * Transform the timeline state into a device state, which is in this case also
     * a timeline state.
     * @param state
     */
    convertStateToShotokuShots(state) {
        const deviceState = {
            shots: {},
            sequences: {},
        };
        _.each(state.layers, (layer) => {
            const content = layer.content;
            if (content.deviceType === timeline_state_resolver_types_1.DeviceType.SHOTOKU) {
                if (content.type === timeline_state_resolver_types_1.TimelineContentTypeShotoku.SHOT) {
                    const show = content.show || 1;
                    if (!content.shot)
                        return;
                    deviceState.shots[show + '.' + content.shot] = {
                        ...content,
                        fromTlObject: layer.id,
                    };
                }
                else {
                    deviceState.sequences[content.sequenceId] = {
                        shots: content.shots.filter((s) => !!s.shot),
                        fromTlObject: layer.id,
                    };
                }
            }
        });
        return deviceState;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.SHOTOKU;
    }
    get deviceName() {
        return 'Shotoku ' + this.deviceId;
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
                return this._commandReceiver(time, cmd.command, cmd.context, cmd.timelineObjId);
            }, cmd);
        });
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     * @param oldState The assumed current state
     * @param newState The desired state of the device
     */
    _diffStates(oldState, newState) {
        // unfortunately we don't know what shots belong to what camera, so we can't do anything smart
        const commands = [];
        _.each(newState.shots, (newCommandContent, index) => {
            const oldLayer = oldState.shots[index];
            if (!oldLayer) {
                // added!
                const shotokuCommand = {
                    show: newCommandContent.show,
                    shot: newCommandContent.shot,
                    type: newCommandContent.transitionType === timeline_state_resolver_types_1.ShotokuTransitionType.Fade
                        ? connection_1.ShotokuCommandType.Fade
                        : connection_1.ShotokuCommandType.Cut,
                    changeOperatorScreen: newCommandContent.changeOperatorScreen,
                };
                commands.push({
                    context: `added: ${newCommandContent.fromTlObject}`,
                    timelineObjId: newCommandContent.fromTlObject,
                    command: shotokuCommand,
                });
            }
            else {
                // since there is nothing but a trigger, we know nothing changed.
            }
        });
        Object.entries(newState.sequences).forEach(([index, newCommandContent]) => {
            const oldLayer = oldState.sequences[index];
            if (!oldLayer) {
                // added!
                const shotokuCommand = {
                    shots: newCommandContent.shots.map((s) => ({
                        show: s.show,
                        shot: s.shot,
                        type: s.transitionType === timeline_state_resolver_types_1.ShotokuTransitionType.Fade ? connection_1.ShotokuCommandType.Fade : connection_1.ShotokuCommandType.Cut,
                        changeOperatorScreen: s.changeOperatorScreen,
                        offset: s.offset,
                    })),
                };
                commands.push({
                    context: `added: ${newCommandContent.fromTlObject}`,
                    timelineObjId: newCommandContent.fromTlObject,
                    command: shotokuCommand,
                });
            }
            else {
                // since there is nothing but a trigger, we know nothing changed.
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
        try {
            if (this._shotoku.connected) {
                this._shotoku.executeCommand(cmd).catch((e) => {
                    throw new Error(e);
                });
            }
            return Promise.resolve();
        }
        catch (e) {
            this.emit('commandError', e, cwc);
            return Promise.resolve();
        }
    }
}
exports.ShotokuDevice = ShotokuDevice;
//# sourceMappingURL=index.js.map