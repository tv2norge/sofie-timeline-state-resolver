"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMixConnection = exports.BaseConnection = exports.ResponseTypes = void 0;
const eventemitter3_1 = require("eventemitter3");
const net_1 = require("net");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const vMixResponseStreamReader_1 = require("./vMixResponseStreamReader");
const VMIX_DEFAULT_TCP_PORT = 8099;
var ResponseTypes;
(function (ResponseTypes) {
    ResponseTypes["Info"] = "INFO";
    ResponseTypes["OK"] = "OK";
    ResponseTypes["ClientError"] = "ERROR";
    ResponseTypes["ServerError"] = "FAILED";
})(ResponseTypes = exports.ResponseTypes || (exports.ResponseTypes = {}));
class BaseConnection extends eventemitter3_1.EventEmitter {
    constructor(host, port = VMIX_DEFAULT_TCP_PORT, autoConnect = false) {
        super();
        this.host = host;
        this.port = port;
        this._connected = false;
        this._responseStreamReader = new vMixResponseStreamReader_1.VMixResponseStreamReader();
        if (autoConnect)
            this._setupSocket();
        this._responseStreamReader.on('response', (response) => this.emit('data', response));
        this._responseStreamReader.on('error', (error) => this.emit('error', error));
    }
    get connected() {
        return this._connected;
    }
    connect(host, port) {
        this.host = host ?? this.host;
        this.port = host ? port ?? VMIX_DEFAULT_TCP_PORT : this.port;
        this._socket?.end();
        this._setupSocket();
    }
    disconnect() {
        this._socket?.end();
    }
    async requestVMixState() {
        return this._sendCommand('XML');
    }
    async sendCommandFunction(func, args) {
        const inp = args.input !== undefined ? `&Input=${args.input}` : '';
        const val = args.value !== undefined ? `&Value=${args.value}` : '';
        const dur = args.duration !== undefined ? `&Duration=${args.duration}` : '';
        const mix = args.mix !== undefined ? `&Mix=${args.mix}` : '';
        const ext = args.extra !== undefined ? args.extra : '';
        const queryString = `${inp}${val}${dur}${mix}${ext}`.slice(1); // remove the first &
        let command = `FUNCTION ${func}`;
        if (queryString) {
            command += ` ${queryString}`;
        }
        // this.emit('debug', `Sending command: ${command}`)
        return this._sendCommand(command);
    }
    async _sendCommand(cmd) {
        return new Promise((resolve) => {
            this._socket?.write(cmd + '\r\n', (err) => resolve(err));
        });
    }
    _triggerReconnect() {
        if (!this._reconnectTimeout) {
            this._reconnectTimeout = setTimeout(() => {
                this._reconnectTimeout = undefined;
                if (!this._connected)
                    this._setupSocket();
            }, 5000);
        }
    }
    _setupSocket() {
        if (this._socket) {
            this._socket.removeAllListeners();
            if (!this._socket.destroyed) {
                this._socket.destroy();
            }
        }
        this._socket = new net_1.Socket();
        this._socket.setNoDelay(true);
        this._socket.setEncoding('utf-8');
        this._socket.on('data', (data) => {
            if (typeof data !== 'string') {
                // this is against the types, but according to the docs the data will be a string
                // the problem of a character split into chunks in transit should be taken care of
                // (https://nodejs.org/docs/latest-v12.x/api/stream.html#stream_readable_setencoding_encoding)
                throw new Error('Received a non-string even though encoding should have been set to utf-8');
            }
            this._responseStreamReader.processIncomingData(data);
        });
        this._socket.on('connect', () => {
            this._setConnected(true);
            this._responseStreamReader.reset();
        });
        this._socket.on('close', () => {
            this._setConnected(false);
            this._triggerReconnect();
        });
        this._socket.on('error', (e) => {
            if (`${e}`.match(/ECONNREFUSED/)) {
                // Unable to connect, no need to handle this error
                this._setConnected(false);
            }
            else {
                this.emit('error', e);
            }
        });
        this._socket.connect(this.port, this.host);
    }
    _setConnected(connected) {
        if (connected) {
            if (!this._connected) {
                this._connected = true;
                this.emit('connected');
            }
        }
        else if (this._connected) {
            this._connected = false;
            this.emit('disconnected');
        }
    }
}
exports.BaseConnection = BaseConnection;
class VMixConnection extends BaseConnection {
    async sendCommand(command) {
        switch (command.command) {
            case timeline_state_resolver_types_1.VMixCommand.PREVIEW_INPUT:
                return this.setPreviewInput(command.input, command.mix);
            case timeline_state_resolver_types_1.VMixCommand.TRANSITION:
                return this.transition(command.input, command.effect, command.duration, command.mix);
            case timeline_state_resolver_types_1.VMixCommand.AUDIO_VOLUME:
                return this.setAudioLevel(command.input, command.value, command.fade);
            case timeline_state_resolver_types_1.VMixCommand.AUDIO_BALANCE:
                return this.setAudioBalance(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.AUDIO_ON:
                return this.setAudioOn(command.input);
            case timeline_state_resolver_types_1.VMixCommand.AUDIO_OFF:
                return this.setAudioOff(command.input);
            case timeline_state_resolver_types_1.VMixCommand.AUDIO_AUTO_ON:
                return this.setAudioAutoOn(command.input);
            case timeline_state_resolver_types_1.VMixCommand.AUDIO_AUTO_OFF:
                return this.setAudioAutoOff(command.input);
            case timeline_state_resolver_types_1.VMixCommand.AUDIO_BUS_ON:
                return this.setAudioBusOn(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.AUDIO_BUS_OFF:
                return this.setAudioBusOff(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.FADER:
                return this.setFader(command.value);
            case timeline_state_resolver_types_1.VMixCommand.START_RECORDING:
                return this.startRecording();
            case timeline_state_resolver_types_1.VMixCommand.STOP_RECORDING:
                return this.stopRecording();
            case timeline_state_resolver_types_1.VMixCommand.START_STREAMING:
                return this.startStreaming();
            case timeline_state_resolver_types_1.VMixCommand.STOP_STREAMING:
                return this.stopStreaming();
            case timeline_state_resolver_types_1.VMixCommand.FADE_TO_BLACK:
                return this.fadeToBlack();
            case timeline_state_resolver_types_1.VMixCommand.ADD_INPUT:
                return this.addInput(command.value);
            case timeline_state_resolver_types_1.VMixCommand.REMOVE_INPUT:
                return this.removeInput(command.input);
            case timeline_state_resolver_types_1.VMixCommand.PLAY_INPUT:
                return this.playInput(command.input);
            case timeline_state_resolver_types_1.VMixCommand.PAUSE_INPUT:
                return this.pauseInput(command.input);
            case timeline_state_resolver_types_1.VMixCommand.SET_POSITION:
                return this.setPosition(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.SET_PAN_X:
                return this.setPanX(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.SET_PAN_Y:
                return this.setPanY(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.SET_ZOOM:
                return this.setZoom(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.SET_ALPHA:
                return this.setAlpha(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.LOOP_ON:
                return this.loopOn(command.input);
            case timeline_state_resolver_types_1.VMixCommand.LOOP_OFF:
                return this.loopOff(command.input);
            case timeline_state_resolver_types_1.VMixCommand.SET_INPUT_NAME:
                return this.setInputName(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.SET_OUPUT:
                return this.setOutput(command.name, command.value, command.input);
            case timeline_state_resolver_types_1.VMixCommand.START_EXTERNAL:
                return this.startExternal();
            case timeline_state_resolver_types_1.VMixCommand.STOP_EXTERNAL:
                return this.stopExternal();
            case timeline_state_resolver_types_1.VMixCommand.OVERLAY_INPUT_IN:
                return this.overlayInputIn(command.value, command.input);
            case timeline_state_resolver_types_1.VMixCommand.OVERLAY_INPUT_OUT:
                return this.overlayInputOut(command.value);
            case timeline_state_resolver_types_1.VMixCommand.SET_INPUT_OVERLAY:
                return this.setInputOverlay(command.input, command.index, command.value);
            case timeline_state_resolver_types_1.VMixCommand.SCRIPT_START:
                return this.scriptStart(command.value);
            case timeline_state_resolver_types_1.VMixCommand.SCRIPT_STOP:
                return this.scriptStop(command.value);
            case timeline_state_resolver_types_1.VMixCommand.SCRIPT_STOP_ALL:
                return this.scriptStopAll();
            case timeline_state_resolver_types_1.VMixCommand.LIST_ADD:
                return this.listAdd(command.input, command.value);
            case timeline_state_resolver_types_1.VMixCommand.LIST_REMOVE_ALL:
                return this.listRemoveAll(command.input);
            case timeline_state_resolver_types_1.VMixCommand.RESTART_INPUT:
                return this.restart(command.input);
            default:
                throw new Error(`vmixAPI: Command ${(command || {}).command} not implemented`);
        }
    }
    async setPreviewInput(input, mix) {
        return this.sendCommandFunction('PreviewInput', { input, mix });
    }
    async transition(input, effect, duration, mix) {
        return this.sendCommandFunction(effect, { input, duration, mix });
    }
    async setAudioLevel(input, volume, fade) {
        let value = Math.min(Math.max(volume, 0), 100).toString();
        if (fade) {
            value += ',' + fade.toString();
        }
        return this.sendCommandFunction(`SetVolume${fade ? 'Fade' : ''}`, { input: input, value });
    }
    async setAudioBalance(input, balance) {
        return this.sendCommandFunction(`SetBalance`, { input, value: Math.min(Math.max(balance, -1), 1) });
    }
    async setAudioOn(input) {
        return this.sendCommandFunction(`AudioOn`, { input });
    }
    async setAudioOff(input) {
        return this.sendCommandFunction(`AudioOff`, { input });
    }
    async setAudioAutoOn(input) {
        return this.sendCommandFunction(`AudioAutoOn`, { input });
    }
    async setAudioAutoOff(input) {
        return this.sendCommandFunction(`AudioAutoOff`, { input });
    }
    async setAudioBusOn(input, value) {
        return this.sendCommandFunction(`AudioBusOn`, { input, value });
    }
    async setAudioBusOff(input, value) {
        return this.sendCommandFunction(`AudioBusOff`, { input, value });
    }
    async setFader(position) {
        return this.sendCommandFunction(`SetFader`, { value: Math.min(Math.max(position, 0), 255) });
    }
    async setPanX(input, value) {
        return this.sendCommandFunction(`SetPanX`, { input, value: Math.min(Math.max(value, -2), 2) });
    }
    async setPanY(input, value) {
        return this.sendCommandFunction(`SetPanY`, { input, value: Math.min(Math.max(value, -2), 2) });
    }
    async setZoom(input, value) {
        return this.sendCommandFunction(`SetZoom`, { input, value: Math.min(Math.max(value, 0), 5) });
    }
    async setAlpha(input, value) {
        return this.sendCommandFunction(`SetAlpha`, { input, value: Math.min(Math.max(value, 0), 255) });
    }
    async startRecording() {
        return this.sendCommandFunction(`StartRecording`, {});
    }
    async stopRecording() {
        return this.sendCommandFunction(`StopRecording`, {});
    }
    async startStreaming() {
        return this.sendCommandFunction(`StartStreaming`, {});
    }
    async stopStreaming() {
        return this.sendCommandFunction(`StopStreaming`, {});
    }
    async fadeToBlack() {
        return this.sendCommandFunction(`FadeToBlack`, {});
    }
    async addInput(file) {
        return this.sendCommandFunction(`AddInput`, { value: file });
    }
    async removeInput(name) {
        return this.sendCommandFunction(`RemoveInput`, { input: name });
    }
    async playInput(input) {
        return this.sendCommandFunction(`Play`, { input: input });
    }
    async pauseInput(input) {
        return this.sendCommandFunction(`Pause`, { input: input });
    }
    async setPosition(input, value) {
        return this.sendCommandFunction(`SetPosition`, { input: input, value: value });
    }
    async loopOn(input) {
        return this.sendCommandFunction(`LoopOn`, { input: input });
    }
    async loopOff(input) {
        return this.sendCommandFunction(`LoopOff`, { input: input });
    }
    async setInputName(input, value) {
        return this.sendCommandFunction(`SetInputName`, { input: input, value: value });
    }
    async setOutput(name, value, input) {
        return this.sendCommandFunction(`SetOutput${name}`, { value, input });
    }
    async startExternal() {
        return this.sendCommandFunction(`StartExternal`, {});
    }
    async stopExternal() {
        return this.sendCommandFunction(`StopExternal`, {});
    }
    async overlayInputIn(name, input) {
        return this.sendCommandFunction(`OverlayInput${name}In`, { input: input });
    }
    async overlayInputOut(name) {
        return this.sendCommandFunction(`OverlayInput${name}Out`, {});
    }
    async setInputOverlay(input, index, value) {
        const val = `${index},${value}`;
        return this.sendCommandFunction(`SetMultiViewOverlay`, { input, value: val });
    }
    async scriptStart(value) {
        return this.sendCommandFunction(`ScriptStart`, { value });
    }
    async scriptStop(value) {
        return this.sendCommandFunction(`ScriptStop`, { value });
    }
    async scriptStopAll() {
        return this.sendCommandFunction(`ScriptStopAll`, {});
    }
    async lastPreset() {
        return this.sendCommandFunction('LastPreset', {});
    }
    async openPreset(file) {
        return this.sendCommandFunction('OpenPreset', { value: file });
    }
    async savePreset(file) {
        return this.sendCommandFunction('SavePreset', { value: file });
    }
    async listAdd(input, value) {
        return this.sendCommandFunction(`ListAdd`, { input, value: encodeURIComponent(value) });
    }
    async listRemoveAll(input) {
        return this.sendCommandFunction(`ListRemoveAll`, { input });
    }
    async restart(input) {
        return this.sendCommandFunction(`Restart`, { input });
    }
}
exports.VMixConnection = VMixConnection;
//# sourceMappingURL=connection.js.map