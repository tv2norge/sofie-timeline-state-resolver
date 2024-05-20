import { Mappings, SomeMappingVmix, TSRTimelineContent, Timeline } from 'timeline-state-resolver-types';
import { VMixInput, VMixInputAudio, VMixStateExtended } from './vMixStateDiffer';
export type MappingsVmix = Mappings<SomeMappingVmix>;
/**
 * Converts timeline state, to a TSR representation
 */
export declare class VMixTimelineStateConverter {
    private readonly getDefaultState;
    private readonly getDefaultInputState;
    private readonly getDefaultInputAudioState;
    constructor(getDefaultState: () => VMixStateExtended, getDefaultInputState: (inputIndex: number | string | undefined) => VMixInput, getDefaultInputAudioState: (inputIndex: number | string | undefined) => VMixInputAudio);
    getVMixStateFromTimelineState(state: Timeline.TimelineState<TSRTimelineContent>, mappings: MappingsVmix): VMixStateExtended;
    private _modifyInput;
    private _modifyInputAudio;
    private _switchToInput;
    private _fillStateWithMappingsDefaults;
}
//# sourceMappingURL=vMixTimelineStateConverter.d.ts.map