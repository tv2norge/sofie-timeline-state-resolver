"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPWatcherDevice = void 0;
const device_1 = require("./../../devices/device");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const got_1 = require("got");
/**
 * This is a HTTPWatcherDevice, requests a uri on a regular interval and watches
 * it's response.
 */
class HTTPWatcherDevice extends device_1.Device {
    constructor(deviceId, deviceOptions, getCurrentTime) {
        super(deviceId, deviceOptions, getCurrentTime);
        this.status = device_1.StatusCode.UNKNOWN;
        const opts = deviceOptions.options;
        switch (opts?.httpMethod) {
            case 'post':
                this.httpMethod = timeline_state_resolver_types_1.TimelineContentTypeHTTP.POST;
                break;
            case 'delete':
                this.httpMethod = timeline_state_resolver_types_1.TimelineContentTypeHTTP.DELETE;
                break;
            case 'put':
                this.httpMethod = timeline_state_resolver_types_1.TimelineContentTypeHTTP.PUT;
                break;
            case 'get':
            case undefined:
            default:
                this.httpMethod = timeline_state_resolver_types_1.TimelineContentTypeHTTP.GET;
                break;
        }
        this.expectedHttpResponse = Number(opts?.expectedHttpResponse) || undefined;
        this.headers = opts?.headers;
        this.keyword = opts?.keyword;
        this.intervalTime = Math.max(Number(opts?.interval) || 1000, 1000);
        this.uri = opts?.uri;
    }
    onInterval() {
        if (!this.uri) {
            this._setStatus(device_1.StatusCode.BAD, 'URI not set');
            return;
        }
        const reqMethod = got_1.default[this.httpMethod];
        if (reqMethod) {
            reqMethod(this.uri, {
                headers: this.headers,
            })
                .then((response) => this.handleResponse(response))
                .catch((error) => {
                this._setStatus(device_1.StatusCode.BAD, error.toString() || 'Unknown');
            });
        }
        else {
            this._setStatus(device_1.StatusCode.BAD, `Bad request method: "${this.httpMethod}"`);
        }
    }
    stopInterval() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
    }
    startInterval() {
        this.stopInterval();
        this.interval = setInterval(() => this.onInterval(), this.intervalTime);
        // Also do a check right away:
        setTimeout(() => this.onInterval(), 300);
    }
    handleResponse(response) {
        if (this.expectedHttpResponse && this.expectedHttpResponse !== response.statusCode) {
            this._setStatus(device_1.StatusCode.BAD, `Expected status code ${this.expectedHttpResponse}, got ${response.statusCode}`);
        }
        else if (this.keyword && response.body && response.body.indexOf(this.keyword) === -1) {
            this._setStatus(device_1.StatusCode.BAD, `Expected keyword "${this.keyword}" not found`);
        }
        else {
            this._setStatus(device_1.StatusCode.GOOD);
        }
    }
    async init(_initOptions) {
        this.startInterval();
        return Promise.resolve(true);
    }
    /** Called by the Conductor a bit before a .handleState is called */
    prepareForHandleState(_newStateTime) {
        // NOP
    }
    handleState(newState, newMappings) {
        super.onHandleState(newState, newMappings);
        // NOP
    }
    clearFuture(_clearAfterTime) {
        // NOP
    }
    getStatus() {
        const s = {
            statusCode: this.status,
            messages: [],
            active: true, // since this is not using any mappings, it's considered to be always active
        };
        if (this.statusReason)
            s.messages = [this.statusReason];
        return s;
    }
    async terminate() {
        this.stopInterval();
        return Promise.resolve(true);
    }
    _setStatus(status, reason) {
        if (this.status !== status || this.statusReason !== reason) {
            this.status = status;
            this.statusReason = reason;
            this.emit('connectionChanged', this.getStatus());
        }
    }
    get canConnect() {
        return false;
    }
    get connected() {
        return false;
    }
    get deviceType() {
        return timeline_state_resolver_types_1.DeviceType.HTTPWATCHER;
    }
    get deviceName() {
        return 'HTTP-Watch ' + this.deviceId;
    }
}
exports.HTTPWatcherDevice = HTTPWatcherDevice;
//# sourceMappingURL=index.js.map