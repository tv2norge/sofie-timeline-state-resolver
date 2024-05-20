"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTimelineObjTriCasterMatrixOutput = exports.isTimelineObjTriCasterMixOutput = exports.isTimelineObjTriCasterAudioChannel = exports.isTimelineObjTriCasterDSK = exports.isTimelineObjTriCasterInput = exports.isTimelineObjTriCasterME = exports.isTimelineObjTriCaster = void 0;
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
function isTimelineObjTriCaster(content) {
    return content.deviceType === timeline_state_resolver_types_1.DeviceType.TRICASTER;
}
exports.isTimelineObjTriCaster = isTimelineObjTriCaster;
function isTimelineObjTriCasterME(content) {
    return isTimelineObjTriCaster(content) && content.type === timeline_state_resolver_types_1.TimelineContentTypeTriCaster.ME;
}
exports.isTimelineObjTriCasterME = isTimelineObjTriCasterME;
function isTimelineObjTriCasterInput(content) {
    return isTimelineObjTriCaster(content) && content.type === timeline_state_resolver_types_1.TimelineContentTypeTriCaster.INPUT;
}
exports.isTimelineObjTriCasterInput = isTimelineObjTriCasterInput;
function isTimelineObjTriCasterDSK(content) {
    return isTimelineObjTriCaster(content) && content.type === timeline_state_resolver_types_1.TimelineContentTypeTriCaster.DSK;
}
exports.isTimelineObjTriCasterDSK = isTimelineObjTriCasterDSK;
function isTimelineObjTriCasterAudioChannel(content) {
    return isTimelineObjTriCaster(content) && content.type === timeline_state_resolver_types_1.TimelineContentTypeTriCaster.AUDIO_CHANNEL;
}
exports.isTimelineObjTriCasterAudioChannel = isTimelineObjTriCasterAudioChannel;
function isTimelineObjTriCasterMixOutput(content) {
    return isTimelineObjTriCaster(content) && content.type === timeline_state_resolver_types_1.TimelineContentTypeTriCaster.MIX_OUTPUT;
}
exports.isTimelineObjTriCasterMixOutput = isTimelineObjTriCasterMixOutput;
function isTimelineObjTriCasterMatrixOutput(content) {
    return isTimelineObjTriCaster(content) && content.type === timeline_state_resolver_types_1.TimelineContentTypeTriCaster.MATRIX_OUTPUT;
}
exports.isTimelineObjTriCasterMatrixOutput = isTimelineObjTriCasterMatrixOutput;
//# sourceMappingURL=types.js.map