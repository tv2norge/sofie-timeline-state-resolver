import { VMixState, VMixStateExtended } from './vMixStateDiffer';
/**
 * Applies selected properties from the real state to allow retrying to achieve the state
 */
export declare class VMixStateSynchronizer {
    applyRealState(expectedState: VMixStateExtended, realState: VMixState): VMixStateExtended;
    private applyInputsState;
}
//# sourceMappingURL=vMixStateSynchronizer.d.ts.map