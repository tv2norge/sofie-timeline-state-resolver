"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionExecutionResultCode = exports.DeviceType = exports.Timeline = void 0;
const tslib_1 = require("tslib");
const Timeline = require("./superfly-timeline");
exports.Timeline = Timeline;
tslib_1.__exportStar(require("./abstract"), exports);
tslib_1.__exportStar(require("./atem"), exports);
tslib_1.__exportStar(require("./casparcg"), exports);
tslib_1.__exportStar(require("./httpSend"), exports);
tslib_1.__exportStar(require("./hyperdeck"), exports);
tslib_1.__exportStar(require("./lawo"), exports);
tslib_1.__exportStar(require("./osc"), exports);
tslib_1.__exportStar(require("./pharos"), exports);
tslib_1.__exportStar(require("./panasonicPTZ"), exports);
tslib_1.__exportStar(require("./sisyfos"), exports);
tslib_1.__exportStar(require("./sofieChef"), exports);
tslib_1.__exportStar(require("./quantel"), exports);
tslib_1.__exportStar(require("./shotoku"), exports);
tslib_1.__exportStar(require("./tcpSend"), exports);
tslib_1.__exportStar(require("./vizMSE"), exports);
tslib_1.__exportStar(require("./singularLive"), exports);
tslib_1.__exportStar(require("./vmix"), exports);
tslib_1.__exportStar(require("./obs"), exports);
tslib_1.__exportStar(require("./tricaster"), exports);
tslib_1.__exportStar(require("./telemetrics"), exports);
tslib_1.__exportStar(require("./multiOsc"), exports);
tslib_1.__exportStar(require("./device"), exports);
tslib_1.__exportStar(require("./mapping"), exports);
tslib_1.__exportStar(require("./mapping"), exports);
tslib_1.__exportStar(require("./expectedPlayoutItems"), exports);
tslib_1.__exportStar(require("./mediaObject"), exports);
tslib_1.__exportStar(require("./translations"), exports);
tslib_1.__exportStar(require("./generated"), exports);
/**
 * An identifier of a particular device class
 *
 * @export
 * @enum {string}
 */
var DeviceType;
(function (DeviceType) {
    DeviceType["ABSTRACT"] = "ABSTRACT";
    DeviceType["CASPARCG"] = "CASPARCG";
    DeviceType["ATEM"] = "ATEM";
    DeviceType["LAWO"] = "LAWO";
    DeviceType["HTTPSEND"] = "HTTPSEND";
    DeviceType["PANASONIC_PTZ"] = "PANASONIC_PTZ";
    DeviceType["TCPSEND"] = "TCPSEND";
    DeviceType["HYPERDECK"] = "HYPERDECK";
    DeviceType["PHAROS"] = "PHAROS";
    DeviceType["OSC"] = "OSC";
    DeviceType["HTTPWATCHER"] = "HTTPWATCHER";
    DeviceType["SISYFOS"] = "SISYFOS";
    DeviceType["QUANTEL"] = "QUANTEL";
    DeviceType["VIZMSE"] = "VIZMSE";
    DeviceType["SINGULAR_LIVE"] = "SINGULAR_LIVE";
    DeviceType["SHOTOKU"] = "SHOTOKU";
    DeviceType["VMIX"] = "VMIX";
    DeviceType["OBS"] = "OBS";
    DeviceType["SOFIE_CHEF"] = "SOFIE_CHEF";
    DeviceType["TELEMETRICS"] = "TELEMETRICS";
    DeviceType["TRICASTER"] = "TRICASTER";
    DeviceType["MULTI_OSC"] = "MULTI_OSC";
})(DeviceType = exports.DeviceType || (exports.DeviceType = {}));
var ActionExecutionResultCode;
(function (ActionExecutionResultCode) {
    ActionExecutionResultCode["Error"] = "ERROR";
    ActionExecutionResultCode["Ok"] = "OK";
})(ActionExecutionResultCode = exports.ActionExecutionResultCode || (exports.ActionExecutionResultCode = {}));
//# sourceMappingURL=index.js.map