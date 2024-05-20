import { VMixInputOverlays, VMixInputType, VMixTransform, VMixTransition } from 'timeline-state-resolver-types';
import { VMixStateCommandWithContext } from './vMixCommands';
/** Prefix of media input added by TSR. Only those with this prefix can be removed by this implementation */
export declare const TSR_INPUT_PREFIX = "TSR_MEDIA_";
export interface VMixStateExtended {
    /**
     * The state of vMix (as far as we know) as reported by vMix **+
     * our expectations based on the commands we've set**.
     */
    reportedState: VMixState;
    outputs: VMixOutputsState;
    inputLayers: {
        [key: string]: string;
    };
    runningScripts: string[];
}
export interface VMixState {
    version: string;
    edition: string;
    existingInputs: {
        [key: string]: VMixInput;
    };
    existingInputsAudio: {
        [key: string]: VMixInputAudio;
    };
    inputsAddedByUs: {
        [key: string]: VMixInput;
    };
    inputsAddedByUsAudio: {
        [key: string]: VMixInputAudio;
    };
    overlays: Array<VMixOverlay | undefined>;
    mixes: Array<VMixMix | undefined>;
    fadeToBlack: boolean;
    faderPosition?: number;
    recording: boolean | undefined;
    external: boolean | undefined;
    streaming: boolean | undefined;
    playlist: boolean;
    multiCorder: boolean;
    fullscreen: boolean;
    audio: VMixAudioChannel[];
}
interface VMixOutputsState {
    External2: VMixOutput | undefined;
    '2': VMixOutput | undefined;
    '3': VMixOutput | undefined;
    '4': VMixOutput | undefined;
    Fullscreen: VMixOutput | undefined;
    Fullscreen2: VMixOutput | undefined;
}
export interface VMixMix {
    number: number;
    program: string | number | undefined;
    preview: string | number | undefined;
    transition: VMixTransition;
    layerToProgram?: boolean;
}
export interface VMixInput {
    number?: number;
    type?: VMixInputType | string;
    name?: string;
    filePath?: string;
    state?: 'Paused' | 'Running' | 'Completed';
    playing?: boolean;
    position?: number;
    duration?: number;
    loop?: boolean;
    transform?: VMixTransform;
    overlays?: VMixInputOverlays;
    listFilePaths?: string[];
    restart?: boolean;
}
export interface VMixInputAudio {
    number?: number;
    muted?: boolean;
    volume?: number;
    balance?: number;
    fade?: number;
    solo?: boolean;
    audioBuses?: string;
    audioAuto?: boolean;
}
export interface VMixOutput {
    source: 'Preview' | 'Program' | 'MultiView' | 'Input';
    input?: number | string;
}
export interface VMixOverlay {
    number: number;
    input: string | number | undefined;
}
export interface VMixAudioChannel {
    volume: number;
    muted: boolean;
    meterF1: number;
    meterF2: number;
    headphonesVolume: number;
}
export declare class VMixStateDiffer {
    private readonly queueNow;
    constructor(queueNow: (commands: VMixStateCommandWithContext[]) => void);
    getCommandsToAchieveState(oldVMixState: VMixStateExtended, newVMixState: VMixStateExtended): VMixStateCommandWithContext[];
    getDefaultState(): VMixStateExtended;
    getDefaultInputState(inputNumber: number | string | undefined): VMixInput;
    getDefaultInputAudioState(inputNumber: number | string | undefined): VMixInputAudio;
    private _resolveMixState;
    private _resolveInputsState;
    private _resolveExistingInputState;
    private _resolveInputState;
    private _resolveInputsAudioState;
    private _resolveInputAudioState;
    private _resolveAddedByUsInputState;
    private _resolveAddedByUsInputsRemovalState;
    private _resolveOverlaysState;
    private _resolveRecordingState;
    private _resolveStreamingState;
    private _resolveExternalState;
    private _resolveOutputsState;
    private _resolveScriptsState;
    /**
     * Checks if TSR thinks an input is currently in-use.
     * Not guaranteed to align with reality.
     */
    private _isInUse;
    private _getFilename;
}
export {};
//# sourceMappingURL=vMixStateDiffer.d.ts.map