"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineContentTypeOBS = exports.OBSRequest = void 0;
var OBSRequest;
(function (OBSRequest) {
    OBSRequest["SET_CURRENT_SCENE"] = "SetCurrentScene";
    OBSRequest["SET_PREVIEW_SCENE"] = "SetPreviewScene";
    OBSRequest["SET_CURRENT_TRANSITION"] = "SetCurrentTransition";
    OBSRequest["START_RECORDING"] = "StartRecording";
    OBSRequest["STOP_RECORDING"] = "StopRecording";
    OBSRequest["START_STREAMING"] = "StartStreaming";
    OBSRequest["STOP_STREAMING"] = "StopStreaming";
    OBSRequest["SET_SCENE_ITEM_RENDEER"] = "SetSceneItemRender";
    OBSRequest["SET_MUTE"] = "SetMute";
    OBSRequest["SET_SOURCE_SETTINGS"] = "SetSourceSettings";
})(OBSRequest = exports.OBSRequest || (exports.OBSRequest = {}));
var TimelineContentTypeOBS;
(function (TimelineContentTypeOBS) {
    TimelineContentTypeOBS["CURRENT_SCENE"] = "CURRENT_SCENE";
    TimelineContentTypeOBS["CURRENT_TRANSITION"] = "CURRENT_TRANSITION";
    TimelineContentTypeOBS["RECORDING"] = "RECORDING";
    TimelineContentTypeOBS["STREAMING"] = "STREAMING";
    TimelineContentTypeOBS["SCENE_ITEM_RENDER"] = "SCENE_ITEM_RENDER";
    TimelineContentTypeOBS["MUTE"] = "MUTE";
    TimelineContentTypeOBS["SOURCE_SETTINGS"] = "SOURCE_SETTINGS";
})(TimelineContentTypeOBS = exports.TimelineContentTypeOBS || (exports.TimelineContentTypeOBS = {}));
//# sourceMappingURL=obs.js.map