/// <reference types="node" />
import * as osc from 'osc';
import { EventEmitter } from 'events';
import { MultiOSCOptions } from 'timeline-state-resolver-types';
export type OSCConnectionOptions = MultiOSCOptions['connections'][any] & {
    oscSender?: OSCSender;
};
type OSCSender = (msg: osc.OscMessage, address?: string | undefined, port?: number | undefined) => void;
export declare class OSCConnection extends EventEmitter {
    connectionId: string;
    host: string;
    port: number;
    private _type;
    private _oscClient;
    private _oscSender;
    private _connected;
    /**
     * Connnects to the OSC server.
     * @param host ip to connect to
     * @param port port the osc server is hosted on
     */
    connect(options: OSCConnectionOptions): Promise<void>;
    dispose(): void;
    private _defaultOscSender;
    sendOsc(msg: osc.OscMessage, address?: string | undefined, port?: number | undefined): void;
    disconnect(): void;
    get connected(): boolean;
    private updateIsConnected;
}
export {};
//# sourceMappingURL=deviceConnection.d.ts.map