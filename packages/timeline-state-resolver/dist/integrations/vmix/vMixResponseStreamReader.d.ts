import { EventEmitter } from 'eventemitter3';
type ResponseStreamReaderEvents = {
    response: [response: Response];
    error: [error: Error];
};
export interface Response {
    command: string;
    response: 'OK' | 'ER';
    message: string;
    body?: string;
}
/**
 * A receiver for vMix responses
 */
export declare class VMixResponseStreamReader extends EventEmitter<ResponseStreamReaderEvents> {
    private _unprocessedLines;
    private _lineRemainder;
    reset(): void;
    processIncomingData(data: string): void;
    private processPayloadData;
}
export {};
//# sourceMappingURL=vMixResponseStreamReader.d.ts.map