"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriCasterConnection = void 0;
const got_1 = require("got");
const eventemitter3_1 = require("eventemitter3");
const WebSocket = require("ws");
const triCasterInfoParser_1 = require("./triCasterInfoParser");
const triCasterCommands_1 = require("./triCasterCommands");
const RECONNECT_TIMEOUT = 1000;
const PING_INTERVAL = 10000;
const GOT_OPTIONS = {
    retry: { limit: 0 },
    timeout: { request: 10000 },
};
class TriCasterConnection extends eventemitter3_1.EventEmitter {
    constructor(_host, _port) {
        super();
        this._host = _host;
        this._port = _port;
        this._pingTimeout = null;
        this._isClosing = false;
    }
    connect() {
        this._socket = new WebSocket(`ws://${this._host}:${this._port}/v1/shortcut_notifications`);
        this._socket.on('open', () => this.handleOpen());
        this._socket.on('close', (_, reason) => this.handleClose(reason));
        this._socket.on('error', (error) => this.handleError(error));
    }
    handleOpen() {
        Promise.all([this.getInfo(), this.getShortcutStates()])
            .then(([info, shortcutStates]) => {
            this.emit('connected', info, shortcutStates);
            this.ping();
        })
            .catch((reason) => {
            this.emit('error', reason);
        });
    }
    handleClose(reason) {
        this.emit('disconnected', reason);
        if (!this._isClosing) {
            setTimeout(() => {
                this.connect();
            }, RECONNECT_TIMEOUT);
        }
        if (this._pingTimeout) {
            clearTimeout(this._pingTimeout);
        }
    }
    handleError(error) {
        this.emit('error', `Socket error: ${error.message}`);
        this._socket.close();
    }
    ping() {
        if (this._socket.readyState === WebSocket.OPEN) {
            this._socket.ping();
        }
        this._pingTimeout = setTimeout(() => {
            this.ping();
        }, PING_INTERVAL);
    }
    async send(message) {
        return new Promise((resolve, reject) => {
            if (this._socket.readyState !== WebSocket.OPEN) {
                reject(new Error('Socket not connected'));
            }
            this._socket.send((0, triCasterCommands_1.serializeToWebSocketMessage)(message), (err) => {
                if (err)
                    reject(err);
                resolve();
            });
        });
    }
    close() {
        this._isClosing = true;
        this._socket.close();
    }
    async getInfo() {
        const switcherUpdateXml = got_1.default.get(`http://${this._host}:${this._port}/v1/dictionary?key=switcher`, GOT_OPTIONS);
        const productInformationXml = got_1.default.get(`http://${this._host}:${this._port}/v1/version`, GOT_OPTIONS);
        const parser = new triCasterInfoParser_1.TriCasterInfoParser();
        return {
            ...parser.parseSwitcherUpdate(await switcherUpdateXml.text()),
            ...parser.parseProductInformation(await productInformationXml.text()),
        };
    }
    async getShortcutStates() {
        return got_1.default.get(`http://${this._host}:${this._port}/v1/dictionary?key=shortcut_states`, GOT_OPTIONS).text();
    }
}
exports.TriCasterConnection = TriCasterConnection;
//# sourceMappingURL=triCasterConnection.js.map