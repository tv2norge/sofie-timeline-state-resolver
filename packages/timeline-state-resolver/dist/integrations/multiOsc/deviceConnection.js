"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OSCConnection = void 0;
const osc = require("osc");
const events_1 = require("events");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
class OSCConnection extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this._connected = false;
    }
    /**
     * Connnects to the OSC server.
     * @param host ip to connect to
     * @param port port the osc server is hosted on
     */
    async connect(options) {
        this.connectionId = options.connectionId;
        this.host = options.host;
        this.port = options.port;
        this._type = options.type;
        this._oscSender = options.oscSender || this._defaultOscSender.bind(this);
        if (options.type === timeline_state_resolver_types_1.MultiOSCDeviceType.UDP) {
            this._oscClient = new osc.UDPPort({
                localAddress: '0.0.0.0',
                localPort: 0,
                remoteAddress: this.host,
                remotePort: this.port,
                metadata: true,
            });
        }
        else {
            this._oscClient = new osc.TCPSocketPort({
                address: this.host,
                port: this.port,
                metadata: true,
            });
            this._oscClient.socket.on('close', () => this.updateIsConnected(false));
            this._oscClient.socket.on('connect', () => this.updateIsConnected(true));
        }
        this._oscClient.on('error', (error) => this.emit('error', error));
        return new Promise((resolve) => {
            this._oscClient.on('ready', () => {
                resolve();
            });
            this._oscClient.open();
        });
    }
    dispose() {
        this.updateIsConnected(false);
        this._oscClient.close();
    }
    _defaultOscSender(msg, address, port) {
        this.emit('debug', 'sending ' + msg.address);
        this._oscClient.send(msg, address, port);
    }
    sendOsc(msg, address, port) {
        this._oscSender(msg, address, port);
    }
    disconnect() {
        this._oscClient.close();
    }
    get connected() {
        return this._type === timeline_state_resolver_types_1.MultiOSCDeviceType.TCP ? this._connected : true;
    }
    updateIsConnected(connected) {
        if (this._connected !== connected) {
            this._connected = connected;
            if (connected) {
                this.emit('connected');
            }
            else {
                this.emit('disconnected');
            }
        }
    }
}
exports.OSCConnection = OSCConnection;
//# sourceMappingURL=deviceConnection.js.map