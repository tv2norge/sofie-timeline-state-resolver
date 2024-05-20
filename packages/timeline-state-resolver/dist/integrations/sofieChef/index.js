"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SofieChefDevice = void 0;
const _ = require("underscore");
const device_1 = require("../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("../../devices/doOnTime");
const WebSocket = require("ws");
const api_1 = require("./api");
const lib_1 = require("../../lib");
const COMMAND_TIMEOUT_TIME = 5000;
const RECONNECT_WAIT_TIME = 5000;
/**
 * This is a wrapper for a SofieChef-devices,
 * https://github.com/nrkno/sofie-chef
 */
class SofieChefDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._connected = false;
        this._status = {
            app: {
                statusCode: api_1.StatusCode.ERROR,
                message: 'No status received yet',
            },
            windows: {},
        };
        this.msgId = 0;
        this.waitingForReplies = {};
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver)
                this._commandReceiver = deviceOptions.commandReceiver;
            else
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
        }
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.BURST, this._deviceOptions);
        this.handleDoOnTime(this._doOnTime, 'SofieChef');
    }
    /**
     * Initiates the connection with SofieChed through a websocket connection.
     */
    async init(initOptions) {
        // This is where we would do initialization, like connecting to the devices, etc
        this.initOptions = initOptions;
        await this._setupWSConnection();
        return true;
    }
    async _setupWSConnection() {
        return new Promise((resolve, reject) => {
            if (!this.initOptions) {
                reject(new Error(`this.initOptions not set, run init() first!`));
                return;
            }
            if (this._ws) {
                // Clean up previous connection:
                this._ws.removeAllListeners();
                delete this._ws;
            }
            this._ws = new WebSocket(this.initOptions.address);
            this._ws.on('error', (e) => {
                reject(new Error(`Error when connecting: ${e}`));
                this.emit('error', 'SofieChef', e);
            });
            this._ws.on('open', () => {
                this._updateConnected(true);
                resolve();
            });
            this._ws.on('close', () => {
                this._ws?.removeAllListeners();
                delete this._ws;
                this._updateConnected(false);
                this.tryReconnect();
            });
            this._ws.on('message', (data) => {
                this._handleReceivedMessage(data);
            });
            setTimeout(() => {
                reject(new Error(`Timeout when connecting`));
            }, COMMAND_TIMEOUT_TIME);
        });
    }
    tryReconnect() {
        if (this.reconnectTimeout)
            return;
        this.reconnectTimeout = setTimeout(() => {
            delete this.reconnectTimeout;
            this._setupWSConnection()
                .then(async () => {
                // is connected, yay!
                // Resync state:
                await this.resyncState();
            })
                .catch(() => {
                // Unable to reconnect, try again later:
                this.tryReconnect();
            });
        }, RECONNECT_WAIT_TIME);
    }
    async resyncState() {
        const response = await this._sendMessage({
            msgId: 0,
            type: api_1.ReceiveWSMessageType.LIST,
        });
        if (response.code === 200) {
            // Update state to reflec the actual state of Chef:
            const state = { windows: {} };
            for (const window of response.body) {
                state.windows[window.id] = {
                    url: window.url ?? '',
                    urlTimelineObjId: 'N/A',
                };
            }
            this.clearStates();
            this.setState(state, this.getCurrentTime());
            // Trigger conductor to resolve the timeline:
            this.emit('resetResolver');
        }
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
        const oldSofieChefState = (this.getStateBefore(previousStateTime) || { state: { windows: {} } })
            .state;
        const newSofieChefState = this.convertStateToSofieChef(newState, newMappings);
        const commandsToAchieveState = this._diffStates(oldSofieChefState, newSofieChefState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newSofieChefState, newState.time);
    }
    clearFuture(clearAfterTime) {
        // Clear any scheduled commands after this time
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    async terminate() {
        this._doOnTime.dispose();
        this._ws?.terminate();
        this._ws?.removeAllListeners();
        return true;
    }
    get canConnect() {
        return true;
    }
    get connected() {
        return this._connected;
    }
    convertStateToSofieChef(state, mappings) {
        const sofieChefState = {
            windows: {},
        };
        for (const [layer, layerState] of Object.entries(state.layers)) {
            const mapping = mappings[layer];
            const content = layerState.content;
            if (mapping && content.deviceType === timeline_state_resolver_types_1.DeviceType.SOFIE_CHEF) {
                sofieChefState.windows[mapping.options.windowId] = {
                    url: content.url,
                    urlTimelineObjId: layerState.id,
                };
            }
        }
        return sofieChefState;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.SOFIE_CHEF;
    }
    get deviceName() {
        return 'SofieChef ' + this.deviceId;
    }
    get queue() {
        return this._doOnTime.getQueue();
    }
    async makeReady(_okToDestroyStuff) {
        return Promise.resolve();
    }
    /** Restart (reload) all windows */
    async restartAllWindows() {
        return this._sendMessage({
            msgId: 0,
            type: api_1.ReceiveWSMessageType.RESTART,
            windowId: '$all', // Magic token, restart all windows
        });
    }
    /** Restart (reload) a window */
    async restartWindow(windowId) {
        return this._sendMessage({
            msgId: 0,
            type: api_1.ReceiveWSMessageType.RESTART,
            windowId: windowId,
        });
    }
    async executeAction(actionId, payload) {
        switch (actionId) {
            case timeline_state_resolver_types_1.SofieChefActions.RestartAllWindows:
                return this.restartAllWindows()
                    .then(() => ({
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok,
                }))
                    .catch(() => ({ result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error }));
            case timeline_state_resolver_types_1.SofieChefActions.RestartWindow:
                if (!payload?.windowId) {
                    return { result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error, response: (0, lib_1.t)('Missing window id') };
                }
                return this.restartWindow(payload.windowId)
                    .then(() => ({
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok,
                }))
                    .catch(() => ({ result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error }));
            default:
                return (0, lib_1.actionNotFoundMessage)(actionId);
        }
    }
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        if (!this.connected) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not connected');
        }
        else if (this._status.app.statusCode !== api_1.StatusCode.GOOD) {
            statusCode = this.convertStatusCode(this._status.app.statusCode);
            messages.push(this._status.app.message);
        }
        else {
            for (const [index, window] of Object.entries(this._status.windows)) {
                const windowStatusCode = this.convertStatusCode(window.statusCode);
                if (windowStatusCode > statusCode) {
                    statusCode = windowStatusCode;
                    messages.push(`Window ${index}: ${window.message}`);
                }
            }
        }
        return {
            statusCode: statusCode,
            messages: messages,
            active: this.isActive,
        };
    }
    convertStatusCode(s) {
        switch (s) {
            case api_1.StatusCode.GOOD:
                return device_1.StatusCode.GOOD;
            case api_1.StatusCode.WARNING:
                return device_1.StatusCode.WARNING_MAJOR;
            case api_1.StatusCode.ERROR:
                return device_1.StatusCode.BAD;
            default: {
                return device_1.StatusCode.BAD;
            }
        }
    }
    /**
     * Add commands to queue, to be executed at the right time
     */
    _addToQueue(commandsToAchieveState, time) {
        for (const cmd of commandsToAchieveState) {
            // add the new commands to the queue:
            this._doOnTime.queue(time, undefined, async (cmd) => {
                return this._commandReceiver(time, cmd, cmd.context, cmd.timelineObjId);
            }, cmd);
        }
    }
    /**
     * Compares the new timeline-state with the old one, and generates commands to account for the difference
     */
    _diffStates(oldSofieChefState, newSofieChefState) {
        const commands = [];
        // Added / Changed things:
        for (const [windowId, window] of Object.entries(newSofieChefState.windows)) {
            const oldWindow = oldSofieChefState.windows[windowId];
            if (!oldWindow) {
                // Added
                commands.push({
                    context: 'added',
                    timelineObjId: window.urlTimelineObjId,
                    content: {
                        msgId: 0,
                        type: api_1.ReceiveWSMessageType.PLAYURL,
                        windowId: windowId,
                        url: window.url,
                    },
                });
            }
            else {
                // item is not new, but maybe it has changed:
                if (oldWindow.url !== window.url) {
                    commands.push({
                        context: 'changed',
                        timelineObjId: window.urlTimelineObjId,
                        content: {
                            msgId: 0,
                            type: api_1.ReceiveWSMessageType.PLAYURL,
                            windowId: windowId,
                            url: window.url,
                        },
                    });
                }
            }
        }
        // Removed things
        for (const [windowId, oldWindow] of Object.entries(oldSofieChefState.windows)) {
            const newWindow = newSofieChefState.windows[windowId];
            if (!newWindow) {
                // Removed
                commands.push({
                    context: 'removed',
                    timelineObjId: oldWindow.urlTimelineObjId,
                    content: {
                        msgId: 0,
                        type: api_1.ReceiveWSMessageType.STOP,
                        windowId: windowId,
                    },
                });
            }
        }
        return commands;
    }
    async _defaultCommandReceiver(_time, cmd, context, timelineObjId) {
        // emit the command to debug:
        const cwc = {
            context: context,
            command: cmd.content,
            timelineObjId: timelineObjId,
        };
        this.emitDebug(cwc);
        // execute the command here
        try {
            await this._sendMessage(cmd.content);
        }
        catch (e) {
            this.emit('commandError', e, cwc);
        }
    }
    _updateConnected(connected) {
        if (this._connected !== connected) {
            this._connected = connected;
            this.emit('connectionChanged', this.getStatus());
        }
    }
    _updateStatus(status) {
        if (!_.isEqual(this._status, status)) {
            this._status = status;
            this.emit('connectionChanged', this.getStatus());
        }
    }
    _handleReceivedMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message) {
                if (message.type === api_1.SendWSMessageType.REPLY) {
                    const reply = this.waitingForReplies[message.replyTo];
                    if (reply) {
                        if (message.error) {
                            reply.reject(message.error);
                        }
                        else {
                            reply.resolve(message.result);
                        }
                    }
                }
                else if (message.type === api_1.SendWSMessageType.STATUS) {
                    this._updateStatus(message.status);
                }
                else {
                    // @ts-expect-error never
                    this.emit('error', 'SofieChef', new Error(`Unknown command ${message.type}`));
                }
            }
        }
        catch (err) {
            this.emit('error', 'SofieChef', err);
        }
    }
    async _sendMessage(msg) {
        return new Promise((resolve, reject) => {
            msg.msgId = this.msgId++;
            if (this.initOptions?.apiKey) {
                msg.apiKey = this.initOptions?.apiKey;
            }
            this.waitingForReplies[msg.msgId + ''] = {
                resolve,
                reject,
            };
            this._ws?.send(JSON.stringify(msg));
            setTimeout(() => {
                reject(new Error(`Command timed out`));
            }, COMMAND_TIMEOUT_TIME);
        });
    }
}
exports.SofieChefDevice = SofieChefDevice;
//# sourceMappingURL=index.js.map