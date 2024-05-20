"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VizEngineTcpSender = void 0;
const events_1 = require("events");
const net = require("net");
class VizEngineTcpSender extends events_1.EventEmitter {
    constructor(port, host) {
        super();
        this._socket = new net.Socket();
        this._connected = false;
        this._commandCount = 0;
        this._sendQueue = [];
        this._waitQueue = new Set();
        this._incomingData = '';
        this._responseTimeoutMs = 6000;
        this._port = port;
        this._host = host;
    }
    send(commands) {
        commands.forEach((command) => {
            this._sendQueue.push(command);
        });
        if (this._connected) {
            this._flushQueue();
        }
        else {
            this._connect();
        }
    }
    _connect() {
        this._socket.on('connect', () => {
            this._connected = true;
            if (this._sendQueue.length) {
                this._flushQueue();
            }
        });
        this._socket.on('error', (e) => {
            this.emit('error', e);
            this._destroy();
        });
        this._socket.on('lookup', () => {
            // this handles a dns exception, but the error is handled on 'error' event
        });
        this._socket.on('data', this._processData.bind(this));
        this._socket.connect(this._port, this._host);
    }
    _flushQueue() {
        this._sendQueue.forEach((command) => {
            this._socket.write(`${++this._commandCount} ${command}\x00`);
            this._waitQueue.add(this._commandCount);
        });
        setTimeout(() => {
            if (this._waitQueue.size) {
                this.emit('warning', `Response from ${this._host}:${this._port} not received on time`);
                this._destroy();
            }
        }, this._responseTimeoutMs);
    }
    _processData(data) {
        this._incomingData = this._incomingData.concat(data.toString());
        const split = this._incomingData.split('\x00');
        if (split.length === 0 || (split.length === 1 && split[0] === ''))
            return;
        if (split[split.length - 1] !== '') {
            this._incomingData = split.pop();
        }
        else {
            this._incomingData = '';
        }
        split.forEach((message) => {
            const firstSpace = message.indexOf(' ');
            const id = message.substr(0, firstSpace);
            const contents = message.substr(firstSpace + 1);
            if (contents.startsWith('ERROR')) {
                this.emit('warning', contents);
            }
            this._waitQueue.delete(parseInt(id, 10));
        });
        if (this._waitQueue.size === 0) {
            this._destroy();
        }
    }
    _destroy() {
        this._socket.destroy();
        this.removeAllListeners();
    }
}
exports.VizEngineTcpSender = VizEngineTcpSender;
//# sourceMappingURL=vizEngineTcpSender.js.map