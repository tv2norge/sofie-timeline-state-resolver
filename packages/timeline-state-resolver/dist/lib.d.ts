import { Datastore, Timeline, TSRTimelineContent, ITranslatableMessage, ActionExecutionResultCode } from 'timeline-state-resolver-types';
/**
 * getDiff is the reverse of underscore:s _.isEqual(): It compares two values and if they differ it returns an explanation of the difference
 * If the values are equal: return null
 * @param a
 * @param b
 */
export declare function getDiff(a: any, b: any): string | null;
export interface Trace {
    /** id of this trace, should be formatted as namespace:id */
    measurement: string;
    /** timestamp of when trace was started */
    start: number;
    /** Tags to differentiate data sources */
    tags?: Record<string, string>;
}
export interface FinishedTrace extends Trace {
    /** timestamp of when trace was ended */
    ended: number;
    /** duration of the trace */
    duration: number;
}
export declare function startTrace(measurement: string, tags?: Record<string, string>): Trace;
export declare function endTrace(trace: Trace): FinishedTrace;
/**
 * 'Defer' the execution of an async function.
 * Pass an async function, and a catch block
 */
export declare function deferAsync(fn: () => Promise<void>, catcher: (e: unknown) => void): void;
export declare function fillStateFromDatastore(state: Timeline.TimelineState<TSRTimelineContent>, datastore: Datastore): Timeline.TimelineState<TSRTimelineContent>;
export declare function t(key: string, args?: {
    [k: string]: any;
}): ITranslatableMessage;
export declare function generateTranslation(key: string): string;
export declare function assertNever(_never: never): void;
export declare function actionNotFoundMessage(id: string): {
    result: ActionExecutionResultCode;
    response: ITranslatableMessage;
};
export declare function cloneDeep<T>(input: T): T;
//# sourceMappingURL=lib.d.ts.map