"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriCasterTimelineStateConverter = void 0;
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const _ = require("underscore");
const triCasterStateDiffer_1 = require("./triCasterStateDiffer");
const types_1 = require("./types");
class TriCasterTimelineStateConverter {
    constructor(getDefaultState, resourceNames) {
        this.getDefaultState = getDefaultState;
        this.meNames = new Set(resourceNames.mixEffects);
        this.inputNames = new Set(resourceNames.inputs);
        this.audioChannelNames = new Set(resourceNames.audioChannels);
        this.mixOutputNames = new Set(resourceNames.mixOutputs);
        this.matrixOutputNames = new Set(resourceNames.matrixOutputs);
    }
    getTriCasterStateFromTimelineState(timelineState, newMappings) {
        const resultState = this.getDefaultState(newMappings);
        const sortedLayers = this.sortLayers(timelineState);
        for (const { tlObject, layerName } of sortedLayers) {
            const mapping = newMappings[layerName];
            if (!mapping) {
                continue;
            }
            switch (mapping.options.mappingType) {
                case timeline_state_resolver_types_1.MappingTricasterType.ME:
                    this.applyMixEffectState(resultState, tlObject, mapping.options);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.DSK:
                    this.applyDskState(resultState, tlObject, mapping.options);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.INPUT:
                    this.applyInputState(resultState, tlObject, mapping.options);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.AUDIOCHANNEL:
                    this.applyAudioChannelState(resultState, tlObject, mapping.options);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.MIXOUTPUT:
                    this.applyMixOutputState(resultState, tlObject, mapping.options);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.MATRIXOUTPUT:
                    this.applyMatrixOutputState(resultState, tlObject, mapping.options);
                    break;
            }
        }
        return resultState;
    }
    sortLayers(state) {
        return _.map(state.layers, (tlObject, layerName) => ({
            layerName,
            tlObject: tlObject,
        })).sort((a, b) => a.layerName.localeCompare(b.layerName));
    }
    applyMixEffectState(resultState, tlObject, mapping) {
        const mixEffects = resultState.mixEffects;
        if (!(0, types_1.isTimelineObjTriCasterME)(tlObject.content) || !this.meNames.has(mapping.name))
            return;
        this.deepApplyToExtendedState(mixEffects[mapping.name], tlObject.content.me, tlObject);
        const mixEffect = tlObject.content.me;
        if ('layers' in mixEffect && Object.keys(mixEffect.layers ?? []).length) {
            mixEffects[mapping.name].isInEffectMode = { value: true };
        }
    }
    applyDskState(resultState, tlObject, mapping) {
        const mainKeyers = resultState.mixEffects['main'];
        if (!(0, types_1.isTimelineObjTriCasterDSK)(tlObject.content) || !mainKeyers) {
            return;
        }
        this.deepApplyToExtendedState(mainKeyers[mapping.name], tlObject.content.keyer, tlObject);
    }
    applyInputState(resultState, tlObject, mapping) {
        const inputs = resultState.inputs;
        if (!(0, types_1.isTimelineObjTriCasterInput)(tlObject.content) || !this.inputNames.has(mapping.name))
            return;
        this.deepApplyToExtendedState(inputs[mapping.name], tlObject.content.input, tlObject);
    }
    applyAudioChannelState(resultState, tlObject, mapping) {
        const audioChannels = resultState.audioChannels;
        if (!(0, types_1.isTimelineObjTriCasterAudioChannel)(tlObject.content) ||
            !this.audioChannelNames.has(mapping.name))
            return;
        this.deepApplyToExtendedState(audioChannels[mapping.name], tlObject.content.audioChannel, tlObject);
    }
    applyMixOutputState(resultState, tlObject, mapping) {
        if (!(0, types_1.isTimelineObjTriCasterMixOutput)(tlObject.content) ||
            !this.mixOutputNames.has(mapping.name))
            return;
        resultState.mixOutputs[mapping.name] = {
            source: {
                value: tlObject.content.source,
                timelineObjId: tlObject.id,
                temporalPriority: tlObject.content.temporalPriority,
            },
            meClean: tlObject.content.meClean !== undefined
                ? {
                    value: tlObject.content.meClean,
                    timelineObjId: tlObject.id,
                    temporalPriority: tlObject.content.temporalPriority,
                }
                : resultState.mixOutputs[mapping.name]?.meClean,
        };
    }
    applyMatrixOutputState(resultState, tlObject, mapping) {
        if (!(0, types_1.isTimelineObjTriCasterMatrixOutput)(tlObject.content) ||
            !this.matrixOutputNames.has(mapping.name))
            return;
        resultState.matrixOutputs[mapping.name] = {
            source: {
                value: tlObject.content.source,
                timelineObjId: tlObject.id,
                temporalPriority: tlObject.content.temporalPriority,
            },
        };
    }
    /**
     * Deeply applies primitive properties from `source` to existing properties of `target` (in place)
     */
    deepApplyToExtendedState(target, source, timelineObject) {
        if (!(0, types_1.isTimelineObjTriCaster)(timelineObject.content))
            return;
        let key;
        for (key in source) {
            const sourceValue = source[key];
            if (typeof target !== 'object' || !(key in target) || sourceValue === undefined || sourceValue === null)
                continue;
            const targetEntry = target[key];
            if ((0, triCasterStateDiffer_1.isStateEntry)(targetEntry)) {
                targetEntry.value = sourceValue;
                targetEntry.timelineObjId = timelineObject.id;
                targetEntry.temporalPriority = timelineObject.content.temporalPriority;
            }
            else if (targetEntry && typeof targetEntry === 'object') {
                this.deepApplyToExtendedState(targetEntry, sourceValue, timelineObject);
            }
        }
    }
}
exports.TriCasterTimelineStateConverter = TriCasterTimelineStateConverter;
//# sourceMappingURL=triCasterTimelineStateConverter.js.map