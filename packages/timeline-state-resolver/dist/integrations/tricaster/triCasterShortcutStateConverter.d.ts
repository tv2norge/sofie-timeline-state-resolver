import { TriCasterAudioChannelName, TriCasterInputName, TriCasterKeyerName, TriCasterLayerName, TriCasterMatrixOutputName, TriCasterMixEffectName, TriCasterMixOutputName } from 'timeline-state-resolver-types';
import { TriCasterState, WithContext } from './triCasterStateDiffer';
export declare class TriCasterShortcutStateConverter {
    private readonly resourceNames;
    constructor(resourceNames: {
        mixEffects: TriCasterMixEffectName[];
        inputs: TriCasterInputName[];
        audioChannels: TriCasterAudioChannelName[];
        layers: TriCasterLayerName[];
        keyers: TriCasterKeyerName[];
        mixOutputs: TriCasterMixOutputName[];
        matrixOutputs: TriCasterMatrixOutputName[];
    });
    getTriCasterStateFromShortcutState(shortcutStatesXml: string): WithContext<TriCasterState>;
    private extractShortcutStates;
    private parseMixEffectsState;
    private parseLayersState;
    private parseKeyersState;
    private parseInputsState;
    private parseMixOutputsState;
    private parseMatrixOutputsState;
    private parseAudioChannelsState;
    private parseString;
    private parseNumber;
    private parseBoolean;
    private joinShortcutName;
    private parseDelegate;
}
//# sourceMappingURL=triCasterShortcutStateConverter.d.ts.map