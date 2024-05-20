import { DeviceOptionsTelemetrics, DeviceType, Mappings, TelemetricsOptions, Timeline, TSRTimelineContent } from 'timeline-state-resolver-types';
import { DeviceStatus, DeviceWithState } from '../../devices/device';
interface TelemetricsState {
    presetShotIdentifiers: number[];
}
/**
 * Connects to a Telemetrics Device on port 5000 using a TCP socket.
 * This class uses a fire and forget approach.
 */
export declare class TelemetricsDevice extends DeviceWithState<TelemetricsState, DeviceOptionsTelemetrics> {
    private doOnTime;
    private socket;
    private statusCode;
    private errorMessage;
    private resolveInitPromise;
    private retryConnectionTimer;
    constructor(deviceId: string, deviceOptions: DeviceOptionsTelemetrics, getCurrentTime: () => Promise<number>);
    get canConnect(): boolean;
    clearFuture(_clearAfterTime: number): void;
    get connected(): boolean;
    get deviceName(): string;
    get deviceType(): DeviceType;
    getStatus(): DeviceStatus;
    handleState(newState: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): void;
    private findNewTelemetricsState;
    private filterNewPresetIdentifiersFromOld;
    private queueCommand;
    init(options: TelemetricsOptions): Promise<boolean>;
    private connectToDevice;
    private setupSocket;
    private updateStatus;
    private reconnect;
    prepareForHandleState(newStateTime: number): void;
    terminate(): Promise<boolean>;
}
export {};
//# sourceMappingURL=index.d.ts.map