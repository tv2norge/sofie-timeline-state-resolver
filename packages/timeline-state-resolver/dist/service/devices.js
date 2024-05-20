"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesDict = void 0;
const osc_1 = require("../integrations/osc");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const AuthenticatedHTTPSendDevice_1 = require("../integrations/httpSend/AuthenticatedHTTPSendDevice");
// TODO - move all device implementations here and remove the old Device classes
exports.DevicesDict = {
    [timeline_state_resolver_types_1.DeviceType.OSC]: {
        deviceClass: osc_1.OscDevice,
        canConnect: true,
        deviceName: (deviceId) => 'OSC ' + deviceId,
        executionMode: () => 'salvo',
    },
    [timeline_state_resolver_types_1.DeviceType.HTTPSEND]: {
        deviceClass: AuthenticatedHTTPSendDevice_1.AuthenticatedHTTPSendDevice,
        canConnect: false,
        deviceName: (deviceId) => 'HTTPSend ' + deviceId,
        executionMode: () => 'sequential', // todo - config?
    },
};
//# sourceMappingURL=devices.js.map