"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMixTimelineStateConverter = void 0;
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const vMixStateDiffer_1 = require("./vMixStateDiffer");
const deepMerge = require("deepmerge");
const _ = require("underscore");
const mappingPriority = {
    [timeline_state_resolver_types_1.MappingVmixType.Program]: 0,
    [timeline_state_resolver_types_1.MappingVmixType.Preview]: 1,
    [timeline_state_resolver_types_1.MappingVmixType.Input]: 2,
    [timeline_state_resolver_types_1.MappingVmixType.AudioChannel]: 3,
    [timeline_state_resolver_types_1.MappingVmixType.Output]: 4,
    [timeline_state_resolver_types_1.MappingVmixType.Overlay]: 5,
    [timeline_state_resolver_types_1.MappingVmixType.Recording]: 6,
    [timeline_state_resolver_types_1.MappingVmixType.Streaming]: 7,
    [timeline_state_resolver_types_1.MappingVmixType.External]: 8,
    [timeline_state_resolver_types_1.MappingVmixType.FadeToBlack]: 9,
    [timeline_state_resolver_types_1.MappingVmixType.Fader]: 10,
    [timeline_state_resolver_types_1.MappingVmixType.Script]: 11,
};
/**
 * Converts timeline state, to a TSR representation
 */
class VMixTimelineStateConverter {
    constructor(getDefaultState, getDefaultInputState, getDefaultInputAudioState) {
        this.getDefaultState = getDefaultState;
        this.getDefaultInputState = getDefaultInputState;
        this.getDefaultInputAudioState = getDefaultInputAudioState;
    }
    getVMixStateFromTimelineState(state, mappings) {
        const deviceState = this._fillStateWithMappingsDefaults(this.getDefaultState(), mappings);
        // Sort layer based on Mapping type (to make sure audio is after inputs) and Layer name
        const sortedLayers = _.sortBy(_.map(state.layers, (tlObject, layerName) => ({
            layerName,
            tlObject,
            mapping: mappings[layerName],
        })).sort((a, b) => a.layerName.localeCompare(b.layerName)), (o) => mappingPriority[o.mapping.options.mappingType] ?? Number.POSITIVE_INFINITY);
        _.each(sortedLayers, ({ tlObject, layerName, mapping }) => {
            const content = tlObject.content;
            if (mapping && content.deviceType === timeline_state_resolver_types_1.DeviceType.VMIX) {
                switch (mapping.options.mappingType) {
                    case timeline_state_resolver_types_1.MappingVmixType.Program:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.PROGRAM) {
                            const mixProgram = (mapping.options.index || 1) - 1;
                            if (content.input !== undefined) {
                                this._switchToInput(content.input, deviceState, mixProgram, content.transition);
                            }
                            else if (content.inputLayer) {
                                this._switchToInput(content.inputLayer, deviceState, mixProgram, content.transition, true);
                            }
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.Preview:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.PREVIEW) {
                            const mixPreview = (mapping.options.index || 1) - 1;
                            const mixState = deviceState.reportedState.mixes[mixPreview];
                            if (mixState != null && content.input != null)
                                mixState.preview = content.input;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.AudioChannel:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.AUDIO) {
                            const filteredVMixTlAudio = _.pick(content, 'volume', 'balance', 'audioAuto', 'audioBuses', 'muted', 'fade');
                            if (mapping.options.index) {
                                deviceState.reportedState = this._modifyInputAudio(deviceState, filteredVMixTlAudio, {
                                    key: mapping.options.index,
                                });
                            }
                            else if (mapping.options.inputLayer) {
                                deviceState.reportedState = this._modifyInputAudio(deviceState, filteredVMixTlAudio, {
                                    layer: mapping.options.inputLayer,
                                });
                            }
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.Fader:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.FADER) {
                            deviceState.reportedState.faderPosition = content.position;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.Recording:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.RECORDING) {
                            deviceState.reportedState.recording = content.on;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.Streaming:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.STREAMING) {
                            deviceState.reportedState.streaming = content.on;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.External:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.EXTERNAL) {
                            deviceState.reportedState.external = content.on;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.FadeToBlack:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.FADE_TO_BLACK) {
                            deviceState.reportedState.fadeToBlack = content.on;
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.Input:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.INPUT) {
                            deviceState.reportedState = this._modifyInput(deviceState, {
                                type: content.inputType,
                                playing: content.playing,
                                loop: content.loop,
                                position: content.seek,
                                transform: content.transform,
                                overlays: content.overlays,
                                listFilePaths: content.listFilePaths,
                                restart: content.restart,
                            }, { key: mapping.options.index, filePath: content.filePath }, layerName);
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.Output:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.OUTPUT) {
                            deviceState.outputs[mapping.options.index] = {
                                source: content.source,
                                input: content.input,
                            };
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.Overlay:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.OVERLAY) {
                            const overlayIndex = mapping.options.index - 1;
                            const overlayState = deviceState.reportedState.overlays[overlayIndex];
                            if (overlayState != null) {
                                overlayState.input = content.input;
                            }
                        }
                        break;
                    case timeline_state_resolver_types_1.MappingVmixType.Script:
                        if (content.type === timeline_state_resolver_types_1.TimelineContentTypeVMix.SCRIPT) {
                            deviceState.runningScripts.push(content.name);
                        }
                        break;
                }
            }
        });
        return deviceState;
    }
    _modifyInput(deviceState, newInput, input, layerName) {
        let inputs = deviceState.reportedState.existingInputs;
        const filteredNewInput = _.pick(newInput, (x) => x !== undefined);
        let inputKey;
        if (input.layer) {
            inputKey = deviceState.inputLayers[input.layer];
            inputs = deviceState.reportedState.inputsAddedByUs;
        }
        else if (input.filePath) {
            inputKey = vMixStateDiffer_1.TSR_INPUT_PREFIX + input.filePath;
            inputs = deviceState.reportedState.inputsAddedByUs;
        }
        else {
            inputKey = input.key;
        }
        if (inputKey) {
            inputs[inputKey] = deepMerge(inputs[inputKey] ?? this.getDefaultInputState(inputKey), filteredNewInput);
            deviceState.inputLayers[layerName] = inputKey;
        }
        return deviceState.reportedState;
    }
    _modifyInputAudio(deviceState, newInput, input) {
        let inputs = deviceState.reportedState.existingInputsAudio;
        const filteredNewInput = _.pick(newInput, (x) => x !== undefined);
        let inputKey;
        if (input.layer) {
            inputKey = deviceState.inputLayers[input.layer];
            inputs = deviceState.reportedState.inputsAddedByUsAudio;
        }
        else {
            inputKey = input.key;
        }
        if (inputKey) {
            inputs[inputKey] = deepMerge(inputs[inputKey] ?? this.getDefaultInputAudioState(inputKey), filteredNewInput);
        }
        return deviceState.reportedState;
    }
    _switchToInput(input, deviceState, mix, transition, layerToProgram = false) {
        const mixState = deviceState.reportedState.mixes[mix];
        if (mixState == null)
            return;
        if (mixState.program === undefined ||
            mixState.program !== input // mixing numeric and string input names can be dangerous
        ) {
            mixState.preview = mixState.program;
            mixState.program = input;
            mixState.transition = transition || { effect: timeline_state_resolver_types_1.VMixTransitionType.Cut, duration: 0 };
            mixState.layerToProgram = layerToProgram;
        }
    }
    _fillStateWithMappingsDefaults(state, mappings) {
        for (const mapping of Object.values(mappings)) {
            switch (mapping.options.mappingType) {
                case timeline_state_resolver_types_1.MappingVmixType.Program:
                case timeline_state_resolver_types_1.MappingVmixType.Preview: {
                    const mixProgram = mapping.options.index || 1;
                    state.reportedState.mixes[mixProgram - 1] = {
                        number: mixProgram,
                        preview: undefined,
                        program: undefined,
                        transition: { effect: timeline_state_resolver_types_1.VMixTransitionType.Cut, duration: 0 },
                    };
                    break;
                }
                case timeline_state_resolver_types_1.MappingVmixType.Input:
                    if (mapping.options.index) {
                        state.reportedState.existingInputs[mapping.options.index] = this.getDefaultInputState(mapping.options.index);
                    }
                    break;
                case timeline_state_resolver_types_1.MappingVmixType.AudioChannel:
                    if (mapping.options.index) {
                        state.reportedState.existingInputsAudio[mapping.options.index] = this.getDefaultInputAudioState(mapping.options.index);
                    }
                    break;
                case timeline_state_resolver_types_1.MappingVmixType.Recording:
                    state.reportedState.recording = false;
                    break;
                case timeline_state_resolver_types_1.MappingVmixType.Streaming:
                    state.reportedState.streaming = false;
                    break;
                case timeline_state_resolver_types_1.MappingVmixType.External:
                    state.reportedState.external = false;
                    break;
                case timeline_state_resolver_types_1.MappingVmixType.Output:
                    state.outputs[mapping.options.index] = { source: 'Program' };
                    break;
                case timeline_state_resolver_types_1.MappingVmixType.Overlay:
                    state.reportedState.overlays[mapping.options.index - 1] = {
                        number: mapping.options.index,
                        input: undefined,
                    };
                    break;
            }
        }
        return state;
    }
}
exports.VMixTimelineStateConverter = VMixTimelineStateConverter;
//# sourceMappingURL=vMixTimelineStateConverter.js.map