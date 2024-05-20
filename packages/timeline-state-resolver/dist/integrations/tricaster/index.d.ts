import { DeviceWithState, DeviceStatus } from './../../devices/device';
import { DeviceType, Mappings, TriCasterOptions, DeviceOptionsTriCaster, Timeline, TSRTimelineContent } from 'timeline-state-resolver-types';
import { WithContext, TriCasterState } from './triCasterStateDiffer';
export type DeviceOptionsTriCasterInternal = DeviceOptionsTriCaster;
export declare class TriCasterDevice extends DeviceWithState<WithContext<TriCasterState>, DeviceOptionsTriCasterInternal> {
    private _doOnTime;
    private _resolveInitPromise;
    private _connected;
    private _initialized;
    private _isTerminating;
    private _connection?;
    private _stateDiffer?;
    constructor(deviceId: string, deviceOptions: DeviceOptionsTriCasterInternal, getCurrentTime: () => Promise<number>);
    init(options: TriCasterOptions): Promise<boolean>;
    private _setInitialState;
    private _connectionChanged;
    private _setConnected;
    /** Called by the Conductor a bit before handleState is called */
    prepareForHandleState(newStateTime: number): void;
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings): void;
    private filterTriCasterMappings;
    clearFuture(clearAfterTime: number): void;
    terminate(): Promise<boolean>;
    getStatus(): DeviceStatus;
    makeReady(okToDestroyStuff?: boolean): Promise<void>;
    get canConnect(): boolean;
    get connected(): boolean;
    get deviceType(): DeviceType;
    get deviceName(): string;
    get queue(): {
        id: string;
        queueId: string;
        time: number;
        args: any[];
    }[];
    private _addToQueue;
    private _sendCommand;
}
//# sourceMappingURL=index.d.ts.map