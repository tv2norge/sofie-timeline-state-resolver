"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingularLiveDevice = void 0;
const _ = require("underscore");
const device_1 = require("./../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("../../devices/doOnTime");
const got_1 = require("got");
const SINGULAR_LIVE_API = 'https://app.singular.live/apiv2/controlapps/';
/**
 * This is a Singular.Live device, it talks to a Singular.Live App Instance using an Access Token
 */
class SingularLiveDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._deviceStatus = {
            statusCode: device_1.StatusCode.GOOD,
            messages: [],
            active: this.isActive,
        };
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver)
                this._commandReceiver = deviceOptions.commandReceiver;
            else
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
        }
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.IN_ORDER, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'SingularLive');
    }
    async init(initOptions) {
        // this._makeReadyCommands = options.makeReadyCommands || []
        this._accessToken = initOptions.accessToken || '';
        if (!this._accessToken)
            throw new Error('Singular.Live bad connection option: accessToken. An accessToken is required.');
        return Promise.resolve(true); // This device doesn't have any initialization procedure
    }
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(newStateTime) {
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(newStateTime);
        this.cleanUpStates(0, newStateTime);
    }
    handleState(newState, newMappings) {
        super.onHandleState(newState, newMappings);
        // Handle this new state, at the point in time specified
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldSingularState = (this.getStateBefore(previousStateTime) || { state: { compositions: {} } }).state;
        const newSingularState = this.convertStateToSingularLive(newState, newMappings);
        const commandsToAchieveState = this._diffStates(oldSingularState, newSingularState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newSingularState, newState.time);
    }
    clearFuture(clearAfterTime) {
        // Clear any scheduled commands after this time
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    async terminate() {
        this._doOnTime.dispose();
        return Promise.resolve(true);
    }
    getStatus() {
        // Good, since this device has no status, really
        return this._deviceStatus;
    }
    async makeReady(_okToDestroyStuff) {
        // if (okToDestroyStuff && this._makeReadyCommands && this._makeReadyCommands.length > 0) {
        // 	const time = this.getCurrentTime()
        // 	_.each(this._makeReadyCommands, (cmd: SingularLiveCommandContent) => {
        // 		// add the new commands to the queue:
        // 		this._doOnTime.queue(time, undefined, (cmd: SingularLiveCommandContent) => {
        // 			return this._commandReceiver(time, cmd, 'makeReady', '')
        // 		}, cmd)
        // 	})
        // }
    }
    get canConnect() {
        return false;
    }
    get connected() {
        return false;
    }
    _getDefaultState() {
        return {
            compositions: {},
        };
    }
    convertStateToSingularLive(state, newMappings) {
        // convert the timeline state into something we can use
        // (won't even use this.mapping)
        const singularState = this._getDefaultState();
        _.each(state.layers, (tlObject, layerName) => {
            const mapping = newMappings[layerName];
            if (mapping &&
                mapping.device === timeline_state_resolver_types_1.DeviceType.SINGULAR_LIVE &&
                mapping.deviceId === this.deviceId &&
                tlObject.content.deviceType === timeline_state_resolver_types_1.DeviceType.SINGULAR_LIVE) {
                const content = tlObject.content;
                if (content.type === timeline_state_resolver_types_1.TimelineContentTypeSingularLive.COMPOSITION) {
                    singularState.compositions[mapping.options.compositionName] = {
                        timelineObjId: tlObject.id,
                        controlNode: content.controlNode,
                    };
                }
            }
        });
        return singularState;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.SINGULAR_LIVE;
    }
    get deviceName() {
        return 'Singular.Live ' + this.deviceId;
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    /**
     * Add commands to queue, to be executed at the right time
     */
    _addToQueue(commandsToAchieveState, time) {
        _.each(commandsToAchieveState, (cmd) => {
            // add the new commands to the queue:
            this._doOnTime.queue(time, undefined, async (cmd) => {
                return this._commandReceiver(time, cmd.content, cmd.context, cmd.timelineObjId);
            }, cmd);
        });
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    _diffStates(oldSingularLiveState, newSingularLiveState) {
        const commands = [];
        _.each(newSingularLiveState.compositions, (composition, compositionName) => {
            const oldComposition = oldSingularLiveState.compositions[compositionName];
            if (!oldComposition) {
                // added!
                commands.push({
                    timelineObjId: composition.timelineObjId,
                    commandName: 'added',
                    content: (0, device_1.literal)({
                        subCompositionName: compositionName,
                        state: composition.controlNode.state,
                        payload: composition.controlNode.payload,
                    }),
                    context: `added: ${composition.timelineObjId}`,
                    layer: compositionName,
                });
            }
            else {
                // changed?
                if (!_.isEqual(oldComposition.controlNode, composition.controlNode)) {
                    // changed!
                    commands.push({
                        timelineObjId: composition.timelineObjId,
                        commandName: 'changed',
                        content: (0, device_1.literal)({
                            subCompositionName: compositionName,
                            state: composition.controlNode.state,
                            payload: composition.controlNode.payload,
                        }),
                        context: `changed: ${composition.timelineObjId}  (previously: ${oldComposition.timelineObjId})`,
                        layer: compositionName,
                    });
                }
            }
        });
        // removed
        _.each(oldSingularLiveState.compositions, (composition, compositionName) => {
            const newComposition = newSingularLiveState.compositions[compositionName];
            if (!newComposition) {
                // removed!
                commands.push({
                    timelineObjId: composition.timelineObjId,
                    commandName: 'removed',
                    content: (0, device_1.literal)({
                        subCompositionName: compositionName,
                        state: 'Out',
                    }),
                    context: `removed: ${composition.timelineObjId}`,
                    layer: compositionName,
                });
            }
        });
        return commands
            .sort((a, b) => a.content.state && !b.content.state
            ? 1
            : !a.content.state && b.content.state
                ? -1
                : 0)
            .sort((a, b) => a.layer.localeCompare(b.layer));
    }
    async _defaultCommandReceiver(_time, cmd, context, timelineObjId) {
        const cwc = {
            context: context,
            command: cmd,
            timelineObjId: timelineObjId,
        };
        this.emitDebug(cwc);
        const url = SINGULAR_LIVE_API + this._accessToken + '/control';
        return new Promise((resolve, reject) => {
            got_1.default
                .patch(url, { json: [cmd] })
                .then((response) => {
                if (response.statusCode === 200) {
                    this.emitDebug(`SingularLive: ${cmd.subCompositionName}: Good statuscode response on url "${url}": ${response.statusCode} (${context})`);
                    resolve();
                }
                else {
                    this.emit('warning', `SingularLive: ${cmd.subCompositionName}: Bad statuscode response on url "${url}": ${response.statusCode} (${context})`);
                    resolve();
                }
            })
                .catch((error) => {
                this.emit('error', `SingularLive.response error ${cmd.subCompositionName} (${context}`, error);
                reject(error);
            });
        }).catch((error) => {
            this.emit('commandError', error, cwc);
        });
    }
}
exports.SingularLiveDevice = SingularLiveDevice;
//# sourceMappingURL=index.js.map