"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeToWebSocketMessage = exports.CommandName = void 0;
/**
 * Values in this enum correspond to actual shortcut names or their suffixes
 */
var CommandName;
(function (CommandName) {
    // preview / program or effect layers
    CommandName["ROW"] = "_row";
    CommandName["ROW_NAMED_INPUT"] = "_row_named_input";
    CommandName["TOGGLE_MIX_EFFECT_MODE"] = "_toggle_mix_effect_mode";
    // transitions
    CommandName["TAKE"] = "_take";
    CommandName["AUTO"] = "_auto";
    CommandName["SELECT_INDEX"] = "_select_index";
    CommandName["SET_MIX_EFFECT_BIN_INDEX"] = "_set_mix_effect_bin_index";
    CommandName["SPEED"] = "_speed";
    CommandName["DELEGATE"] = "_delegate";
    // dsk
    CommandName["VALUE"] = "_value";
    CommandName["SELECT_NAMED_INPUT"] = "_select_named_input";
    // positioning
    CommandName["POSITION_X"] = "_position_x";
    CommandName["POSITION_Y"] = "_position_y";
    CommandName["SCALE_X"] = "_scale_x";
    CommandName["SCALE_Y"] = "_scale_y";
    CommandName["ROTATION_X"] = "_rotation_x";
    CommandName["ROTATION_Y"] = "_rotation_y";
    CommandName["ROTATION_Z"] = "_rotation_z";
    CommandName["CROP_LEFT_VALUE"] = "_crop_left_value";
    CommandName["CROP_RIGHT_VALUE"] = "_crop_right_value";
    CommandName["CROP_UP_VALUE"] = "_crop_up_value";
    CommandName["CROP_DOWN_VALUE"] = "_crop_down_value";
    CommandName["FEATHER_VALUE"] = "_feather_value";
    CommandName["POSITIONING_AND_CROP_ENABLE"] = "_positioning_and_crop_enable";
    // input
    CommandName["VIDEO_SOURCE"] = "_video_source";
    CommandName["VIDEO_ACT_AS_ALPHA"] = "_video_act_as_alpha";
    // audio
    CommandName["VOLUME"] = "_volume";
    CommandName["MUTE"] = "_mute";
    // recording
    CommandName["RECORD_TOGGLE"] = "record_toggle";
    // streaming
    CommandName["STREAMING_TOGGLE"] = "streaming_toggle";
    // outputs
    CommandName["OUTPUT_SOURCE"] = "_output_source";
    CommandName["CROSSPOINT_SOURCE"] = "_crosspoint_source";
    CommandName["SET_OUTPUT_CONFIG_VIDEO_SOURCE"] = "set_output_config_video_source";
})(CommandName = exports.CommandName || (exports.CommandName = {}));
function serializeToWebSocketMessage(command) {
    const name = `name=${'target' in command ? command.target : ''}${command.name}`;
    const values = Object.keys(command)
        .filter((key) => key !== 'target' && key !== 'name')
        .map((key) => `&${key}=${command[key]}`)
        .join('');
    return name + values;
}
exports.serializeToWebSocketMessage = serializeToWebSocketMessage;
//# sourceMappingURL=triCasterCommands.js.map