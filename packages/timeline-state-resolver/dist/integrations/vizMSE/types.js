"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVIZMSEPlayoutItemContentInternal = exports.isVIZMSEPlayoutItemContentExternal = exports.isVizMSEPlayoutItemContentInternalInstance = exports.isVizMSEPlayoutItemContentExternalInstance = exports.VizMSECommandType = void 0;
var VizMSECommandType;
(function (VizMSECommandType) {
    VizMSECommandType["PREPARE_ELEMENT"] = "prepare";
    VizMSECommandType["CUE_ELEMENT"] = "cue";
    VizMSECommandType["TAKE_ELEMENT"] = "take";
    VizMSECommandType["TAKEOUT_ELEMENT"] = "out";
    VizMSECommandType["CONTINUE_ELEMENT"] = "continue";
    VizMSECommandType["CONTINUE_ELEMENT_REVERSE"] = "continuereverse";
    VizMSECommandType["LOAD_ALL_ELEMENTS"] = "load_all_elements";
    VizMSECommandType["CLEAR_ALL_ELEMENTS"] = "clear_all_elements";
    VizMSECommandType["CLEAR_ALL_ENGINES"] = "clear_all_engines";
    VizMSECommandType["INITIALIZE_SHOWS"] = "initialize_shows";
    VizMSECommandType["CLEANUP_SHOWS"] = "cleanup_shows";
    VizMSECommandType["SET_CONCEPT"] = "set_concept";
})(VizMSECommandType = exports.VizMSECommandType || (exports.VizMSECommandType = {}));
function isVizMSEPlayoutItemContentExternalInstance(content) {
    return content.vcpid !== undefined;
}
exports.isVizMSEPlayoutItemContentExternalInstance = isVizMSEPlayoutItemContentExternalInstance;
function isVizMSEPlayoutItemContentInternalInstance(content) {
    return content.templateName !== undefined;
}
exports.isVizMSEPlayoutItemContentInternalInstance = isVizMSEPlayoutItemContentInternalInstance;
function isVIZMSEPlayoutItemContentExternal(content) {
    return content.vcpid !== undefined;
}
exports.isVIZMSEPlayoutItemContentExternal = isVIZMSEPlayoutItemContentExternal;
function isVIZMSEPlayoutItemContentInternal(content) {
    return content.templateName !== undefined;
}
exports.isVIZMSEPlayoutItemContentInternal = isVIZMSEPlayoutItemContentInternal;
//# sourceMappingURL=types.js.map