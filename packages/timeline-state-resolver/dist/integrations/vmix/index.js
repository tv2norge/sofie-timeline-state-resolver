"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMixDevice = void 0;
const _ = require("underscore");
const device_1 = require("./../../devices/device");
const doOnTime_1 = require("../../devices/doOnTime");
const connection_1 = require("./connection");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const lib_1 = require("../../lib");
const vMixStateDiffer_1 = require("./vMixStateDiffer");
const vMixTimelineStateConverter_1 = require("./vMixTimelineStateConverter");
const vMixXmlStateParser_1 = require("./vMixXmlStateParser");
const vMixPollingTimer_1 = require("./vMixPollingTimer");
const vMixStateSynchronizer_1 = require("./vMixStateSynchronizer");
/**
 * Default time, in milliseconds, for when we should poll vMix to query its actual state.
 */
const DEFAULT_VMIX_POLL_INTERVAL = 10 * 1000;
/**
 * How long to wait, in milliseconds, to poll vMix's state after we send commands to it.
 */
const BACKOFF_VMIX_POLL_INTERVAL = 5 * 1000;
/**
 * This is a VMixDevice, it sends commands when it feels like it
 */
class VMixDevice extends device_1.DeviceWithState {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this._connected = false;
        this._initialized = false;
        this._expectingStateAfterConnecting = false;
        this._expectingPolledState = false;
        this._pollingTimer = null;
        if (deviceOptions.options) {
            if (deviceOptions.commandReceiver)
                this._commandReceiver = deviceOptions.commandReceiver;
            else
                this._commandReceiver = this._defaultCommandReceiver.bind(this);
        }
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        }, doOnTime_1.SendMode.IN_ORDER, this._deviceOptions);
        this._doOnTime.on('error', (e) => this.emit('error', 'VMix.doOnTime', e));
        this._doOnTime.on('slowCommand', (msg) => this.emit('slowCommand', this.deviceName + ': ' + msg));
        this._doOnTime.on('slowSentCommand', (info) => this.emit('slowSentCommand', info));
        this._doOnTime.on('slowFulfilledCommand', (info) => this.emit('slowFulfilledCommand', info));
        this._stateDiffer = new vMixStateDiffer_1.VMixStateDiffer((commands) => this._addToQueue(commands, this.getCurrentTime()));
        this._timelineStateConverter = new vMixTimelineStateConverter_1.VMixTimelineStateConverter(() => this._stateDiffer.getDefaultState(), (inputNumber) => this._stateDiffer.getDefaultInputState(inputNumber), (inputNumber) => this._stateDiffer.getDefaultInputAudioState(inputNumber));
        this._xmlStateParser = new vMixXmlStateParser_1.VMixXmlStateParser();
        this._stateSynchronizer = new vMixStateSynchronizer_1.VMixStateSynchronizer();
    }
    async init(options) {
        this._vMixConnection = new connection_1.VMixConnection(options.host, options.port, false);
        this._vMixConnection.on('connected', () => {
            // We are not resetting the state at this point and waiting for the state to arrive. Otherwise, we risk
            // going back and forth on reconnections
            this._setConnected(true);
            this._expectingStateAfterConnecting = true;
            this.emitDebug('connected');
            this._pollingTimer?.start();
            this._requestVMixState('VMix init');
        });
        this._vMixConnection.on('disconnected', () => {
            this._setConnected(false);
            this._pollingTimer?.stop();
            this.emitDebug('disconnected');
        });
        this._vMixConnection.on('error', (e) => this.emit('error', 'VMix', e));
        this._vMixConnection.on('data', (data) => this._onDataReceived(data));
        // this._vmix.on('debug', (...args) => this.emitDebug(...args))
        this._vMixConnection.connect();
        const pollTime = typeof options.pollInterval === 'number' && options.pollInterval >= 0 // options.pollInterval === 0 disables the polling
            ? options.pollInterval
            : DEFAULT_VMIX_POLL_INTERVAL;
        if (pollTime) {
            this._pollingTimer = new vMixPollingTimer_1.VMixPollingTimer(pollTime);
            this._pollingTimer.on('tick', () => {
                this._expectingPolledState = true;
                this._requestVMixState('VMix poll');
            });
        }
        return true;
    }
    _onDataReceived(data) {
        if (data.message !== 'Completed')
            this.emitDebug(data);
        if (data.command === 'XML' && data.body) {
            if (!this._initialized) {
                this._initialized = true;
                this.emit('connectionChanged', this.getStatus());
            }
            const realState = this._xmlStateParser.parseVMixState(data.body);
            if (this._expectingStateAfterConnecting) {
                this._setFullState(realState);
                this._expectingStateAfterConnecting = false;
            }
            else if (this._expectingPolledState) {
                this._setPartialInputState(realState);
                this._expectingPolledState = false;
            }
        }
    }
    _connectionChanged() {
        this.emit('connectionChanged', this.getStatus());
    }
    _setConnected(connected) {
        if (this._connected !== connected) {
            this._connected = connected;
            this._connectionChanged();
        }
    }
    /**
     * Updates the entire state when we (re)connect
     * @param realState State as reported by vMix itself.
     */
    _setFullState(realState) {
        const time = this.getCurrentTime();
        const oldState = (this.getStateBefore(time) ?? { state: this._stateDiffer.getDefaultState() })
            .state;
        oldState.reportedState = realState;
        this.setState(oldState, time);
        this.emit('resetResolver');
    }
    /**
     * Runs when we receive XML state from vMix,
     * generally as the result a poll (if polling/enforcement is enabled).
     * @param realState State as reported by vMix itself.
     */
    _setPartialInputState(realState) {
        const time = this.getCurrentTime();
        let expectedState = (this.getStateBefore(time) ?? { state: this._stateDiffer.getDefaultState() })
            .state;
        expectedState = this._stateSynchronizer.applyRealState(expectedState, realState);
        this.setState(expectedState, time);
        this.emit('resetResolver');
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
            this.emit('warning', 'VMix not initialized yet');
            return;
        }
        const previousStateTime = Math.max(this.getCurrentTime(), newState.time);
        const oldState = (this.getStateBefore(previousStateTime) ?? { state: this._stateDiffer.getDefaultState() }).state;
        const newVMixState = this._timelineStateConverter.getVMixStateFromTimelineState(newState, newMappings // is this safe? why is the TriCaster integration filtering?
        );
        const commandsToAchieveState = this._stateDiffer.getCommandsToAchieveState(oldState, newVMixState);
        // clear any queued commands later than this time:
        this._doOnTime.clearQueueNowAndAfter(previousStateTime);
        // add the new commands to the queue:
        this._addToQueue(commandsToAchieveState, newState.time);
        // store the new state, for later use:
        this.setState(newVMixState, newState.time);
        this.emitDebugState(newVMixState);
    }
    clearFuture(clearAfterTime) {
        // Clear any scheduled commands after this time
        this._doOnTime.clearQueueAfter(clearAfterTime);
    }
    async terminate() {
        this._doOnTime.dispose();
        this._vMixConnection.removeAllListeners();
        this._vMixConnection.disconnect();
        this._pollingTimer?.stop();
        return Promise.resolve(true);
    }
    getStatus() {
        let statusCode = device_1.StatusCode.GOOD;
        const messages = [];
        if (!this._connected) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not connected');
        }
        else if (!this._initialized) {
            statusCode = device_1.StatusCode.BAD;
            messages.push('Not initialized');
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
    async executeAction(actionId, payload) {
        switch (actionId) {
            case timeline_state_resolver_types_1.VmixActions.LastPreset:
                return await this._lastPreset();
            case timeline_state_resolver_types_1.VmixActions.OpenPreset:
                return await this._openPreset(payload);
            case timeline_state_resolver_types_1.VmixActions.SavePreset:
                return await this._savePreset(payload);
            default:
                return {
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                    response: (0, lib_1.t)('Action "{{actionId}}" not found', { actionId }),
                };
        }
    }
    _checkPresetAction(payload, payloadRequired) {
        if (!this._vMixConnection.connected) {
            return {
                result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                response: (0, lib_1.t)('Cannot perform VMix action without a connection'),
            };
        }
        if (payloadRequired) {
            if (!payload || typeof payload !== 'object') {
                return {
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                    response: (0, lib_1.t)('Action payload is invalid'),
                };
            }
            if (!payload.filename) {
                return {
                    result: timeline_state_resolver_types_1.ActionExecutionResultCode.Error,
                    response: (0, lib_1.t)('No preset filename specified'),
                };
            }
        }
        return;
    }
    async _lastPreset() {
        const presetActionCheckResult = this._checkPresetAction();
        if (presetActionCheckResult)
            return presetActionCheckResult;
        await this._vMixConnection.lastPreset();
        return {
            result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok,
        };
    }
    async _openPreset(payload) {
        const presetActionCheckResult = this._checkPresetAction(payload, true);
        if (presetActionCheckResult)
            return presetActionCheckResult;
        await this._vMixConnection.openPreset(payload.filename);
        return {
            result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok,
        };
    }
    async _savePreset(payload) {
        const presetActionCheckResult = this._checkPresetAction(payload, true);
        if (presetActionCheckResult)
            return presetActionCheckResult;
        await this._vMixConnection.savePreset(payload.filename);
        return {
            result: timeline_state_resolver_types_1.ActionExecutionResultCode.Ok,
        };
    }
    get canConnect() {
        return false;
    }
    get connected() {
        return false;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.VMIX;
    }
    get deviceName() {
        return 'VMix ' + this.deviceId;
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
    async _defaultCommandReceiver(_time, cmd, context, timelineObjId) {
        // Do not poll or retry while we are sending commands, instead always do it closely after.
        // This is potentially an issue while producing a show, because it is theoretically possible
        // that the operator keeps performing actions/takes within 5 seconds of one another and
        // therefore this timeout keeps getting reset and never expires.
        // For now, we classify this as an extreme outlier edge case and acknowledge that this system
        // does not support it.
        this._expectingPolledState = false;
        this._pollingTimer?.postponeNextTick(BACKOFF_VMIX_POLL_INTERVAL);
        const cwc = {
            context: context,
            command: cmd,
            timelineObjId: timelineObjId,
        };
        this.emitDebug(cwc);
        return this._vMixConnection.sendCommand(cmd.command).catch((error) => {
            this.emit('commandError', error, cwc);
        });
    }
    /**
     * Request vMix's XML status.
     */
    _requestVMixState(context) {
        this._vMixConnection.requestVMixState().catch((e) => this.emit('error', context, e));
    }
}
exports.VMixDevice = VMixDevice;
//# sourceMappingURL=index.js.map