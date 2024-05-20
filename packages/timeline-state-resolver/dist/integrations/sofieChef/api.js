"use strict";
// Note: The contents of this file is copied from Sofie Chef
// here: https://github.com/nrkno/sofie-chef/blob/main/src/lib/api.ts
//
// Also note that "Receive" and "Send" here refers to the SofieChef side (so "Receive" means "send" to us).
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcMethods = exports.StatusCode = exports.SendWSMessageType = exports.ReceiveWSMessageType = void 0;
var ReceiveWSMessageType;
(function (ReceiveWSMessageType) {
    ReceiveWSMessageType["PLAYURL"] = "playurl";
    ReceiveWSMessageType["RESTART"] = "restart";
    ReceiveWSMessageType["STOP"] = "stop";
    ReceiveWSMessageType["EXECUTE"] = "execute";
    ReceiveWSMessageType["LIST"] = "list";
})(ReceiveWSMessageType = exports.ReceiveWSMessageType || (exports.ReceiveWSMessageType = {}));
var SendWSMessageType;
(function (SendWSMessageType) {
    SendWSMessageType["REPLY"] = "reply";
    SendWSMessageType["STATUS"] = "status";
})(SendWSMessageType = exports.SendWSMessageType || (exports.SendWSMessageType = {}));
var StatusCode;
(function (StatusCode) {
    StatusCode["GOOD"] = "good";
    StatusCode["WARNING"] = "warning";
    StatusCode["ERROR"] = "error";
})(StatusCode = exports.StatusCode || (exports.StatusCode = {}));
var IpcMethods;
(function (IpcMethods) {
    // Note: update this enum in lib/preload.ts when changed
    IpcMethods["ReportStatus"] = "ReportStatus";
})(IpcMethods = exports.IpcMethods || (exports.IpcMethods = {}));
//# sourceMappingURL=api.js.map