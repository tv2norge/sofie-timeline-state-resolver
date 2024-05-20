/// <reference types="node" />
import { EventEmitter } from 'events';
import { VIZMSEPlayoutItemContentInternal } from 'timeline-state-resolver-types';
import { MSE } from '@tv2media/v-connection';
import { ExpectedPlayoutItem } from '../../expectedPlayoutItems';
import { VizMSEDevice } from './index';
import { VizMSECommandPrepare, VizMSECommandCue, VizMSECommandTake, VizMSECommandTakeOut, VizMSECommandContinue, VizMSECommandContinueReverse, VizMSECommandClearAllElements, VizMSEStateLayerInternal, VizMSECommandClearAllEngines, VizMSECommandSetConcept, VizMSECommandLoadAllElements, VizMSECommandInitializeShows, VizMSECommandCleanupShows, VizMSEStateLayer, VizMSEPlayoutItemContentInstance } from './types';
export declare function getHash(str: string): string;
export type Engine = {
    name: string;
    channel?: string;
    host: string;
    port: number;
};
export type EngineStatus = Engine & {
    alive: boolean;
};
export declare class VizMSEManager extends EventEmitter {
    private _parentVizMSEDevice;
    private _vizMSE;
    preloadAllElements: boolean;
    onlyPreloadActivePlaylist: boolean;
    purgeUnknownElements: boolean;
    autoLoadInternalElements: boolean;
    engineRestPort: number | undefined;
    private _showDirectoryPath;
    private _profile;
    private _playlistID?;
    initialized: boolean;
    notLoadedCount: number;
    loadingCount: number;
    enginesDisconnected: Array<string>;
    private _rundown;
    private _elementCache;
    private _expectedPlayoutItems;
    private _monitorAndLoadElementsTimeout?;
    private _monitorMSEConnectionTimeout?;
    private _lastTimeCommandSent;
    private _hasActiveRundown;
    private _getRundownPromise?;
    private _mseConnected;
    private _msePingConnected;
    private _loadingAllElements;
    private _waitWithLayers;
    ignoreAllWaits: boolean;
    private _terminated;
    private _activeRundownPlaylistId;
    private _preloadedRundownPlaylistId;
    private _updateAfterReconnect;
    private _initializedShows;
    private _showToIdMap;
    get activeRundownPlaylistId(): string | undefined;
    constructor(_parentVizMSEDevice: VizMSEDevice, _vizMSE: MSE, preloadAllElements: boolean, onlyPreloadActivePlaylist: boolean, purgeUnknownElements: boolean, autoLoadInternalElements: boolean, engineRestPort: number | undefined, _showDirectoryPath: string, _profile: string, _playlistID?: string | undefined);
    /**
     * Initialize the Rundown in MSE.
     * Our approach is to create a single rundown on initialization, and then use only that for later control.
     */
    initializeRundown(activeRundownPlaylistId: string | undefined): Promise<void>;
    /**
     * Close connections and die
     */
    terminate(): Promise<void>;
    /**
     * Set the collection of expectedPlayoutItems.
     * These will be monitored and can be triggered to pre-load.
     */
    setExpectedPlayoutItems(expectedPlayoutItems: Array<ExpectedPlayoutItem>): void;
    purgeRundown(clearAll: boolean): Promise<void>;
    /**
     * Activate the rundown.
     * This causes the MSE rundown to activate, which must be done before using it.
     * Doing this will make MSE start loading things onto the vizEngine etc.
     */
    activate(rundownPlaylistId: string | undefined): Promise<void>;
    /**
     * Deactivate the MSE rundown.
     * This causes the MSE to stand down and clear the vizEngines of any loaded graphics.
     */
    deactivate(): Promise<void>;
    standDownActiveRundown(): void;
    private _clearMediaObjects;
    /**
     * Prepare an element
     * This creates the element and is intended to be called a little time ahead of Takeing the element.
     */
    prepareElement(cmd: VizMSECommandPrepare): Promise<void>;
    /**
     * Cue:ing an element: Load and play the first frame of a graphic
     */
    cueElement(cmd: VizMSECommandCue): Promise<void>;
    private logCommand;
    /**
     * Take an element: Load and Play a graphic element, run in-animatinos etc
     */
    takeElement(cmd: VizMSECommandTake): Promise<void>;
    /**
     * Take out: Animate out a graphic element
     */
    takeoutElement(cmd: VizMSECommandTakeOut): Promise<void>;
    /**
     * Continue: Cause the graphic element to step forward, if it has multiple states
     */
    continueElement(cmd: VizMSECommandContinue): Promise<void>;
    /**
     * Continue-reverse: Cause the graphic element to step backwards, if it has multiple states
     */
    continueElementReverse(cmd: VizMSECommandContinueReverse): Promise<void>;
    /**
     * Special: trigger a template which clears all templates on the output
     */
    clearAll(cmd: VizMSECommandClearAllElements): Promise<void>;
    /**
     * Special: send commands to Viz Engines in order to clear them
     */
    clearEngines(cmd: VizMSECommandClearAllEngines): Promise<void>;
    private _getEngines;
    private _filterEnginesToClear;
    setConcept(cmd: VizMSECommandSetConcept): Promise<void>;
    /**
     * Load all elements: Trigger a loading of all pilot elements onto the vizEngine.
     * This might cause the vizEngine to freeze during load, so do not to it while on air!
     */
    loadAllElements(_cmd: VizMSECommandLoadAllElements): Promise<void>;
    private _initializeShows;
    initializeShows(cmd: VizMSECommandInitializeShows): Promise<void>;
    cleanupShows(cmd: VizMSECommandCleanupShows): Promise<void>;
    private _cleanupShows;
    cleanupAllShows(): Promise<void>;
    resolveShowNameToId(showName: string): string | undefined;
    /** Convenience function to get the data for an element */
    static getTemplateData(layer: VizMSEStateLayer): string[];
    /** Convenience function to get the "instance-id" of an element. This is intended to be unique for each usage/instance of the elemenet */
    static getInternalElementInstanceName(layer: VizMSEStateLayerInternal | VIZMSEPlayoutItemContentInternal): string;
    private getPlayoutItemContent;
    static getPlayoutItemContentFromLayer(layer: VizMSEStateLayer): VizMSEPlayoutItemContentInstance;
    private static _getElementHash;
    private _getCachedElement;
    private _cacheElement;
    private _clearCache;
    private _getElementReference;
    private _isInternalElement;
    private _isExternalElement;
    /**
     * Check if element is already created, otherwise create it and return it.
     */
    private _checkPrepareElement;
    /** Check that the element exists and if not, throw error */
    private _checkElementExists;
    /**
     * Create a new element in MSE
     */
    private _prepareNewElement;
    private _deleteElement;
    private _prepareAndGetExpectedPlayoutItems;
    /**
     * Update the load-statuses of the expectedPlayoutItems -elements from MSE, where needed
     */
    private updateElementsLoadedStatus;
    private _triggerRundownActivate;
    /**
     * Trigger a load of all elements that are not yet loaded onto the vizEngine.
     */
    private _triggerLoadAllElements;
    private _setMonitorLoadedElementsTimeout;
    private _setMonitorConnectionTimeout;
    private _monitorConnection;
    private _monitorEngines;
    private _pingEngine;
    /** Monitor loading status of expected elements */
    private _monitorLoadedElements;
    private _wait;
    /** Execute fcn an retry a couple of times until it succeeds */
    private _handleRetry;
    private _triggerCommandSent;
    private _timeSinceLastCommandSent;
    private _setLoadedStatus;
    /**
     * Returns true if the element is successfully loaded (as opposed to "not-loaded" or "loading")
     */
    private _isElementLoaded;
    /**
     * Returns true if the element has NOT started loading (is currently not loading, or finished loaded)
     */
    private _isElementLoading;
    /**
     * Return the current MSE rundown, create it if it doesn't exists
     */
    private _getRundown;
    private mseConnectionChanged;
    private onConnectionChanged;
    clearAllWaitWithLayer(portId: string): void;
    /**
     * Returns true if the wait was cleared from someone else
     */
    private waitWithLayer;
    private getElementsToKeep;
}
//# sourceMappingURL=vizMSEManager.d.ts.map