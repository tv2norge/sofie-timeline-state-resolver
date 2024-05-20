import { TimelineTriggerTimeResult } from './conductor';
import { TSRTimeline } from 'timeline-state-resolver-types';
export declare class AsyncResolver {
    private readonly onSetTimelineTriggerTime;
    private cache;
    constructor(onSetTimelineTriggerTime: (res: TimelineTriggerTimeResult) => void);
    resolveTimeline(resolveTime: number, timeline: TSRTimeline, limitTime: number, useCache: boolean): {
        resolvedStates: import("superfly-timeline").ResolvedStates;
        objectsFixed: TimelineTriggerTimeResult;
    };
    private _fixNowObjects;
}
//# sourceMappingURL=AsyncResolver.d.ts.map