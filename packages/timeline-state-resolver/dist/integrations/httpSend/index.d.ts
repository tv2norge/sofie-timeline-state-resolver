import { CommandWithContext, Device, DeviceEvents } from '../../service/device';
import { ActionExecutionResult, DeviceStatus, HTTPSendCommandContent, HTTPSendOptions, HttpSendActions, TSRTimelineContent, Timeline } from 'timeline-state-resolver-types';
import EventEmitter = require('eventemitter3');
export type HttpSendDeviceState = Timeline.TimelineState<TSRTimelineContent>;
export interface HttpSendDeviceCommand extends CommandWithContext {
    command: {
        commandName: 'added' | 'changed' | 'removed' | 'retry' | 'manual';
        content: HTTPSendCommandContent;
        layer: string;
    };
}
export declare class HTTPSendDevice extends EventEmitter<DeviceEvents> implements Device<HTTPSendOptions, HttpSendDeviceState, HttpSendDeviceCommand> {
    protected options: HTTPSendOptions;
    /** Maps layers -> sent command-hashes */
    protected trackedState: Map<string, string>;
    protected _terminated: boolean;
    init(options: HTTPSendOptions): Promise<boolean>;
    terminate(): Promise<boolean>;
    get connected(): boolean;
    getStatus(): Omit<DeviceStatus, 'active'>;
    actions: Record<string, (id: HttpSendActions, payload?: Record<string, any>) => Promise<ActionExecutionResult>>;
    private sendManualCommand;
    convertTimelineStateToDeviceState(state: Timeline.TimelineState<TSRTimelineContent>): HttpSendDeviceState;
    diffStates(oldState: HttpSendDeviceState | undefined, newState: HttpSendDeviceState): Array<HttpSendDeviceCommand>;
    sendCommand({ tlObjId, context, command }: HttpSendDeviceCommand): Promise<unknown>;
    private getTrackedStateHash;
}
//# sourceMappingURL=index.d.ts.map