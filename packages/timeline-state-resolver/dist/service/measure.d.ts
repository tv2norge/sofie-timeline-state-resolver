export declare class Measurement {
    private _added;
    private _scheduled;
    private _stateExecution;
    private _stateDelay;
    private _commandExecutions;
    constructor(scheduled: number);
    executeState(): void;
    executeCommand(command: any): void;
    finishedCommandExecution(command: any): void;
    report(): StateChangeReport;
}
export interface StateChangeReport {
    added: number;
    prepareTime: number;
    scheduled: number;
    executed?: number;
    executionDelay?: number;
    commands: Array<{
        args: string;
        executed: number;
        executeDelay: number;
        fulfilled?: number;
        fulfilledDelay?: number;
    }>;
}
//# sourceMappingURL=measure.d.ts.map