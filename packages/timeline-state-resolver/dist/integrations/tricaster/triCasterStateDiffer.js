"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStateEntry = exports.wrapInContext = exports.wrapStateInContext = exports.fillRecord = exports.TriCasterStateDiffer = void 0;
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const triCasterCommands_1 = require("./triCasterCommands");
const triCasterShortcutStateConverter_1 = require("./triCasterShortcutStateConverter");
const triCasterTimelineStateConverter_1 = require("./triCasterTimelineStateConverter");
const _ = require("underscore");
const BLACK_INPUT = 'black';
const DEFAULT_TRANSITION_DURATION = 1; // in seconds
const A_ROW_SUFFIX = '_a'; // the Program row
const B_ROW_SUFFIX = '_b'; // the Preview row
const MATRIX_OUTPUTS_COUNT = 8; // @todo: hardcoded for now; only a few models have this feature; how to query for it?
const DEFAULT_TEMPORAL_PRIORITY = 0;
class TriCasterStateDiffer {
    constructor(options) {
        this.layerNames = ['a', 'b', 'c', 'd'];
        this.inputCommandGenerator = {
            videoSource: triCasterCommands_1.CommandName.VIDEO_SOURCE,
            videoActAsAlpha: triCasterCommands_1.CommandName.VIDEO_ACT_AS_ALPHA,
        };
        this.audioCommandGenerator = {
            volume: triCasterCommands_1.CommandName.VOLUME,
            isMuted: triCasterCommands_1.CommandName.MUTE,
        };
        this.mixOutputCommandGenerator = {
            source: triCasterCommands_1.CommandName.OUTPUT_SOURCE,
            meClean: ({ entry, target }) => {
                const outputIndex = Number(target.match(/\d+/)?.[0]) - 1;
                return [
                    wrapInContext({ name: triCasterCommands_1.CommandName.SET_OUTPUT_CONFIG_VIDEO_SOURCE, output_index: outputIndex, me_clean: entry.value }, entry),
                ];
            },
        };
        this.matrixOutputCommandGenerator = {
            source: triCasterCommands_1.CommandName.CROSSPOINT_SOURCE,
        };
        this.keyerEffectCommandGenerator = this.effectCommandGenerator(triCasterCommands_1.CommandName.SELECT_INDEX);
        this.mixEffectEffectCommandGenerator = this.effectCommandGenerator(triCasterCommands_1.CommandName.SET_MIX_EFFECT_BIN_INDEX);
        this.durationCommandGenerator = ({ entry, state, oldState, target }) => {
            if (!oldState || state.transitionEffect?.value !== oldState.transitionEffect?.value) {
                return [];
            }
            return [wrapInContext({ name: triCasterCommands_1.CommandName.SPEED, target, value: entry.value }, entry)];
        };
        this.layerCommandGenerator = {
            position: {
                x: triCasterCommands_1.CommandName.POSITION_X,
                y: triCasterCommands_1.CommandName.POSITION_Y,
            },
            scale: {
                x: triCasterCommands_1.CommandName.SCALE_X,
                y: triCasterCommands_1.CommandName.SCALE_Y,
            },
            rotation: {
                x: triCasterCommands_1.CommandName.ROTATION_X,
                y: triCasterCommands_1.CommandName.ROTATION_Y,
                z: triCasterCommands_1.CommandName.ROTATION_Z,
            },
            crop: {
                left: triCasterCommands_1.CommandName.CROP_LEFT_VALUE,
                right: triCasterCommands_1.CommandName.CROP_RIGHT_VALUE,
                up: triCasterCommands_1.CommandName.CROP_UP_VALUE,
                down: triCasterCommands_1.CommandName.CROP_DOWN_VALUE,
            },
            feather: triCasterCommands_1.CommandName.FEATHER_VALUE,
            positioningAndCropEnabled: triCasterCommands_1.CommandName.POSITIONING_AND_CROP_ENABLE,
            input: triCasterCommands_1.CommandName.ROW_NAMED_INPUT,
        };
        this.keyerCommandGenerator = {
            transitionEffect: this.keyerEffectCommandGenerator,
            transitionDuration: this.durationCommandGenerator,
            ...this.layerCommandGenerator,
            input: triCasterCommands_1.CommandName.SELECT_NAMED_INPUT,
            onAir: ({ state, target, entry }) => {
                if (state.transitionEffect?.value === 'cut') {
                    return [wrapInContext({ name: triCasterCommands_1.CommandName.VALUE, target, value: entry.value ? 1 : 0 }, entry)];
                }
                // @todo: transitions on keyers are dangerous when mappings change on the fly and
                // an uncontrolled ME becomes controlled (the state might get flipped)
                // fixing it is out of scope for now
                return [wrapInContext({ name: triCasterCommands_1.CommandName.AUTO, target }, entry)];
            },
        };
        this.delegateCommandGenerator = ({ entry, oldEntry, target, }) => {
            const newValue = [...entry.value].sort();
            const oldValue = oldEntry?.value ? [...oldEntry.value].sort() : [];
            if (_.isEqual(newValue, oldValue))
                return null;
            const combinedValue = newValue.map((delegateName) => `${target}_${delegateName}`).join('|');
            return [wrapInContext({ name: triCasterCommands_1.CommandName.DELEGATE, target, value: combinedValue }, entry)];
        };
        this.previewInputCommandGenerator = ({ entry, state, target, }) => {
            if (state.transitionEffect?.value !== 'cut') {
                return null;
            }
            return [
                wrapInContext({ name: triCasterCommands_1.CommandName.ROW_NAMED_INPUT, value: entry.value, target: target + B_ROW_SUFFIX }, entry),
            ];
        };
        this.programInputCommandGenerator = ({ entry, state, target, }) => {
            if (state.transitionEffect?.value === 'cut') {
                if (!state.previewInput?.value) {
                    return [
                        wrapInContext({ name: triCasterCommands_1.CommandName.ROW_NAMED_INPUT, value: entry.value, target: target + B_ROW_SUFFIX }, entry),
                        wrapInContext({ name: triCasterCommands_1.CommandName.TAKE, target }, entry),
                    ];
                }
                return [
                    wrapInContext({ name: triCasterCommands_1.CommandName.ROW_NAMED_INPUT, value: entry.value, target: target + A_ROW_SUFFIX }, entry),
                ];
            }
            return [
                wrapInContext({ name: triCasterCommands_1.CommandName.ROW_NAMED_INPUT, value: entry.value, target: target + B_ROW_SUFFIX }, entry),
                wrapInContext({ name: triCasterCommands_1.CommandName.AUTO, target }, entry),
            ];
        };
        this.inputCount = options.inputCount;
        this.meNames = ['main', ...fillArray(options.meCount, (i) => `v${i + 1}`)];
        this.dskNames = fillArray(options.dskCount, (i) => `dsk${i + 1}`);
        this.inputNames = fillArray(this.inputCount, (i) => `input${i + 1}`);
        const extraAudioChannelNames = [
            ...fillArray(options.ddrCount, (i) => `ddr${i + 1}`),
            'sound',
            'master',
        ];
        this.audioChannelNames = [...extraAudioChannelNames, ...this.inputNames];
        this.mixOutputNames = fillArray(options.outputCount, (i) => `mix${i + 1}`);
        this.matrixOutputNames = fillArray(MATRIX_OUTPUTS_COUNT, (i) => `out${i + 1}`);
        this.commandGenerator = this.getGenerator();
        const resourceNames = {
            mixEffects: this.meNames,
            inputs: this.inputNames,
            audioChannels: this.audioChannelNames,
            layers: this.layerNames,
            keyers: this.dskNames,
            mixOutputs: this.mixOutputNames,
            matrixOutputs: this.matrixOutputNames,
        };
        this.timelineStateConverter = new triCasterTimelineStateConverter_1.TriCasterTimelineStateConverter((mappings) => this.getDefaultState(mappings), resourceNames);
        this.shortcutStateConverter = new triCasterShortcutStateConverter_1.TriCasterShortcutStateConverter(resourceNames);
    }
    getDefaultState(mappings) {
        const controlledResources = this.getControlledResourcesNames(mappings);
        return wrapStateInContext({
            mixEffects: fillRecord(Array.from(controlledResources.mixEffects), (meName) => ({
                programInput: BLACK_INPUT,
                previewInput: undefined,
                isInEffectMode: false,
                transitionEffect: 'cut',
                transitionDuration: DEFAULT_TRANSITION_DURATION,
                layers: meName !== 'main' ? fillRecord(this.layerNames, () => this.getDefaultLayerState()) : {},
                keyers: fillRecord(this.dskNames, () => this.getDefaultKeyerState()),
                delegates: ['background'],
            })),
            inputs: fillRecord(Array.from(controlledResources.inputs), () => ({ videoSource: undefined, videoActAsAlpha: false })),
            audioChannels: fillRecord(Array.from(controlledResources.audioChannels), () => ({ volume: 0, isMuted: true })),
            isRecording: false,
            isStreaming: false,
            mixOutputs: fillRecord(Array.from(controlledResources.mixOutputs), () => ({ source: 'program', meClean: false })),
            matrixOutputs: fillRecord(Array.from(controlledResources.matrixOutputs), () => ({ source: 'mix1' })),
        });
    }
    getControlledResourcesNames(mappings) {
        const result = {
            mixEffects: new Set(),
            inputs: new Set(),
            audioChannels: new Set(),
            mixOutputs: new Set(),
            matrixOutputs: new Set(),
        };
        for (const mapping of Object.values(mappings)) {
            switch (mapping.options.mappingType) {
                case timeline_state_resolver_types_1.MappingTricasterType.ME:
                    result.mixEffects.add(mapping.options.name);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.DSK:
                    // these require full control of the Main switcher - not ideal, the granularity will probably be improved
                    result.mixEffects.add('main');
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.INPUT:
                    result.inputs.add(mapping.options.name);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.AUDIOCHANNEL:
                    result.audioChannels.add(mapping.options.name);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.MIXOUTPUT:
                    result.mixOutputs.add(mapping.options.name);
                    break;
                case timeline_state_resolver_types_1.MappingTricasterType.MATRIXOUTPUT:
                    result.matrixOutputs.add(mapping.options.name);
                    break;
            }
        }
        return result;
    }
    getDefaultLayerState() {
        return {
            input: BLACK_INPUT,
            positioningAndCropEnabled: false,
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: { x: 0, y: 0, z: 0 },
            crop: { left: 0, right: 0, up: 0, down: 0 },
            feather: 0,
        };
    }
    getDefaultKeyerState() {
        return {
            onAir: false,
            transitionEffect: 'cut',
            transitionDuration: DEFAULT_TRANSITION_DURATION,
            ...this.getDefaultLayerState(),
        };
    }
    getCommandsToAchieveState(newState, oldState) {
        const commands = [];
        this.recursivelyGenerateCommands(commands, this.commandGenerator, newState, oldState, '');
        return commands.sort((a, b) => a.temporalPriority - b.temporalPriority); // is this fast enough? consider bucket sort
    }
    getGenerator() {
        return {
            mixEffects: fillRecord(this.meNames, (meName) => this.getMixEffectGenerator(meName)),
            inputs: fillRecord(this.inputNames, (inputName) => ({ $target: inputName, ...this.inputCommandGenerator })),
            audioChannels: fillRecord(this.audioChannelNames, (inputName) => ({
                $target: inputName,
                ...this.audioCommandGenerator,
            })),
            isRecording: ({ entry }) => [
                wrapInContext({ name: triCasterCommands_1.CommandName.RECORD_TOGGLE, value: entry.value ? 1 : 0 }, entry),
            ],
            isStreaming: ({ entry }) => [
                wrapInContext({ name: triCasterCommands_1.CommandName.STREAMING_TOGGLE, value: entry.value ? 1 : 0 }, entry),
            ],
            mixOutputs: fillRecord(this.mixOutputNames, (mixOutputName) => ({
                $target: mixOutputName,
                ...this.mixOutputCommandGenerator,
            })),
            matrixOutputs: fillRecord(this.matrixOutputNames, (matrixOutputName) => ({
                $target: matrixOutputName,
                ...this.matrixOutputCommandGenerator,
            })),
        };
    }
    effectCommandGenerator(selectCommand) {
        return ({ entry, target, state }) => {
            if (entry.value === 'cut') {
                return [];
            }
            const value = entry.value === 'fade' ? 0 : entry.value;
            return [
                wrapInContext({ name: selectCommand, target, value }, entry),
                wrapInContext({ name: triCasterCommands_1.CommandName.SPEED, target, value: state.transitionDuration?.value ?? DEFAULT_TRANSITION_DURATION }, entry),
            ];
        };
    }
    getMixEffectGenerator(meName) {
        return ({ entry, oldEntry, target }) => {
            const commands = [];
            this.recursivelyGenerateCommands(commands, {
                $target: meName,
                isInEffectMode: null,
                transitionEffect: this.mixEffectEffectCommandGenerator,
                transitionDuration: this.durationCommandGenerator,
                delegates: this.delegateCommandGenerator,
                keyers: fillRecord(this.dskNames, (name) => ({ $target: name, ...this.keyerCommandGenerator })),
                layers: null,
                previewInput: !entry.isInEffectMode?.value ? this.previewInputCommandGenerator : null,
                programInput: !entry.isInEffectMode?.value ? this.programInputCommandGenerator : null,
            }, entry, oldEntry, target);
            if (entry.isInEffectMode?.value && entry.layers) {
                this.recursivelyGenerateCommands(commands, fillRecord(this.layerNames, (name) => ({
                    $target: name,
                    ...this.layerCommandGenerator,
                })), entry.layers, entry.isInEffectMode.value !== oldEntry?.isInEffectMode?.value ? undefined : oldEntry?.layers, meName);
            }
            return commands;
        };
    }
    recursivelyGenerateCommands(commandsOut, rootCommandGenerator, state, oldState, target) {
        if (rootCommandGenerator.$target) {
            target += `${target ? '_' : ''}${rootCommandGenerator.$target}`;
        }
        let key; // this is safe only when rootCommandGenerator is exactly of type CommandGenerator<Y>
        for (key in rootCommandGenerator) {
            if (key === '$target')
                continue;
            const generator = rootCommandGenerator[key];
            const entry = state[key];
            const oldEntry = oldState?.[key];
            if (this.isEmpty(entry))
                continue;
            if (typeof generator === 'function') {
                if (this.isEqual(entry, oldEntry))
                    continue;
                const generatedCommands = generator({
                    entry: entry,
                    oldEntry: oldEntry,
                    state: state,
                    oldState,
                    target,
                });
                if (!generatedCommands)
                    continue;
                commandsOut.push(...generatedCommands);
            }
            else if (typeof generator === 'string') {
                if (!isStateEntry(entry) || this.isEqual(entry, oldEntry))
                    continue;
                commandsOut.push(wrapInContext({ name: generator, value: entry.value, target }, entry));
            }
            else if (generator) {
                this.recursivelyGenerateCommands(commandsOut, generator, entry, oldEntry, target);
            }
        }
    }
    isEqual(entry, oldEntry) {
        return isStateEntry(entry) && isStateEntry(oldEntry) && entry.value === oldEntry.value;
    }
    isEmpty(entry) {
        return (entry === undefined ||
            entry === null ||
            (isStateEntry(entry) && (entry.value === undefined || entry.value === null)));
    }
}
exports.TriCasterStateDiffer = TriCasterStateDiffer;
function fillArray(length, valueOrMapFn) {
    return valueOrMapFn instanceof Function
        ? Array.from({ length }, (_, i) => valueOrMapFn(i))
        : new Array(length).fill(valueOrMapFn);
}
function fillRecord(keys, valueOrMapFn) {
    return keys.reduce((accumulator, key) => {
        accumulator[key] = valueOrMapFn instanceof Function ? valueOrMapFn(key) : valueOrMapFn;
        return accumulator;
    }, {});
}
exports.fillRecord = fillRecord;
function wrapStateInContext(state) {
    if (_.isObject(state) && !_.isArray(state)) {
        return _.mapObject(state, (value) => wrapStateInContext(value));
    }
    return { value: state };
}
exports.wrapStateInContext = wrapStateInContext;
function wrapInContext(command, entry) {
    return {
        command,
        timelineObjId: entry.timelineObjId,
        temporalPriority: entry.temporalPriority ?? DEFAULT_TEMPORAL_PRIORITY,
    };
}
exports.wrapInContext = wrapInContext;
function isStateEntry(possibleEntry) {
    return possibleEntry && typeof possibleEntry === 'object' && 'value' in possibleEntry;
}
exports.isStateEntry = isStateEntry;
//# sourceMappingURL=triCasterStateDiffer.js.map