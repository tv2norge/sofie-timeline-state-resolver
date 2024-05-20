/// <reference types="node" />
import { EventEmitter } from 'obs-websocket-js';
import { QuantelGateway } from 'tv-automation-quantel-gateway-client';
import { QuantelCommandClearClip, QuantelCommandLoadClipFragments, QuantelCommandPauseClip, QuantelCommandPlayClip, QuantelCommandReleasePort, QuantelCommandSetupPort } from './types';
interface QuantelManagerOptions {
    /** If set: If a clip turns out to be on the wrong server, an attempt to copy the clip will be done. */
    allowCloneClips?: boolean;
}
export declare class QuantelManager extends EventEmitter {
    private _quantel;
    private getCurrentTime;
    private options;
    private _quantelState;
    private _cache;
    private _waitWithPorts;
    private _retryLoadFragmentsTimeout;
    private _failedAction;
    private waitingForReleaseChannel;
    constructor(_quantel: QuantelGateway, getCurrentTime: () => number, options: QuantelManagerOptions);
    setupPort(cmd: QuantelCommandSetupPort): Promise<void>;
    releasePort(cmd: QuantelCommandReleasePort): Promise<void>;
    tryLoadClipFragments(cmd: QuantelCommandLoadClipFragments, fromRetry?: boolean): Promise<void>;
    loadClipFragments(cmd: QuantelCommandLoadClipFragments): Promise<void>;
    playClip(cmd: QuantelCommandPlayClip): Promise<void>;
    pauseClip(cmd: QuantelCommandPauseClip): Promise<void>;
    clearClip(cmd: QuantelCommandClearClip): Promise<void>;
    private tryPrepareClipJump;
    private prepareClipJump;
    private getTrackedPort;
    private getServer;
    private getClipId;
    private filterClips;
    private prioritizeClips;
    private searchForClips;
    private wait;
    clearAllWaitWithPort(portId: string): void;
    /**
     * Returns true if the wait was cleared from someone else
     */
    private waitWithPort;
}
export {};
//# sourceMappingURL=connection.d.ts.map