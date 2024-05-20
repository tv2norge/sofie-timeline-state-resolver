"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriCasterShortcutStateConverter = void 0;
const xml_js_1 = require("xml-js");
const triCasterStateDiffer_1 = require("./triCasterStateDiffer");
const triCasterCommands_1 = require("./triCasterCommands");
class TriCasterShortcutStateConverter {
    constructor(resourceNames) {
        this.resourceNames = resourceNames;
    }
    getTriCasterStateFromShortcutState(shortcutStatesXml) {
        const parsedStates = (0, xml_js_1.xml2js)(shortcutStatesXml, { compact: true });
        const shortcutStateElement = parsedStates.shortcut_states?.shortcut_state;
        const shortcutStates = this.extractShortcutStates(shortcutStateElement);
        return {
            mixEffects: this.parseMixEffectsState(shortcutStates),
            inputs: this.parseInputsState(),
            mixOutputs: this.parseMixOutputsState(shortcutStates),
            matrixOutputs: this.parseMatrixOutputsState(shortcutStates),
            audioChannels: this.parseAudioChannelsState(shortcutStates),
            isRecording: { value: this.parseNumber(shortcutStates, [], triCasterCommands_1.CommandName.RECORD_TOGGLE) === 1 },
            isStreaming: { value: this.parseNumber(shortcutStates, [], triCasterCommands_1.CommandName.STREAMING_TOGGLE) === 1 },
        };
    }
    extractShortcutStates(shortcutState) {
        if (Array.isArray(shortcutState)) {
            const shortcutStatesRecord = shortcutState.reduce((accumulator, newValue) => {
                const name = newValue._attributes?.name;
                const value = newValue._attributes?.value;
                if (name !== undefined && value !== undefined) {
                    accumulator[name] = value;
                }
                return accumulator;
            }, {});
            return shortcutStatesRecord;
        }
        if (typeof shortcutState === 'object') {
            const name = shortcutState._attributes?.name;
            const value = shortcutState._attributes?.value;
            if (name !== undefined && value !== undefined) {
                return { [name]: value };
            }
        }
        throw new Error('Shortcut state parsing error');
    }
    parseMixEffectsState(shortcutStates) {
        return (0, triCasterStateDiffer_1.fillRecord)(this.resourceNames.mixEffects, (mixEffectName) => ({
            ...(0, triCasterStateDiffer_1.wrapStateInContext)({
                programInput: this.parseString(shortcutStates, [`${mixEffectName}_a`], triCasterCommands_1.CommandName.ROW_NAMED_INPUT)?.toLowerCase(),
                previewInput: this.parseString(shortcutStates, [`${mixEffectName}_b`], triCasterCommands_1.CommandName.ROW_NAMED_INPUT)?.toLowerCase(),
                delegates: this.parseDelegate(shortcutStates, mixEffectName + triCasterCommands_1.CommandName.DELEGATE),
            }),
            ...{
                layers: this.parseLayersState(shortcutStates, mixEffectName),
                keyers: this.parseKeyersState(shortcutStates, mixEffectName),
            },
        }));
    }
    parseLayersState(shortcutStates, mixEffectName) {
        return (0, triCasterStateDiffer_1.fillRecord)(this.resourceNames.layers, (layerName) => (0, triCasterStateDiffer_1.wrapStateInContext)({
            input: this.parseString(shortcutStates, [mixEffectName, layerName], triCasterCommands_1.CommandName.ROW_NAMED_INPUT),
        }));
    }
    parseKeyersState(shortcutStates, mixEffectName) {
        return (0, triCasterStateDiffer_1.fillRecord)(this.resourceNames.keyers, (keyerName) => (0, triCasterStateDiffer_1.wrapStateInContext)({
            input: this.parseString(shortcutStates, [mixEffectName, keyerName], triCasterCommands_1.CommandName.SELECT_NAMED_INPUT),
            onAir: this.parseNumber(shortcutStates, [mixEffectName, keyerName], triCasterCommands_1.CommandName.VALUE) !== 0,
        }));
    }
    parseInputsState() {
        return (0, triCasterStateDiffer_1.fillRecord)(this.resourceNames.inputs, () => (0, triCasterStateDiffer_1.wrapStateInContext)({
            videoSource: undefined,
        }));
    }
    parseMixOutputsState(shortcutStates) {
        return (0, triCasterStateDiffer_1.fillRecord)(this.resourceNames.mixOutputs, (mixOutputName) => (0, triCasterStateDiffer_1.wrapStateInContext)({
            source: this.parseString(shortcutStates, [mixOutputName], triCasterCommands_1.CommandName.OUTPUT_SOURCE)?.toLowerCase(),
        }));
    }
    parseMatrixOutputsState(shortcutStates) {
        return (0, triCasterStateDiffer_1.fillRecord)(this.resourceNames.matrixOutputs, (matrixOutputName) => (0, triCasterStateDiffer_1.wrapStateInContext)({
            source: this.parseString(shortcutStates, [matrixOutputName], triCasterCommands_1.CommandName.CROSSPOINT_SOURCE)?.toLowerCase(),
        }));
    }
    parseAudioChannelsState(shortcutStates) {
        return (0, triCasterStateDiffer_1.fillRecord)(this.resourceNames.audioChannels, (audioChannelName) => (0, triCasterStateDiffer_1.wrapStateInContext)({
            volume: this.parseNumber(shortcutStates, [audioChannelName], triCasterCommands_1.CommandName.VOLUME),
            isMuted: this.parseBoolean(shortcutStates, [audioChannelName], triCasterCommands_1.CommandName.MUTE),
        }));
    }
    parseString(shortcutStates, shortcutTarget, command) {
        const value = shortcutStates[this.joinShortcutName(shortcutTarget, command)];
        return value?.toString();
    }
    parseNumber(shortcutStates, shortcutTarget, command) {
        const value = shortcutStates[this.joinShortcutName(shortcutTarget, command)];
        if (value === undefined)
            return undefined;
        return typeof value === 'number' ? value : parseFloat(value);
    }
    parseBoolean(shortcutStates, shortcutTarget, command) {
        const value = shortcutStates[this.joinShortcutName(shortcutTarget, command)];
        return value?.toString()?.toLowerCase() === 'true';
    }
    joinShortcutName(shortcutTarget, command) {
        return shortcutTarget.join('_') + command;
    }
    parseDelegate(shortcutStates, name) {
        const value = shortcutStates[name];
        if (typeof value !== 'string')
            return undefined;
        return value?.split('|').map((delegate) => delegate.split('_')[1]);
    }
}
exports.TriCasterShortcutStateConverter = TriCasterShortcutStateConverter;
//# sourceMappingURL=triCasterShortcutStateConverter.js.map