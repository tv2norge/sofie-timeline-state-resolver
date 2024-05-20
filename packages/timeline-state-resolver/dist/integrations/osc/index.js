"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OscDevice = void 0;
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const osc = require("osc");
const debug_1 = require("debug");
const _ = require("underscore");
const easings_1 = require("../../devices/transitions/easings");
const EventEmitter = require("eventemitter3");
const debug = (0, debug_1.default)('timeline-state-resolver:osc');
class OscDevice extends EventEmitter {
    constructor() {
        super(...arguments);
        this._oscClientStatus = 'disconnected';
        this.transitions = {};
        this.actions = {};
    }
    async init(options) {
        this.options = options;
        if (options.type === timeline_state_resolver_types_1.OSCDeviceType.TCP) {
            debug('Creating TCP OSC device');
            const client = new osc.TCPSocketPort({
                address: options.host,
                port: options.port,
                metadata: true,
            });
            this._oscClient = client;
            client.open(); // creates client.socket
            client.socket.on('connect', () => {
                this._oscClientStatus = 'connected';
                this.emit('connectionChanged', this.getStatus());
            });
            client.socket.on('close', () => {
                this._oscClientStatus = 'disconnected';
                this.emit('connectionChanged', this.getStatus());
            });
        }
        else if (options.type === timeline_state_resolver_types_1.OSCDeviceType.UDP) {
            debug('Creating UDP OSC device');
            this._oscClient = new osc.UDPPort({
                localAddress: '0.0.0.0',
                localPort: 0,
                remoteAddress: options.host,
                remotePort: options.port,
                metadata: true,
            });
            this._oscClient.open();
        }
        return Promise.resolve(true); // This device doesn't have any initialization procedure
    }
    async terminate() {
        this._oscClient.close();
        this._oscClient.removeAllListeners();
        return true;
    }
    convertTimelineStateToDeviceState(state) {
        const addrToOSCMessage = {};
        const addrToPriority = {};
        Object.values(state.layers).forEach((layer) => {
            if (layer.content.deviceType === timeline_state_resolver_types_1.DeviceType.OSC) {
                const content = {
                    ...layer.content,
                    fromTlObject: layer.id,
                };
                if ((addrToOSCMessage[content.path] && addrToPriority[content.path] <= (layer.priority || 0)) ||
                    !addrToOSCMessage[content.path]) {
                    addrToOSCMessage[content.path] = content;
                    addrToPriority[content.path] = layer.priority || 0;
                }
            }
        });
        return addrToOSCMessage;
    }
    diffStates(oldState, newState) {
        const commands = [];
        Object.entries(newState).forEach(([address, newCommandContent]) => {
            const oldLayer = oldState?.[address];
            if (!oldLayer) {
                // added!
                commands.push({
                    context: `added: ${newCommandContent.fromTlObject}`,
                    tlObjId: newCommandContent.fromTlObject,
                    command: newCommandContent,
                });
            }
            else {
                // changed?
                if (!_.isEqual(oldLayer, newCommandContent)) {
                    // changed!
                    commands.push({
                        context: `changed: ${newCommandContent.fromTlObject}`,
                        tlObjId: newCommandContent.fromTlObject,
                        command: newCommandContent,
                    });
                }
            }
        });
        return commands;
    }
    async sendCommand({ command, context, tlObjId }) {
        const cwc = {
            context: context,
            command: command,
            timelineObjId: tlObjId,
        };
        this.emit('debug', cwc);
        debug(command);
        try {
            if (command.transition && command.from) {
                const easingType = easings_1.Easing[command.transition.type];
                const easing = (easingType || {})[command.transition.direction];
                if (!easing)
                    throw new Error(`Easing "${command.transition.type}.${command.transition.direction}" not found`);
                for (let i = 0; i < Math.max(command.from.length, command.values.length); i++) {
                    if (command.from[i] && command.values[i] && 'value' in command.from[i] && 'value' in command.values[i]) {
                        if (command.from[i].value !== command.values[i].value && command.from[i].type !== command.values[i].type) {
                            throw new Error('Cannot interpolate between values of different types');
                        }
                    }
                }
                this.transitions[command.path] = {
                    // push the tween
                    started: this.getMonotonicTime(),
                    ...command,
                };
                this._oscSender({
                    // send first parameters
                    address: command.path,
                    args: [...command.values].map((o, i) => command.from[i] || o),
                });
                // trigger loop:
                if (!this.transitionInterval)
                    this.transitionInterval = setInterval(() => this.runAnimation(), 40);
            }
            else {
                this._oscSender({
                    address: command.path,
                    args: command.values,
                });
            }
            return Promise.resolve();
        }
        catch (e) {
            this.emit('commandError', e, cwc);
            return Promise.resolve();
        }
    }
    get connected() {
        return this._oscClientStatus === 'connected';
    }
    getStatus() {
        if (this.options?.type === timeline_state_resolver_types_1.OSCDeviceType.TCP) {
            return {
                statusCode: this._oscClientStatus === 'disconnected' ? timeline_state_resolver_types_1.StatusCode.BAD : timeline_state_resolver_types_1.StatusCode.GOOD,
                messages: this._oscClientStatus === 'disconnected' ? ['Disconnected'] : [],
            };
        }
        return {
            statusCode: timeline_state_resolver_types_1.StatusCode.GOOD,
            messages: [],
        };
    }
    _oscSender(msg, address, port) {
        this.emit('debug', 'sending ' + msg.address);
        this._oscClient.send(msg, address, port);
    }
    runAnimation() {
        const t = this.getMonotonicTime();
        for (const addr in this.transitions) {
            // delete old tweens
            if (this.transitions[addr].started + this.transitions[addr].transition.duration < t) {
                delete this.transitions[addr];
            }
        }
        for (const addr in this.transitions) {
            const tween = this.transitions[addr];
            // check if easing exists:
            const easingType = easings_1.Easing[tween.transition.type];
            const easing = (easingType || {})[tween.transition.direction];
            if (easing) {
                // scale time in range 0...1, then calculate progress in range 0..1
                const deltaTime = t - tween.started;
                const progress = deltaTime / tween.transition.duration;
                const fraction = easing(progress);
                // calculate individual values:
                const values = [];
                for (let i = 0; i < Math.max(tween.from.length, tween.values.length); i++) {
                    if (!tween.from[i]) {
                        values[i] = tween.values[i];
                    }
                    else if (!tween.values[i]) {
                        values[i] = tween.from[i];
                    }
                    else {
                        if (tween.from[i].type === timeline_state_resolver_types_1.OSCValueType.FLOAT && tween.values[i].type === timeline_state_resolver_types_1.OSCValueType.FLOAT) {
                            const oldVal = tween.from[i].value;
                            const newVal = tween.values[i].value;
                            values[i] = {
                                type: timeline_state_resolver_types_1.OSCValueType.FLOAT,
                                value: oldVal + (newVal - oldVal) * fraction,
                            };
                        }
                        else if (tween.from[i].type === timeline_state_resolver_types_1.OSCValueType.INT && tween.values[i].type === timeline_state_resolver_types_1.OSCValueType.INT) {
                            const oldVal = tween.from[i].value;
                            const newVal = tween.values[i].value;
                            values[i] = {
                                type: timeline_state_resolver_types_1.OSCValueType.INT,
                                value: oldVal + Math.round((newVal - oldVal) * fraction),
                            };
                        }
                        else {
                            values[i] = tween.values[i];
                        }
                    }
                }
                this._oscSender({
                    address: tween.path,
                    args: values,
                });
            }
        }
        if (Object.keys(this.transitions).length === 0) {
            if (this.transitionInterval) {
                clearInterval(this.transitionInterval);
            }
            this.transitionInterval = undefined;
        }
    }
    getMonotonicTime() {
        const hrTime = process.hrtime();
        return hrTime[0] * 1000 + hrTime[1] / 1000000;
    }
}
exports.OscDevice = OscDevice;
//# sourceMappingURL=index.js.map