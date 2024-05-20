import { TimelineContentTriCasterAny, TimelineContentTriCasterAudioChannel, TimelineContentTriCasterDSK, TimelineContentTriCasterInput, TimelineContentTriCasterMatrixOutput, TimelineContentTriCasterME, TimelineContentTriCasterMixOutput, TSRTimelineContent } from 'timeline-state-resolver-types';
export declare function isTimelineObjTriCaster(content: TSRTimelineContent): content is TimelineContentTriCasterAny;
export declare function isTimelineObjTriCasterME(content: TSRTimelineContent): content is TimelineContentTriCasterME;
export declare function isTimelineObjTriCasterInput(content: TSRTimelineContent): content is TimelineContentTriCasterInput;
export declare function isTimelineObjTriCasterDSK(content: TSRTimelineContent): content is TimelineContentTriCasterDSK;
export declare function isTimelineObjTriCasterAudioChannel(content: TSRTimelineContent): content is TimelineContentTriCasterAudioChannel;
export declare function isTimelineObjTriCasterMixOutput(content: TSRTimelineContent): content is TimelineContentTriCasterMixOutput;
export declare function isTimelineObjTriCasterMatrixOutput(content: TSRTimelineContent): content is TimelineContentTriCasterMatrixOutput;
//# sourceMappingURL=types.d.ts.map