import { TriCasterAudioChannelName, TriCasterMixEffectName, TriCasterMixOutputName, TriCasterInputName, Timeline, TSRTimelineContent, TriCasterMatrixOutputName } from 'timeline-state-resolver-types';
import { MappingsTriCaster, TriCasterState, WithContext } from './triCasterStateDiffer';
export declare class TriCasterTimelineStateConverter {
    private readonly getDefaultState;
    private meNames;
    private inputNames;
    private audioChannelNames;
    private mixOutputNames;
    private matrixOutputNames;
    constructor(getDefaultState: (mappings: MappingsTriCaster) => WithContext<TriCasterState>, resourceNames: {
        mixEffects: TriCasterMixEffectName[];
        inputs: TriCasterInputName[];
        audioChannels: TriCasterAudioChannelName[];
        mixOutputs: TriCasterMixOutputName[];
        matrixOutputs: TriCasterMatrixOutputName[];
    });
    getTriCasterStateFromTimelineState(timelineState: Timeline.TimelineState<TSRTimelineContent>, newMappings: MappingsTriCaster): WithContext<TriCasterState>;
    private sortLayers;
    private applyMixEffectState;
    private applyDskState;
    private applyInputState;
    private applyAudioChannelState;
    private applyMixOutputState;
    private applyMatrixOutputState;
    /**
     * Deeply applies primitive properties from `source` to existing properties of `target` (in place)
     */
    private deepApplyToExtendedState;
}
//# sourceMappingURL=triCasterTimelineStateConverter.d.ts.map