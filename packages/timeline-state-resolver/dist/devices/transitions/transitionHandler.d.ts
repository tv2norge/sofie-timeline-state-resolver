import { TSRTransitionOptions } from 'timeline-state-resolver-types';
export interface AnimatorType {
    type: 'linear' | 'physical';
    options?: TSRTransitionOptions;
}
export declare class InternalTransitionHandler {
    private _transitions;
    terminate(): void;
    getIdentifiers(): string[];
    clearTransition(identifier: string): void;
    stopAndSnapTransition(identifier: string, targetValues: number[]): void;
    private initTransition;
    activateTransition(identifier: string, initialValues: number[], targetValues: number[], groups: string[], options: TSRTransitionOptions, animatorTypes: {
        [groupId: string]: AnimatorType;
    }, updateCallback: (newValues: number[]) => void): void;
    private _stopTransition;
}
//# sourceMappingURL=transitionHandler.d.ts.map