import { TriCasterLayer, TriCasterKeyer, TriCasterInputName, TriCasterAudioChannelName, TriCasterMixEffectName, TriCasterMatrixOutputName, TriCasterMixOutputName, TriCasterAudioChannel, TriCasterInput, TriCasterMixEffectInEffectMode, TriCasterMixEffectWithPreview, TriCasterMixEffectInMixMode, SomeMappingTricaster, Mappings } from 'timeline-state-resolver-types';
import { TriCasterCommand, TriCasterCommandWithContext } from './triCasterCommands';
import { TriCasterShortcutStateConverter } from './triCasterShortcutStateConverter';
import { TriCasterTimelineStateConverter } from './triCasterTimelineStateConverter';
import { TriCasterInfo } from './triCasterConnection';
export type RequiredDeep<T> = T extends object ? {
    [K in keyof T]-?: RequiredDeep<T[K]>;
} : T;
export type RequireDeepExcept<T, K extends keyof T> = RequiredDeep<Omit<T, K>> & Pick<T, K>;
export interface TriCasterState {
    mixEffects: Record<TriCasterMixEffectName, TriCasterMixEffectState>;
    audioChannels: Record<TriCasterAudioChannelName, TriCasterAudioChannelState>;
    inputs: Record<TriCasterInputName, TriCasterInputState>;
    isRecording: boolean;
    isStreaming: boolean;
    mixOutputs: Record<TriCasterMixOutputName, TriCasterMixOutputState>;
    matrixOutputs: Record<TriCasterMatrixOutputName, TriCasterMatrixOutputState>;
}
export interface StateEntry<T extends any[] | string | number | boolean> {
    value: T;
    timelineObjId?: string;
    temporalPriority?: number;
}
export type WithContext<T> = T extends any[] | string | number | boolean ? StateEntry<T> : {
    [K in keyof T]: WithContext<T[K]>;
};
export type TriCasterMixEffectState = Partial<Omit<TriCasterMixEffectWithPreview & TriCasterMixEffectInEffectMode, 'transitionEffect'> & TriCasterMixEffectInMixMode> & {
    isInEffectMode?: boolean;
};
export type CompleteTriCasterMixEffectState = RequiredDeep<Omit<TriCasterMixEffectState, 'layers' | 'previewInput'>> & Pick<TriCasterMixEffectInEffectMode, 'layers'> & Partial<Pick<TriCasterMixEffectWithPreview, 'previewInput'>>;
export type TriCasterLayerState = TriCasterLayer;
export type TriCasterKeyerState = TriCasterKeyer;
export type CompleteTriCasterState = RequiredDeep<Omit<TriCasterState, 'mixEffects' | 'inputs'>> & {
    mixEffects: Record<TriCasterMixEffectName, CompleteTriCasterMixEffectState>;
    inputs: Record<TriCasterInputName, CompleteTriCasterInputState>;
};
export type TriCasterAudioChannelState = TriCasterAudioChannel;
export type TriCasterInputState = TriCasterInput;
export type CompleteTriCasterInputState = RequireDeepExcept<TriCasterInputState, 'videoSource'>;
export interface TriCasterMixOutputState {
    source?: string;
    meClean?: boolean;
}
export interface TriCasterMatrixOutputState {
    source?: string;
}
type TriCasterStateDifferOptions = TriCasterInfo;
export type MappingsTriCaster = Mappings<SomeMappingTricaster>;
export declare class TriCasterStateDiffer {
    private readonly inputCount;
    private readonly meNames;
    private readonly dskNames;
    private readonly layerNames;
    private readonly inputNames;
    private readonly audioChannelNames;
    private readonly mixOutputNames;
    private readonly matrixOutputNames;
    private readonly commandGenerator;
    readonly timelineStateConverter: TriCasterTimelineStateConverter;
    readonly shortcutStateConverter: TriCasterShortcutStateConverter;
    constructor(options: TriCasterStateDifferOptions);
    getDefaultState(mappings: MappingsTriCaster): WithContext<CompleteTriCasterState>;
    private getControlledResourcesNames;
    private getDefaultLayerState;
    private getDefaultKeyerState;
    getCommandsToAchieveState(newState: WithContext<TriCasterState>, oldState: WithContext<TriCasterState>): TriCasterCommandWithContext[];
    private getGenerator;
    private inputCommandGenerator;
    private audioCommandGenerator;
    private mixOutputCommandGenerator;
    private matrixOutputCommandGenerator;
    private keyerEffectCommandGenerator;
    private mixEffectEffectCommandGenerator;
    private effectCommandGenerator;
    private durationCommandGenerator;
    private layerCommandGenerator;
    private keyerCommandGenerator;
    private getMixEffectGenerator;
    private delegateCommandGenerator;
    private previewInputCommandGenerator;
    private programInputCommandGenerator;
    private recursivelyGenerateCommands;
    private isEqual;
    private isEmpty;
}
export declare function fillRecord<T extends string, U>(keys: T[], mapFn: (key: T) => U): Record<T, U>;
export declare function fillRecord<T extends string, U>(keys: T[], value: U): Record<T, U>;
export declare function wrapStateInContext<T extends object>(state: T): WithContext<T>;
export declare function wrapInContext(command: TriCasterCommand, entry: StateEntry<any>): TriCasterCommandWithContext;
export declare function isStateEntry(possibleEntry: WithContext<any> | WithContext<any>[keyof WithContext<any>]): possibleEntry is StateEntry<any>;
export {};
//# sourceMappingURL=triCasterStateDiffer.d.ts.map